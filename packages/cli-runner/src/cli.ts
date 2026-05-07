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
  resolveSession,
} from '@context-action/session-core/server/readers';
import {
  deleteSummary,
  getSummary,
  listSummaries,
  saveSummary,
} from '@context-action/session-core/server/summary-store';
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
