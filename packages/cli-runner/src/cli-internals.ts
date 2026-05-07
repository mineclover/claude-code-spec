/**
 * Pure helpers extracted from `cli.ts` so they can be unit-tested
 * without spawning the CLI process. The cli entrypoint stays a thin
 * wrapper around these functions.
 *
 * Nothing here touches the filesystem, network, or process.argv —
 * everything is a deterministic transform on its arguments.
 */

import type {
  ProjectListItem,
  SessionMetaView,
  SummaryRecord,
  SummaryResult,
} from '@context-action/session-core';

export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Minimal CLI argument parser. Recognises:
 *   --flag=value      sets a string
 *   --flag value      sets a string when value doesn't itself look like a flag
 *   --flag            sets a boolean true (no value follows, or next is --…)
 *
 * Positional arguments accumulate in order. Returns `{command, positional,
 * flags}`; consumers route on `command` and read flags by name.
 */
export function parseArgs(argv: readonly string[]): ParsedArgs {
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

/**
 * Resolve `--since` flag values to a unix-ms cutoff.
 *
 * Accepts:
 *   - duration shorthand: `30s`, `5m`, `2h`, `7d`
 *   - aliases: `today` (24h), `week` (7d), `month` (30d)
 *   - `all` / undefined / non-string → null (no cutoff)
 *
 * Caller compares records' createdAt against the returned epoch-ms; null
 * means "don't filter on date." `Date.now()` is read at call time so the
 * cutoff is always relative to the current run.
 */
export function parseSinceFlag(raw: unknown): number | null {
  if (typeof raw !== 'string' || raw === 'all' || raw === '') return null;
  const m = raw.match(/^(\d+)(s|m|h|d)$/);
  if (m) {
    const n = Number.parseInt(m[1]!, 10);
    const unit = m[2]!;
    const ms =
      unit === 's' ? 1000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return Date.now() - n * ms;
  }
  if (raw === 'today') return Date.now() - 86_400_000;
  if (raw === 'week') return Date.now() - 7 * 86_400_000;
  if (raw === 'month') return Date.now() - 30 * 86_400_000;
  return null;
}

/**
 * Concatenate every searchable field of a SummaryRecord into one
 * lowercased string for substring matching. Mirrors the renderer's
 * search behaviour so a `--search "outbox"` from the CLI hits the same
 * records as typing "outbox" into the GUI's filter.
 */
export function buildSearchHaystack(r: SummaryRecord): string {
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

const TOOL_IDS = ['claude', 'codex', 'gemini'] as const;
type ToolId = (typeof TOOL_IDS)[number];

export function isToolId(value: string): value is ToolId {
  return (TOOL_IDS as readonly string[]).includes(value);
}

export function isLanguage(value: unknown): value is 'en' | 'ko' {
  return value === 'en' || value === 'ko';
}

export function formatProjects(projects: readonly ProjectListItem[]): string {
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

export function formatSessions(sessions: readonly SessionMetaView[]): string {
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

export function formatSummaryRows(records: readonly SummaryRecord[]): string {
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

/**
 * Operator-friendly rendering of a SummaryResult: headline + narrative
 * + grouped sections with bullet lists. Matches what `cli-runner branch`
 * prints to stdout when `--json` isn't passed.
 */
export function prettyPrint(summary: SummaryResult): string {
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
