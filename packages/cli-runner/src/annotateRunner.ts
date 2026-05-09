/**
 * Iterative outline annotator.
 *
 * Strategy (per operator's spec):
 *   1. Identify "describable" steps in the outline — anything except
 *      `meta` and (by default) `user-instruction`. These are the steps
 *      we want a 1-line description tag for.
 *   2. While unfilled steps remain and we're under `maxAttempts`:
 *      a. Take the next batch of unfilled steps (size capped by
 *         `batchSize`).
 *      b. Cache-preservingly fork the source session (mechanic per
 *         CLI — see `annotatorPrimitive.ts`).
 *      c. Send the annotator prompt with that batch + the descriptions
 *         we've already collected (so the model stays consistent in
 *         tone but doesn't rewrite them).
 *      d. Parse the JSON response; merge its descriptions into the
 *         outline by step index.
 *   3. Stamp `outline.annotation` with one entry per fork attempt and
 *      return.
 *
 * Why iterate instead of asking for everything in one fork: long
 * outlines (hundreds of steps) blow past the model's reasonable JSON
 * output budget and degrade response quality. Batching also lets us
 * surface mid-run progress events and recover gracefully when one
 * batch comes back malformed — the rest still proceeds.
 */

import {
  buildAnnotatePrompt,
  type SessionOutline,
  type SessionOutlineAnnotation,
  type SessionStep,
  type SessionStepKind,
  type AnnotationFork,
} from '@context-action/session-core/outline';
import { parseAnnotateBatch } from './parseAnnotateBatch';
import {
  makeAnnotatorPrimitive,
  ANNOTATE_BATCH_JSON_SCHEMA,
  type AnnotatorPrimitive,
} from './annotatorPrimitive';
import {
  ModelOutputParseError,
  type ForkProgress,
  type SummaryLanguage,
} from './types';

/** Step kinds that are NOT worth tagging. Excluded from describable set. */
const SKIP_KINDS: ReadonlySet<SessionStepKind> = new Set<SessionStepKind>([
  'meta',
  // user-instruction's "description" would be a normalisation of the
  // user's own text — useful for some UIs, but for v1 we keep the raw
  // excerpt and skip the round-trip.
  'user-instruction',
]);

export interface AnnotateOutlineOptions {
  /** Max steps per fork. Default 20 — large enough to amortize the */
  /** prompt overhead, small enough to keep JSON output sane. */
  batchSize?: number;
  /** Hard cap on fork attempts. Default 5 — pathological sessions */
  /** that can't be fully tagged after 5 batches just stop. */
  maxAttempts?: number;
  language?: SummaryLanguage;
  /** Progress sink — same shape as the summarize runner uses. */
  onProgress?: (event: ForkProgress) => void;
  /**
   * Override the primitive — primarily for tests that want to drive a
   * deterministic stub. Production callers leave this undefined and
   * dispatch by `outline.toolId`.
   */
  primitive?: AnnotatorPrimitive;
}

interface AnnotateOutcome {
  outline: SessionOutline;
  annotation: SessionOutlineAnnotation;
}

function isDescribable(step: SessionStep): boolean {
  return !SKIP_KINDS.has(step.kind);
}

