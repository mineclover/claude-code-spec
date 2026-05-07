#!/usr/bin/env node
/**
 * Standalone CLI for the cli-runner package.
 *
 * Same fork-and-summarize machinery as the Electrobun bun host, but
 * callable directly from the terminal so we can test runners without
 * standing up the GUI:
 *
 *   cli-runner branch claude <SESSION_ID> --cwd /path/to/project
 *   cli-runner branch codex  <SESSION_ID> --language ko
 *   cli-runner branch gemini <SESSION_ID> --json
 *   cli-runner capability claude
 *   cli-runner runners
 *
 * Progress events are streamed to stderr; the final SummaryResult goes
 * to stdout — pretty by default, raw JSON with `--json`.
 */

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
  cli-runner branch <toolId> <sessionId> [options]
  cli-runner capability <toolId>
  cli-runner runners

branch options
  --cwd <path>          Source session's cwd (defaults to process.cwd())
  --language <en|ko>    Output language for the model narrative (default: en)
  --prompt <text>       Operator prompt appended to the canonical template
  --json                Emit the SummaryResult as raw JSON
  --no-progress         Suppress progress events on stderr

Examples
  cli-runner runners
  cli-runner capability claude
  cli-runner branch claude 7f4e1a... --cwd ~/work/repo --language ko
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

  const cwd =
    typeof parsed.flags.cwd === 'string' ? parsed.flags.cwd : process.cwd();
  const lang = parsed.flags.language;
  if (lang !== undefined && !isLanguage(lang)) {
    process.stderr.write(`Invalid --language (en|ko): ${String(lang)}\n`);
    return 2;
  }
  const promptOverride =
    typeof parsed.flags.prompt === 'string' ? parsed.flags.prompt : undefined;
  const showProgress = parsed.flags['no-progress'] !== true;
  const json = parsed.flags.json === true;

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
