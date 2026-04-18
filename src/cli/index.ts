/**
 * Node-only CLI for the core services (no Electron dependency).
 *
 * Intentionally avoids any module that transitively imports `electron` or
 * `settingsService`, so it runs in plain Node (via `tsx`) and in CI. The
 * commands here delegate to the same pure services the Electron main process
 * uses — FingerprintService, SessionAnalyticsService, McpResolverService,
 * shellPath — plus a small inline sidecar reader that bypasses
 * SessionMetaStore (which chains into Electron).
 *
 * Run:
 *   npm run cli -- <command> [args]
 *
 * Commands:
 *   analyze      --claude-dir <dir>                                 [--json]
 *   session      --file <jsonl>                                     [--json] [--raw]
 *   fingerprint  --project <path> [--mcp <config>]                  [--json]
 *   groups       --claude-dir <dir>                                 [--json]
 *   mcp-resolve  --project <path> [--add a,b] [--remove c,d]        [--json]
 *   mcp-registry --project <path>                                   [--json]
 *   legend
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fingerprintService } from '../services/FingerprintService';
import { mcpResolverService } from '../services/McpResolverService';
import { sessionAnalyticsService } from '../services/SessionAnalyticsService';
import type { McpExecutionOverride } from '../types/mcp-policy';
import type { DerivedSessionMeta, SessionMeta } from '../types/prefix-fingerprint';

// ---------- argv parsing (no deps) ----------

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

/**
 * Flags that never take a value. Listed explicitly so `--json extra` parses
 * `json` as boolean and `extra` as a positional, instead of treating `extra`
 * as the value of `--json`.
 */
const BOOLEAN_FLAGS: ReadonlySet<string> = new Set(['json', 'raw', 'help']);

function parseArgs(argv: readonly string[]): ParsedArgs {
  const [command, ...rest] = argv;
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(token);
    }
  }
  return { command: command ?? '', positional, flags };
}

function flagString(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === 'string' ? v : undefined;
}

/**
 * Parse a comma-separated flag value into a trimmed list of non-empty strings.
 * Returns an empty array when the flag is missing or boolean.
 */
function flagStringList(flags: Record<string, string | boolean>, key: string): string[] {
  const v = flags[key];
  if (typeof v !== 'string') return [];
  return v
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------- pure sidecar reader (bypasses SessionMetaStore → Electron) ----------

function readSidecar(filePath: string): SessionMeta | null {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as SessionMeta;
    return parsed?.sessionId ? parsed : null;
  } catch {
    return null;
  }
}

function readAllSidecars(claudeProjectDir: string): Map<string, SessionMeta> {
  const result = new Map<string, SessionMeta>();
  let entries: string[];
  try {
    entries = fs.readdirSync(claudeProjectDir);
  } catch {
    return result;
  }
  for (const entry of entries) {
    if (!entry.endsWith('.meta.json')) continue;
    const meta = readSidecar(path.join(claudeProjectDir, entry));
    if (meta) result.set(meta.sessionId, meta);
  }
  return result;
}

