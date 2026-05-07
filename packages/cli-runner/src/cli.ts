#!/usr/bin/env node
/**
 * Standalone CLI — full feature parity with the Electrobun GUI host.
 *
 * Subcommands
 *   runners                              List registered runners + capability
 *   capability <toolId>                  Capability JSON for one runner
 *   projects [--toolId X] [--json]       Multi-CLI project list
 *   sessions <projectId> [--json]        Per-project session list
 *   branch   <toolId> <sessionId> ...    Fork + summarize (auto-saves to ~/.session-viewer/summaries/)
 *   summaries list   [filters] [--json]  List persisted summaries
 *   summaries get    <id> [--json]       Fetch one
 *   summaries delete <id>                Delete one
 *
 * Progress + log lines stream to stderr; stdout stays parseable.
 */

import { randomUUID } from 'node:crypto';
import {
  invalidateCache,
  listProjects,
  listSessions as readListSessions,
  readClaudeSessionRaw,
  readCodexSessionRaw,
  readGeminiSessionRaw,
  resolveSession,
} from '@context-action/session-core/server/readers';
import {
  deleteSummary,
  getSummary,
  listSummaries,
  saveSummary,
} from '@context-action/session-core/server/summary-store';
import {
  deleteOutline,
  getOutline,
  listOutlines,
  saveOutline,
} from '@context-action/session-core/server/outline-store';
import {
  extractClaudeOutline,
  extractCodexOutline,
  extractGeminiOutline,
} from '@context-action/session-core/outline';
import type { SessionOutline } from '@context-action/session-core/outline';
import { annotateOutline } from './annotateRunner';
import type {
  ListSummariesFilter,
  SummaryRecord,
} from '@context-action/session-core';
import { getRunner } from './index';
import type { ForkContext, ForkProgress, SummaryLanguage } from './types';
import {
  buildSearchHaystack,
  formatProjects,
  formatSessions,
  formatSummaryRows,
  isLanguage,
  isToolId,
  parseArgs,
  parseSinceFlag,
  prettyPrint,
  type ParsedArgs,
} from './cli-internals';

function printUsage(): void {
  process.stderr.write(`\
cli-runner — fork-and-summarize for Claude / Codex / Gemini sessions.

Usage
  cli-runner runners
  cli-runner capability <toolId>
  cli-runner projects [--toolId claude|codex|gemini] [--json]
  cli-runner sessions <projectId> [--json]
  cli-runner branch <toolId> <sessionId> [options]
  cli-runner outline <toolId> <sessionId> [--cwd PATH] [--json]
                                          [--segments-only]
  cli-runner annotate <toolId> <sessionId> [--cwd PATH] [--language en|ko]
                                           [--batch-size N] [--max-attempts N]
                                           [--no-save] [--json]
  cli-runner outlines list   [--toolId X] [--annotated] [--json]
  cli-runner outlines get    <sessionId> [--json]
  cli-runner outlines delete <sessionId>
  cli-runner summaries list   [--source <sessionId>] [--toolId X]
                              [--since 24h|7d|30d|all]
                              [--sort newest|oldest|cacheHit]
                              [--search <text>] [--json]
  cli-runner summaries get    <id> [--json]
  cli-runner summaries delete <id>

branch options
  --cwd <path>          Source session's cwd (auto-detected from session
                        cache when omitted; falls back to process.cwd())
  --language <en|ko>    Output language for the model narrative (default: en)
  --prompt <text>       Operator prompt appended to the canonical template
  --json                Emit the SummaryResult as raw JSON
  --no-progress         Suppress progress events on stderr
  --no-save             Skip persisting the result to the summary store
  --refresh             Bust the session-reader cache before resolving cwd

Examples
  cli-runner runners
  cli-runner projects --toolId claude
  cli-runner sessions claude:-Users-jun-work-repo
  cli-runner branch claude 7f4e1a... --language ko
  cli-runner summaries list --since 7d --sort cacheHit --json
  cli-runner summaries get 5fbcd104-... --json
`);
}