export async function annotateOutline(
  outline: SessionOutline,
  cwd: string,
  options: AnnotateOutlineOptions = {},
): Promise<AnnotateOutcome> {
  const batchSize = Math.max(1, options.batchSize ?? 20);
  const maxAttempts = Math.max(1, options.maxAttempts ?? 5);
  const language: SummaryLanguage = options.language ?? outline.language ?? 'en';
  const onProgress = options.onProgress;
  const startedAt = Date.now();

  // Mutate a deep-ish copy: we don't want to leak intermediate mutations
  // back to the caller's input on failure. Step objects themselves get
  // `description` set in place, but the outer arrays are fresh.
  const steps: SessionStep[] = outline.steps.map((s) => ({ ...s }));
  const stepByIndex = new Map<number, SessionStep>();
  for (const s of steps) stepByIndex.set(s.index, s);

  const emit = (e: ForkProgress) => {
    try {
      onProgress?.(e);
    } catch {
      /* progress sinks must never break the runner */
    }
  };

  emit({
    sourceSessionId: outline.sourceSessionId,
    phase: 'started',
    message: `annotator: ${steps.filter(isDescribable).length} describable steps`,
    elapsedMs: 0,
  });

  const forks: AnnotationFork[] = [];

  const primitive =
    options.primitive ??
    makeAnnotatorPrimitive({
      toolId: outline.toolId,
      sourceSessionId: outline.sourceSessionId,
      cwd,
    });

  await primitive.prepare();
  try {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const unfilled = steps.filter((s) => isDescribable(s) && !s.description);
      if (unfilled.length === 0) break;
      const batch = unfilled.slice(0, batchSize);

      const alreadyDescribed = steps
        .filter((s) => isDescribable(s) && !!s.description)
        // Cap the context to keep the prompt bounded — the model only
        // needs a sample of prior tone, not every previous tag.
        .slice(-30)
        .map((s) => ({ index: s.index, description: s.description as string }));

      const prompt = buildAnnotatePrompt({
        language,
        batch: batch.map((s) => ({
          index: s.index,
          kind: s.kind,
          toolName: s.toolName,
          excerpt: s.excerpt,
        })),
        alreadyDescribed,
      });

      emit({
        sourceSessionId: outline.sourceSessionId,
        phase: 'cli-spawned',
        message: `attempt ${attempt + 1}/${maxAttempts}: tagging ${batch.length} steps (${unfilled.length} remaining)`,
        elapsedMs: Date.now() - startedAt,
      });

      let batchResult;
      try {
        batchResult = await primitive.forkAndAnnotate({
          prompt,
          outputSchema: ANNOTATE_BATCH_JSON_SCHEMA,
          emit,
        });
      } catch (err) {
        emit({
          sourceSessionId: outline.sourceSessionId,
          phase: 'failed',
          elapsedMs: Date.now() - startedAt,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }

      const described: number[] = [];
      try {
        const parsed = parseAnnotateBatch(batchResult.rawText);
        for (const [keyRaw, descRaw] of Object.entries(parsed.descriptions)) {
          const key = Number.parseInt(keyRaw, 10);
          if (!Number.isFinite(key)) continue;
          const target = stepByIndex.get(key);
          if (!target || !isDescribable(target)) continue;
          const trimmed = String(descRaw).trim();
          if (!trimmed) continue;
          // Don't overwrite a description we already set — earlier
          // attempts win when the model echoes a duplicate key.
          if (target.description) continue;
          target.description = trimmed;
          described.push(key);
        }
      } catch (err) {
        // Malformed batch: don't kill the whole annotation — log and
        // proceed to the next attempt. A persistent failure across
        // every batch will still terminate via `maxAttempts`.
        if (err instanceof ModelOutputParseError) {
          emit({
            sourceSessionId: outline.sourceSessionId,
            phase: 'failed',
            elapsedMs: Date.now() - startedAt,
            error: `annotator batch ${attempt + 1} unparseable: ${err.message}`,
          });
        } else {
          throw err;
        }
      }

      forks.push({
        forkSessionId: batchResult.forkSessionId,
        cacheReadTokens: batchResult.cacheReadTokens,
        cacheCreationTokens: batchResult.cacheCreationTokens,
        inputTokens: batchResult.inputTokens,
        durationMs: batchResult.durationMs,
        costUsd: batchResult.costUsd,
        describedStepIndexes: described,
      });

      emit({
        sourceSessionId: outline.sourceSessionId,
        phase: 'parsed',
        message: `attempt ${attempt + 1}: filled ${described.length}/${batch.length}`,
        elapsedMs: Date.now() - startedAt,
        forkSessionId: batchResult.forkSessionId ?? undefined,
        cacheReadTokens: batchResult.cacheReadTokens || undefined,
      });

      // Safety: if a batch returned zero descriptions, abandon further
      // attempts on the same set (the model is stuck). The remaining
      // steps just stay untagged in the persisted outline.
      if (described.length === 0) break;
    }
  } finally {
    await primitive.shutdown().catch(() => undefined);
  }

  const remainingUntagged = steps.filter(
    (s) => isDescribable(s) && !s.description,
  ).length;

  const annotation: SessionOutlineAnnotation = {
    forks,
    remainingUntagged,
    annotatedAt: new Date().toISOString(),
  };

  // Rebuild segments off the mutated steps so the persisted outline
  // carries descriptions inside `segments[].steps[].description` too.
  const annotated: SessionOutline = {
    ...outline,
    steps,
    segments: outline.segments.map((seg) => ({
      ...seg,
      steps: seg.steps.map((s) => stepByIndex.get(s.index) ?? s),
    })),
    language,
    annotation,
  };

  emit({
    sourceSessionId: outline.sourceSessionId,
    phase: 'assistant-complete',
    message: `done: ${steps.filter((s) => !!s.description).length} tagged, ${remainingUntagged} remaining`,
    elapsedMs: Date.now() - startedAt,
  });

  return { outline: annotated, annotation };
}