// ---------- formatting ----------

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1).padStart(5)}%`;
}

function formatModel(model: string | null | undefined): string {
  if (!model) return '-';
  return model.replace(/^claude-/, '');
}

function shortHash(hex: string): string {
  return hex.slice(0, 10);
}

// ---------- commands ----------

function cmdLegend(): void {
  process.stdout.write(
    [
      'Dot legend (Sessions page):',
      '  color          same color  = same fingerprint group (same model + tool set)',
      '  solid fill     sidecar     (app-driven execution, high fidelity)',
      '  hollow ring    derived     (extracted from JSONL, approximate)',
      '  dashed         no meta     (derivation failed)',
      'Fewer groups in a project means prefix reuse is better.',
      '',
    ].join('\n'),
  );
}

function cmdAnalyze(args: ParsedArgs): number {
  const dir = flagString(args.flags, 'claude-dir');
  if (!dir) {
    process.stderr.write('analyze: --claude-dir <dir> required\n');
    return 2;
  }
  const sidecars = readAllSidecars(dir);
  const derived = sessionAnalyticsService.analyzeProjectDir(dir, {
    skipSessionIds: new Set(sidecars.keys()),
  });

  const rows: Array<{
    sessionId: string;
    source: 'sidecar' | 'derived';
    fingerprintHash: string;
    model: string | null;
    toolCount: number;
    cacheHitRatio: number;
    inputTokens: number;
    cacheReadInputTokens: number;
    costUsd: number;
    events?: number;
  }> = [];

  for (const [sessionId, meta] of sidecars) {
    rows.push({
      sessionId,
      source: 'sidecar',
      fingerprintHash: meta.fingerprint.static.total,
      model: null,
      toolCount: 0,
      cacheHitRatio: meta.metrics.cacheHitRatio,
      inputTokens: meta.metrics.inputTokens,
      cacheReadInputTokens: meta.metrics.cacheReadInputTokens,
      costUsd: meta.metrics.costUsd,
    });
  }
  for (const [sessionId, d] of derived) {
    rows.push({
      sessionId,
      source: 'derived',
      fingerprintHash: d.fingerprintHash,
      model: d.details.model,
      toolCount: d.details.tools.length,
      cacheHitRatio: d.metrics.cacheHitRatio,
      inputTokens: d.metrics.inputTokens,
      cacheReadInputTokens: d.metrics.cacheReadInputTokens,
      costUsd: d.metrics.costUsd,
      events: d.details.eventCount,
    });
  }

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
    return 0;
  }

  const groups = new Set(rows.map((r) => r.fingerprintHash));
  process.stdout.write(`Sessions: ${rows.length} · Groups: ${groups.size} · Dir: ${dir}\n\n`);
  process.stdout.write(
    `${'SESSION'.padEnd(10)}  ${'SRC'.padEnd(8)}  ${'GROUP'.padEnd(12)}  ${'MODEL'.padEnd(14)}  ${'CACHE'.padStart(6)}  ${'TOOLS'.padStart(5)}\n`,
  );
  for (const row of rows.sort((a, b) => (a.fingerprintHash < b.fingerprintHash ? -1 : 1))) {
    process.stdout.write(
      `${row.sessionId.slice(0, 8).padEnd(10)}  ${row.source.padEnd(8)}  ${shortHash(row.fingerprintHash).padEnd(12)}  ${formatModel(row.model).padEnd(14)}  ${formatPercent(row.cacheHitRatio)}  ${String(row.toolCount).padStart(5)}\n`,
    );
  }
  return 0;
}

function cmdSession(args: ParsedArgs): number {
  const file = flagString(args.flags, 'file');
  if (!file) {
    process.stderr.write('session: --file <jsonl> required\n');
    return 2;
  }
  const sessionId = path.basename(file, '.jsonl');
  if (args.flags.raw) {
    // Just dump the raw file content — useful for piping through jq etc.
    process.stdout.write(fs.readFileSync(file, 'utf-8'));
    return 0;
  }
  const meta: DerivedSessionMeta = sessionAnalyticsService.analyzeSessionFile(file, sessionId);
  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(meta, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`Session   : ${meta.sessionId}\n`);
  process.stdout.write(`Project   : ${meta.projectPath ?? '-'}\n`);
  process.stdout.write(`Model     : ${formatModel(meta.details.model)}\n`);
  process.stdout.write(`Events    : ${meta.details.eventCount}\n`);
  process.stdout.write(`Tools     : ${meta.details.tools.length}\n`);
  if (meta.details.tools.length > 0) {
    for (const tool of meta.details.tools) {
      process.stdout.write(`  - ${tool}\n`);
    }
  }
  process.stdout.write(`Fingerprint: ${meta.fingerprintHash}\n`);
  process.stdout.write(`Cache hit : ${formatPercent(meta.metrics.cacheHitRatio)}\n`);
  process.stdout.write(`Input     : ${meta.metrics.inputTokens}\n`);
  process.stdout.write(`Cache read: ${meta.metrics.cacheReadInputTokens}\n`);
  process.stdout.write(`Cost      : $${meta.metrics.costUsd.toFixed(4)}\n`);
  return 0;
}

function cmdFingerprint(args: ParsedArgs): number {
  const project = flagString(args.flags, 'project');
  if (!project) {
    process.stderr.write('fingerprint: --project <path> required\n');
    return 2;
  }
  const mcpConfigPath = flagString(args.flags, 'mcp') ?? null;
  const fp = fingerprintService.computeStatic({ projectPath: project, mcpConfigPath });
  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(fp, null, 2)}\n`);
    return 0;
  }
  process.stdout.write(`Project  : ${project}\n`);
  process.stdout.write(`MCP      : ${mcpConfigPath ?? '(none)'}\n`);
  process.stdout.write(`Total    : ${fp.total}\n\n`);
  for (const [key, hash] of Object.entries(fp.components)) {
    process.stdout.write(`  ${key.padEnd(20)} ${hash || '(empty)'}\n`);
  }
  process.stdout.write(`\nSources:\n`);
  process.stdout.write(`  claudeMd : ${fp.sources.claudeMdPath ?? '-'}\n`);
  process.stdout.write(`  imports  : ${fp.sources.importPaths.length}\n`);
  process.stdout.write(`  skills   : ${fp.sources.skillIds.length}\n`);
  process.stdout.write(`  agents   : ${fp.sources.agentIds.length}\n`);
  return 0;
}