async function cmdRunners(): Promise<number> {
  const ids: ForkContext['toolId'][] = ['claude', 'codex', 'gemini'];
  for (const id of ids) {
    const runner = getRunner(id);
    if (!runner) {
      process.stdout.write(`${id}\tunregistered\n`);
      continue;
    }
    const cap = await runner.capability();
    process.stdout.write(
      `${id}\t${cap.available ? 'available' : 'unavailable'}${
        cap.unavailableReason ? `\t${cap.unavailableReason}` : ''
      }\n`,
    );
  }
  return 0;
}

async function cmdCapability(toolId: string): Promise<number> {
  if (!isToolId(toolId)) {
    process.stderr.write(`Unknown toolId: ${toolId}\n`);
    return 2;
  }
  const runner = getRunner(toolId);
  if (!runner) {
    process.stderr.write(`No runner registered for ${toolId}\n`);
    return 2;
  }
  const cap = await runner.capability();
  process.stdout.write(`${JSON.stringify(cap, null, 2)}\n`);
  return cap.available ? 0 : 1;
}

async function cmdBranch(parsed: ParsedArgs): Promise<number> {
  const [toolIdRaw, sessionId] = parsed.positional;
  if (!toolIdRaw || !sessionId) {
    printUsage();
    return 2;
  }
  if (!isToolId(toolIdRaw)) {
    process.stderr.write(`Unknown toolId: ${toolIdRaw}\n`);
    return 2;
  }
  const runner = getRunner(toolIdRaw);
  if (!runner) {
    process.stderr.write(`No runner registered for ${toolIdRaw}\n`);
    return 2;
  }
  const cap = await runner.capability();
  if (!cap.available) {
    process.stderr.write(
      `Runner ${toolIdRaw} unavailable: ${cap.unavailableReason ?? 'unknown'}\n`,
    );
    return 2;
  }

  if (parsed.flags.refresh === true) {
    await invalidateCache();
  }

  // Auto-resolve cwd from the session reader cache when --cwd isn't given.
  // Saves the operator from having to remember the project path; falls back
  // to process.cwd() if the session isn't in the multi-CLI cache.
  let cwd: string;
  if (typeof parsed.flags.cwd === 'string') {
    cwd = parsed.flags.cwd;
  } else {
    const resolved = await resolveSession(sessionId);
    if (resolved) {
      if (resolved.toolId !== toolIdRaw) {
        process.stderr.write(
          `Warning: session ${sessionId} resolved as ${resolved.toolId}, but you asked for ${toolIdRaw}\n`,
        );
      }
      cwd = resolved.cwd;
    } else {
      cwd = process.cwd();
    }
  }

  const lang = parsed.flags.language;
  if (lang !== undefined && !isLanguage(lang)) {
    process.stderr.write(`Invalid --language (en|ko): ${String(lang)}\n`);
    return 2;
  }
  const promptOverride =
    typeof parsed.flags.prompt === 'string' ? parsed.flags.prompt : undefined;
  const showProgress = parsed.flags['no-progress'] !== true;
  const json = parsed.flags.json === true;
  const noSave = parsed.flags['no-save'] === true;

  const onProgress = showProgress
    ? (e: ForkProgress) => {
        const line =
          e.phase === 'assistant-streaming'
            ? `[${e.elapsedMs}ms] ${e.phase}${
                e.textDelta ? ` (+${e.textDelta.length} chars)` : ''
              }`
            : `[${e.elapsedMs}ms] ${e.phase}${e.message ? ` — ${e.message}` : ''}${
                e.error ? ` :: ${e.error}` : ''
              }`;
        process.stderr.write(`${line}\n`);
      }
    : undefined;

  try {
    const summary = await runner.fork({
      sourceSessionId: sessionId,
      cwd,
      toolId: toolIdRaw,
      kind: 'summarize',
      language: lang as SummaryLanguage | undefined,
      promptOverride,
      onProgress,
    });

    // Persist by default — matches the GUI flow so `cli-runner summaries
    // list` immediately reflects whatever was just produced.
    if (!noSave) {
      const record: SummaryRecord = {
        id: summary.cacheInvariants?.forkSessionId ?? randomUUID(),
        sourceSessionId: sessionId,
        toolId: toolIdRaw,
        cwd,
        createdAt: summary.generatedAt,
        promptOverride,
        language: lang as SummaryLanguage | undefined,
        summary,
      };
      try {
        await saveSummary(record);
        if (showProgress) {
          process.stderr.write(`[saved] ~/.session-viewer/summaries/${record.id}.json\n`);
        }
      } catch (err) {
        process.stderr.write(
          `warning: failed to persist summary: ${err instanceof Error ? err.message : String(err)}\n`,
        );
      }
    }

    if (json) {
      process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    } else {
      process.stdout.write(`${prettyPrint(summary)}\n`);
    }
    return 0;
  } catch (err) {
    process.stderr.write(
      `branch failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}

async function cmdProjects(parsed: ParsedArgs): Promise<number> {
  if (parsed.flags.refresh === true) {
    await invalidateCache();
  }
  const all = await listProjects();
  const tool = parsed.flags.toolId;
  const filtered =
    typeof tool === 'string' && tool !== 'all'
      ? all.filter((p) => p.toolId === tool)
      : all;
  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(filtered, null, 2)}\n`);
  } else {
    process.stdout.write(formatProjects(filtered));
  }
  return 0;
}

