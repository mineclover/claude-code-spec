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
  ProjectListItem,
  SessionMetaView,
  SummaryRecord,
} from '@context-action/session-core';
import { getRunner } from './index';
import type { ForkContext, ForkProgress, SummaryLanguage } from './types';

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command = '', ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (!arg) continue;
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = rest[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positional.push(arg);
    }
  }
  return { command, positional, flags };
}

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

function isLanguage(value: unknown): value is SummaryLanguage {
  return value === 'en' || value === 'ko';
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

function isToolId(value: string): value is ForkContext['toolId'] {
  return value === 'claude' || value === 'codex' || value === 'gemini';
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

function formatProjects(projects: readonly ProjectListItem[]): string {
  if (projects.length === 0) return '(no projects)\n';
  const rows = projects.map((p) => {
    const last = p.lastSeenAt
      ? new Date(p.lastSeenAt).toISOString().slice(0, 19).replace('T', ' ')
      : '            ';
    return `${p.toolId ?? '?  '.padEnd(6)}\t${p.sessionCount.toString().padStart(4)}\t${last}\t${p.id}\t${p.path}`;
  });
  return `${[
    'TOOL\t   N\tLAST_SEEN          \tID\tPATH',
    ...rows,
  ].join('\n')}\n`;
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

function formatSessions(sessions: readonly SessionMetaView[]): string {
  if (sessions.length === 0) return '(no sessions)\n';
  const rows = sessions.map((s) => {
    const m = s.metrics;
    const ratio = `${(m.cacheHitRatio * 100).toFixed(1).padStart(5)}%`;
    const last = s.lastModifiedMs
      ? new Date(s.lastModifiedMs).toISOString().slice(0, 19).replace('T', ' ')
      : '                   ';
    return `${(s.toolId ?? '?').padEnd(6)}\t${ratio}\t${(m.turns ?? 0)
      .toString()
      .padStart(4)}\t${last}\t${s.sessionId}`;
  });
  return `${[
    'TOOL  \t HIT %\tTURNS\tLAST_SEEN          \tSESSION_ID',
    ...rows,
  ].join('\n')}\n`;
}

function parseSinceFlag(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw === 'all' || raw === '') return null;
  const m = raw.match(/^(\d+)(s|m|h|d)$/);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    const unit = m[2]!;
    const ms =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return Date.now() - n * ms;
  }
  // Convenience aliases
  if (raw === 'today') return Date.now() - 86_400_000;
  if (raw === 'week') return Date.now() - 7 * 86_400_000;
  if (raw === 'month') return Date.now() - 30 * 86_400_000;
  return null;
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

function buildSearchHaystack(r: SummaryRecord): string {
  const parts: string[] = [
    r.summary.oneLiner,
    r.summary.narrative,
    r.cwd,
    r.toolId,
  ];
  for (const d of r.summary.keyDecisions) {
    parts.push(d.title);
    if (d.rationale) parts.push(d.rationale);
  }
  for (const ref of r.summary.references) {
    parts.push(ref.target);
    if (ref.note) parts.push(ref.note);
  }
  for (const o of r.summary.openItems) parts.push(o.question);
  for (const n of r.summary.nextActions) {
    if (n.label) parts.push(n.label);
    parts.push(n.prompt);
  }
  return parts.join(' \n ').toLowerCase();
}

function formatSummaryRows(records: readonly SummaryRecord[]): string {
  if (records.length === 0) return '(no summaries)\n';
  const rows = records.map((r) => {
    const ts = new Date(r.createdAt).toISOString().slice(0, 19).replace('T', ' ');
    const ratio = r.summary.cacheInvariants?.prefixPreservedRatio;
    const ratioStr =
      ratio == null ? '   - ' : `${(ratio * 100).toFixed(1).padStart(5)}%`;
    const lang = r.language ?? '  ';
    return `${ts}\t${r.toolId.padEnd(6)}\t${lang.padEnd(2)}\t${ratioStr}\t${r.id}\t${r.summary.oneLiner}`;
  });
  return `${[
    'CREATED            \tTOOL  \tLNG\t HIT %\tID                                  \tONE_LINER',
    ...rows,
  ].join('\n')}\n`;
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

function prettyPrint(summary: import('@context-action/session-core').SummaryResult): string {
  const lines: string[] = [];
  lines.push(`# ${summary.oneLiner}`);
  lines.push('');
  lines.push(summary.narrative);
  const ci = summary.cacheInvariants;
  if (ci) {
    lines.push('');
    lines.push(
      `prefix preserved ${(ci.prefixPreservedRatio * 100).toFixed(1)}% · cache_read=${ci.cacheReadTokens} · cache_creation=${ci.cacheCreationTokens} · input=${ci.inputTokens}`,
    );
  }
  if (summary.keyDecisions.length) {
    lines.push('');
    lines.push('Key decisions:');
    for (const d of summary.keyDecisions) {
      lines.push(`  - ${d.title}${d.status ? ` [${d.status}]` : ''}`);
      if (d.rationale) lines.push(`    ${d.rationale}`);
    }
  }
  if (summary.references.length) {
    lines.push('');
    lines.push('References:');
    for (const r of summary.references) {
      lines.push(
        `  - ${r.kind ? `(${r.kind}) ` : ''}${r.target}${r.note ? ` — ${r.note}` : ''}`,
      );
    }
  }
  if (summary.openItems.length) {
    lines.push('');
    lines.push('Open items:');
    for (const o of summary.openItems) {
      lines.push(`  - ${o.question}${o.anchor ? ` [${o.anchor}]` : ''}`);
    }
  }
  if (summary.nextActions.length) {
    lines.push('');
    lines.push('Next actions:');
    for (const n of summary.nextActions) {
      lines.push(`  - ${n.label ?? 'prompt'}: ${n.prompt}`);
    }
  }
  return lines.join('\n');
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