function cmdGroups(args: ParsedArgs): number {
  const dir = flagString(args.flags, 'claude-dir');
  if (!dir) {
    process.stderr.write('groups: --claude-dir <dir> required\n');
    return 2;
  }
  const sidecars = readAllSidecars(dir);
  const derived = sessionAnalyticsService.analyzeProjectDir(dir, {
    skipSessionIds: new Set(sidecars.keys()),
  });
  const counts = new Map<string, { count: number; model: string | null; tools: number }>();
  for (const [, meta] of sidecars) {
    const key = meta.fingerprint.static.total;
    const current = counts.get(key) ?? { count: 0, model: null, tools: 0 };
    counts.set(key, { ...current, count: current.count + 1 });
  }
  for (const [, d] of derived) {
    const key = d.fingerprintHash;
    const current = counts.get(key) ?? {
      count: 0,
      model: d.details.model,
      tools: d.details.tools.length,
    };
    counts.set(key, { ...current, count: current.count + 1 });
  }
  if (args.flags.json) {
    process.stdout.write(
      `${JSON.stringify(
        Array.from(counts.entries()).map(([hash, v]) => ({ hash, ...v })),
        null,
        2,
      )}\n`,
    );
    return 0;
  }
  const sorted = Array.from(counts.entries()).sort((a, b) => b[1].count - a[1].count);
  process.stdout.write(`Groups: ${sorted.length}\n\n`);
  process.stdout.write(
    `${'GROUP'.padEnd(12)}  ${'COUNT'.padStart(5)}  ${'MODEL'.padEnd(14)}  TOOLS\n`,
  );
  for (const [hash, info] of sorted) {
    process.stdout.write(
      `${shortHash(hash).padEnd(12)}  ${String(info.count).padStart(5)}  ${formatModel(info.model).padEnd(14)}  ${info.tools}\n`,
    );
  }
  return 0;
}