async function cmdSessions(parsed: ParsedArgs): Promise<number> {
  const [projectId] = parsed.positional;
  if (!projectId) {
    printUsage();
    return 2;
  }
  if (parsed.flags.refresh === true) {
    await invalidateCache();
  }
  const sessions = await readListSessions(projectId);
  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(sessions, null, 2)}\n`);
  } else {
    process.stdout.write(formatSessions(sessions));
  }
  return 0;
}

/**
 * Resolve a session's outline by dispatching to the per-CLI raw reader
 * + extractor. Returns either the outline or a structured error so the
 * caller (cmdOutline, cmdAnnotate) can emit a useful exit message.
 */
async function loadOutlineForSession(opts: {
  toolId: ForkContext['toolId'];
  sessionId: string;
  cwd: string;
  language?: 'en' | 'ko';
}): Promise<{ outline: SessionOutline } | { error: string }> {
  const { toolId, sessionId, cwd, language } = opts;
  if (toolId === 'claude') {
    const raw = await readClaudeSessionRaw(sessionId, cwd);
    if (raw === null) {
      return {
        error: `claude JSONL not found at ~/.claude/projects/<dash>/${sessionId}.jsonl (cwd=${cwd})`,
      };
    }
    return {
      outline: extractClaudeOutline({ raw, sourceSessionId: sessionId, cwd, language }),
    };
  }
  if (toolId === 'codex') {
    const raw = await readCodexSessionRaw(sessionId, cwd);
    if (raw === null) {
      return {
        error: `codex rollout not found for ${sessionId} within recent partitions (set SESSION_VIEWER_CODEX_DAYS to widen)`,
      };
    }
    return {
      outline: extractCodexOutline({ raw, sourceSessionId: sessionId, cwd, language }),
    };
  }
  if (toolId === 'gemini') {
    const raw = await readGeminiSessionRaw(sessionId, cwd);
    if (raw === null) {
      return {
        error: `gemini session.json not found for ${sessionId} (cwd=${cwd})`,
      };
    }
    return {
      outline: extractGeminiOutline({ raw, sourceSessionId: sessionId, cwd, language }),
    };
  }
  return { error: `Unsupported toolId: ${toolId as string}` };
}

async function cmdOutline(parsed: ParsedArgs): Promise<number> {
  const [toolIdRaw, sessionId] = parsed.positional;
  if (!toolIdRaw || !sessionId) {
    printUsage();
    return 2;
  }
  if (!isToolId(toolIdRaw)) {
    process.stderr.write(`Unknown toolId: ${toolIdRaw}\n`);
    return 2;
  }

  let cwd: string;
  if (typeof parsed.flags.cwd === 'string') {
    cwd = parsed.flags.cwd;
  } else {
    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      process.stderr.write(
        `outline: session ${sessionId} not in cache. Pass --cwd or --refresh.\n`,
      );
      return 2;
    }
    cwd = resolved.cwd;
  }

  const result = await loadOutlineForSession({
    toolId: toolIdRaw,
    sessionId,
    cwd,
  });
  if ('error' in result) {
    process.stderr.write(`outline: ${result.error}\n`);
    return 2;
  }

  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(result.outline, null, 2)}\n`);
    return 0;
  }

  const segmentsOnly = parsed.flags['segments-only'] === true;
  process.stdout.write(formatOutline(result.outline, { segmentsOnly }));
  return 0;
}