function cmdMcpResolve(args: ParsedArgs): number {
  const project = flagString(args.flags, 'project');
  if (!project) {
    process.stderr.write('mcp-resolve: --project <path> required\n');
    return 2;
  }
  const override: McpExecutionOverride = {
    add: flagStringList(args.flags, 'add'),
    remove: flagStringList(args.flags, 'remove'),
  };
  const homeDir = flagString(args.flags, 'home');
  const registry = mcpResolverService.loadRegistry({ projectPath: project, homeDir });
  const policy = mcpResolverService.loadPolicy(project);
  const resolved = mcpResolverService.resolve({ registry, policy, override });

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(resolved, null, 2)}\n`);
    return 0;
  }

  const enabled = [...resolved.enabledServerIds].sort();
  const baseline = [...resolved.baselineServerIds].sort();
  const added = [...resolved.addedByOverride].sort();
  const removed = [...resolved.removedByOverride].sort();

  process.stdout.write(`Project: ${project}\n`);
  process.stdout.write(`Enabled (${enabled.length}): [${enabled.join(', ')}]\n`);
  process.stdout.write(`Baseline (${baseline.length}): [${baseline.join(', ')}]\n`);
  process.stdout.write(`Added by override: [${added.join(', ')}]\n`);
  process.stdout.write(`Removed by override: [${removed.join(', ')}]\n`);
  process.stdout.write(`Hash: ${resolved.hash}\n`);
  const disallowedStr = resolved.disallowed.map((d) => `${d.id} (${d.reason})`).join(', ');
  process.stdout.write(`Disallowed: [${disallowedStr}]\n`);
  return 0;
}

function cmdMcpRegistry(args: ParsedArgs): number {
  const project = flagString(args.flags, 'project');
  if (!project) {
    process.stderr.write('mcp-registry: --project <path> required\n');
    return 2;
  }
  const homeDir = flagString(args.flags, 'home');
  const registry = mcpResolverService.loadRegistry({ projectPath: project, homeDir });

  if (args.flags.json) {
    process.stdout.write(`${JSON.stringify(registry, null, 2)}\n`);
    return 0;
  }

  // Group entries by category. Untagged entries go into "(uncategorized)".
  const byCategory = new Map<string, typeof registry.entries>();
  for (const entry of registry.entries) {
    const key = entry.category ?? '(uncategorized)';
    const list = byCategory.get(key);
    if (list) {
      list.push(entry);
    } else {
      byCategory.set(key, [entry]);
    }
  }

  const sortedCategories = Array.from(byCategory.keys()).sort();
  process.stdout.write(`Registry entries: ${registry.entries.length}\n`);
  process.stdout.write(`  user:    ${registry.sources.userPath ?? '(none)'}\n`);
  process.stdout.write(`  project: ${registry.sources.projectPath ?? '(none)'}\n`);
  for (const category of sortedCategories) {
    process.stdout.write(`\n${category}:\n`);
    const entries = byCategory.get(category) ?? [];
    for (const entry of entries) {
      process.stdout.write(`  ${entry.id} [${entry.scope}] (${entry.command})\n`);
    }
  }
  return 0;
}

function cmdHelp(): void {
  process.stdout.write(
    [
      'Usage: npm run cli -- <command> [options]',
      '',
      'Commands:',
      '  analyze      --claude-dir <dir> [--json]',
      '  session      --file <jsonl> [--json] [--raw]',
      '  fingerprint  --project <path> [--mcp <config>] [--json]',
      '  groups       --claude-dir <dir> [--json]',
      '  mcp-resolve  --project <path> [--add id1,id2] [--remove id3,id4] [--json]',
      '  mcp-registry --project <path> [--json]',
      '  legend',
      '',
      'Environment:',
      '  CLAUDE_PROJECTS_DIR     default root, overridden by --claude-dir',
      `  (default: ${path.join(os.homedir(), '.claude', 'projects')})`,
      '',
    ].join('\n'),
  );
}

// ---------- entry ----------

function main(argv: readonly string[]): number {
  const args = parseArgs(argv);
  switch (args.command) {
    case 'analyze':
      return cmdAnalyze(args);
    case 'session':
      return cmdSession(args);
    case 'fingerprint':
      return cmdFingerprint(args);
    case 'groups':
      return cmdGroups(args);
    case 'mcp-resolve':
      return cmdMcpResolve(args);
    case 'mcp-registry':
      return cmdMcpRegistry(args);
    case 'legend':
      cmdLegend();
      return 0;
    case '':
    case 'help':
    case '-h':
    case '--help':
      cmdHelp();
      return 0;
    default:
      process.stderr.write(`Unknown command: ${args.command}\n`);
      cmdHelp();
      return 2;
  }
}

// Only run when invoked directly, not when imported (e.g. by tests).
const directInvoke = process.argv[1] && path.basename(process.argv[1]) === 'index.ts';
if (directInvoke || process.env.CLI_FORCE_RUN === '1') {
  process.exit(main(process.argv.slice(2)));
}

export { main, parseArgs };