function formatOutline(
  outline: SessionOutline,
  opts: { segmentsOnly?: boolean } = {},
): string {
  const lines: string[] = [];
  lines.push(
    `# outline ${outline.toolId}:${outline.sourceSessionId} · ${outline.cwd}` +
      (outline.model ? ` · ${outline.model}` : ''),
  );
  lines.push(`steps: ${outline.steps.length} · segments: ${outline.segments.length}`);

  for (const seg of outline.segments) {
    const head =
      seg.openedByStep === null
        ? '[opening]'
        : `[#${seg.openedByStep} user] ${truncate(seg.userInstructionExcerpt, 120)}`;
    lines.push('');
    lines.push(head);
    if (opts.segmentsOnly) {
      // Aggregate counts only.
      const tally: Record<string, number> = {};
      for (const s of seg.steps) tally[s.kind] = (tally[s.kind] ?? 0) + 1;
      const summary = Object.entries(tally)
        .map(([k, n]) => `${k}=${n}`)
        .join(', ');
      lines.push(`  ${summary || '(empty)'}`);
      continue;
    }
    if (seg.steps.length === 0) {
      lines.push('  (no steps)');
      continue;
    }
    for (const s of seg.steps) {
      const head2 = `  #${s.index} [${s.kind}${s.toolName ? `:${s.toolName}` : ''}]`;
      lines.push(`${head2} ${truncate(s.excerpt, 120)}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function truncate(text: string, n: number): string {
  if (text.length <= n) return text;
  return `${text.slice(0, n)}…`;
}

async function cmdAnnotate(parsed: ParsedArgs): Promise<number> {
  const [toolIdRaw, sessionId] = parsed.positional;
  if (!toolIdRaw || !sessionId) {
    printUsage();
    return 2;
  }
  if (!isToolId(toolIdRaw)) {
    process.stderr.write(`Unknown toolId: ${toolIdRaw}\n`);
    return 2;
  }
  if (toolIdRaw !== 'claude') {
    process.stderr.write(
      `annotate: cache-preserving fork annotation is currently claude-only.\n` +
        `(codex / gemini outlines are extractable via \`cli-runner outline\`,\n` +
        ` but their fork mechanisms don't preserve prefix bytes the same way.)\n`,
    );
    return 2;
  }

  const runner = getRunner('claude');
  if (!runner) {
    process.stderr.write('No runner registered for claude\n');
    return 2;
  }
  const cap = await runner.capability();
  if (!cap.available) {
    process.stderr.write(
      `claude runner unavailable: ${cap.unavailableReason ?? 'unknown'}\n`,
    );
    return 2;
  }

  let cwd: string;
  if (typeof parsed.flags.cwd === 'string') {
    cwd = parsed.flags.cwd;
  } else {
    const resolved = await resolveSession(sessionId);
    if (!resolved) {
      process.stderr.write(
        `annotate: session ${sessionId} not in cache. Pass --cwd or --refresh.\n`,
      );
      return 2;
    }
    cwd = resolved.cwd;
  }

  const lang = parsed.flags.language;
  if (lang !== undefined && !isLanguage(lang)) {
    process.stderr.write(`Invalid --language (en|ko): ${String(lang)}\n`);
    return 2;
  }

  const batchSizeRaw = parsed.flags['batch-size'];
  const batchSize =
    typeof batchSizeRaw === 'string'
      ? Number.parseInt(batchSizeRaw, 10)
      : undefined;
  const maxAttemptsRaw = parsed.flags['max-attempts'];
  const maxAttempts =
    typeof maxAttemptsRaw === 'string'
      ? Number.parseInt(maxAttemptsRaw, 10)
      : undefined;
  if (batchSize !== undefined && !Number.isFinite(batchSize)) {
    process.stderr.write(`Invalid --batch-size: ${String(batchSizeRaw)}\n`);
    return 2;
  }
  if (maxAttempts !== undefined && !Number.isFinite(maxAttempts)) {
    process.stderr.write(`Invalid --max-attempts: ${String(maxAttemptsRaw)}\n`);
    return 2;
  }

  const showProgress = parsed.flags['no-progress'] !== true;
  const onProgress = showProgress
    ? (e: ForkProgress) => {
        const line =
          e.phase === 'assistant-streaming'
            ? `[${e.elapsedMs}ms] ${e.phase}${
                e.textDelta ? ` (+${e.textDelta.length} chars)` : ''
              }`
            : `[${e.elapsedMs}ms] ${e.phase}${e.message ? ` — ${e.message}` : ''}${
                e.error ? ` :: ${e.error}` : ''
              }`;
        process.stderr.write(`${line}\n`);
      }
    : undefined;

  const baseResult = await loadOutlineForSession({
    toolId: toolIdRaw,
    sessionId,
    cwd,
    language: lang as 'en' | 'ko' | undefined,
  });
  if ('error' in baseResult) {
    process.stderr.write(`annotate: ${baseResult.error}\n`);
    return 2;
  }
  const baseOutline = baseResult.outline;

  try {
    const { outline } = await annotateOutline(baseOutline, cwd, {
      batchSize,
      maxAttempts,
      language: lang as 'en' | 'ko' | undefined,
      onProgress,
    });

    const noSave = parsed.flags['no-save'] === true;
    if (!noSave) {
      try {
        await saveOutline(outline);
        if (showProgress) {
          process.stderr.write(
            `[saved] ~/.session-viewer/outlines/${outline.sourceSessionId}.json\n`,
          );
        }
      } catch (err) {
        process.stderr.write(
          `warning: failed to persist outline: ${
            err instanceof Error ? err.message : String(err)
          }\n`,
        );
      }
    }

    if (parsed.flags.json === true) {
      process.stdout.write(`${JSON.stringify(outline, null, 2)}\n`);
    } else {
      process.stdout.write(formatOutline(outline));
      const tagged = outline.steps.filter((s) => !!s.description).length;
      const total = outline.steps.length;
      process.stdout.write(
        `\nannotated ${tagged}/${total} steps across ${outline.annotation?.forks.length ?? 0} forks (${outline.annotation?.remainingUntagged ?? 0} remaining)\n`,
      );
    }
    return 0;
  } catch (err) {
    process.stderr.write(
      `annotate failed: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    return 1;
  }
}

async function cmdOutlinesList(parsed: ParsedArgs): Promise<number> {
  const tool = parsed.flags.toolId;
  const annotatedOnly = parsed.flags.annotated === true;
  const records = await listOutlines({
    toolId:
      typeof tool === 'string' && isToolId(tool) ? tool : undefined,
    annotatedOnly,
  });
  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
    return 0;
  }
  if (records.length === 0) {
    process.stdout.write('(no outlines persisted yet)\n');
    return 0;
  }
  for (const r of records) {
    const tagged = r.steps.filter((s) => !!s.description).length;
    process.stdout.write(
      `${r.toolId}\t${r.sourceSessionId}\t${r.steps.length}st\t${r.segments.length}seg\t${tagged}/${r.steps.length} tagged\t${r.cwd}\n`,
    );
  }
  return 0;
}

async function cmdOutlinesGet(parsed: ParsedArgs): Promise<number> {
  const [, sessionId] = parsed.positional;
  if (!sessionId) {
    printUsage();
    return 2;
  }
  const r = await getOutline(sessionId);
  if (!r) {
    process.stderr.write(`No outline persisted for session: ${sessionId}\n`);
    return 1;
  }
  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  } else {
    process.stdout.write(formatOutline(r));
  }
  return 0;
}

async function cmdOutlinesDelete(parsed: ParsedArgs): Promise<number> {
  const [, sessionId] = parsed.positional;
  if (!sessionId) {
    printUsage();
    return 2;
  }
  await deleteOutline(sessionId);
  process.stdout.write(`deleted outline for ${sessionId}\n`);
  return 0;
}

async function cmdOutlines(parsed: ParsedArgs): Promise<number> {
  const sub = parsed.positional[0];
  switch (sub) {
    case undefined:
    case 'list':
      return cmdOutlinesList(parsed);
    case 'get':
      return cmdOutlinesGet(parsed);
    case 'delete':
    case 'rm':
      return cmdOutlinesDelete(parsed);
    default:
      process.stderr.write(`Unknown outlines subcommand: ${sub}\n`);
      printUsage();
      return 2;
  }
}

async function cmdSummariesList(parsed: ParsedArgs): Promise<number> {
  const filter: ListSummariesFilter = {};
  if (typeof parsed.flags.source === 'string') {
    filter.sourceSessionId = parsed.flags.source;
  }
  let records = await listSummaries(filter);

  const tool = parsed.flags.toolId;
  if (typeof tool === 'string' && tool !== 'all') {
    records = records.filter((r) => r.toolId === tool);
  }

  const sinceCutoff = parseSinceFlag(parsed.flags.since);
  if (sinceCutoff !== null) {
    records = records.filter(
      (r) => new Date(r.createdAt).getTime() >= sinceCutoff,
    );
  }

  const search = parsed.flags.search;
  if (typeof search === 'string' && search.trim()) {
    const q = search.trim().toLowerCase();
    records = records.filter((r) => buildSearchHaystack(r).includes(q));
  }

  const sortMode = parsed.flags.sort;
  if (sortMode === 'oldest') {
    records.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  } else if (sortMode === 'cacheHit') {
    records.sort((a, b) => {
      const ar = a.summary.cacheInvariants?.prefixPreservedRatio ?? -1;
      const br = b.summary.cacheInvariants?.prefixPreservedRatio ?? -1;
      if (br !== ar) return br - ar;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } else {
    records.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }

  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
  } else {
    process.stdout.write(formatSummaryRows(records));
  }
  return 0;
}

async function cmdSummariesGet(parsed: ParsedArgs): Promise<number> {
  const [, id] = parsed.positional;
  if (!id) {
    printUsage();
    return 2;
  }
  const record = await getSummary(id);
  if (!record) {
    process.stderr.write(`No summary with id: ${id}\n`);
    return 1;
  }
  if (parsed.flags.json === true) {
    process.stdout.write(`${JSON.stringify(record, null, 2)}\n`);
  } else {
    const ts = new Date(record.createdAt).toLocaleString();
    process.stdout.write(
      `# ${record.summary.oneLiner}\n` +
        `${ts} · ${record.toolId} · ${record.cwd}\n\n` +
        `${prettyPrint(record.summary)}\n`,
    );
  }
  return 0;
}

async function cmdSummariesDelete(parsed: ParsedArgs): Promise<number> {
  const [, id] = parsed.positional;
  if (!id) {
    printUsage();
    return 2;
  }
  await deleteSummary(id);
  process.stdout.write(`deleted ${id}\n`);
  return 0;
}

async function cmdSummaries(parsed: ParsedArgs): Promise<number> {
  const sub = parsed.positional[0];
  switch (sub) {
    case undefined:
    case 'list':
      return cmdSummariesList(parsed);
    case 'get':
      return cmdSummariesGet(parsed);
    case 'delete':
    case 'rm':
      return cmdSummariesDelete(parsed);
    default:
      process.stderr.write(`Unknown summaries subcommand: ${sub}\n`);
      printUsage();
      return 2;
  }
}

async function main(): Promise<number> {
  const parsed = parseArgs(process.argv.slice(2));
  switch (parsed.command) {
    case 'branch':
      return cmdBranch(parsed);
    case 'capability':
      return cmdCapability(parsed.positional[0] ?? '');
    case 'runners':
      return cmdRunners();
    case 'projects':
      return cmdProjects(parsed);
    case 'sessions':
      return cmdSessions(parsed);
    case 'outline':
      return cmdOutline(parsed);
    case 'annotate':
      return cmdAnnotate(parsed);
    case 'outlines':
      return cmdOutlines(parsed);
    case 'summaries':
      return cmdSummaries(parsed);
    case '':
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      return parsed.command ? 0 : 2;
    default:
      process.stderr.write(`Unknown command: ${parsed.command}\n`);
      printUsage();
      return 2;
  }
}

main().then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(
      `unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exit(1);
  },
);
