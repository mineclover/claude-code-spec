# @context-action/cli-runner

Cache-preserving fork-and-summarize / fork-and-annotate runners for Claude /
Codex / Gemini sessions. Drives an existing CLI session via its native
fork mechanism (claude `--fork-session`, codex `app-server.thread/fork`,
gemini prompt-serialize) and produces structured output the host can persist.

Used by:

- `packages/session-core/server/summary-store` — stores summary results
- `apps/session-viewer` — Branch & Summarize and Outline → Annotate flows
- `cli-runner` (the standalone CLI binary in `src/cli.ts`)

## Public surface

```ts
import {
  // Agent registry — single dispatch table
  RUNNER_AGENTS,
  getRunnerAgent,         // entry by AgentId
  getSummarizeRunner,     // alias for `getRunner` legacy callers
  makeAnnotatorPrimitive, // factory; throws for non-viable agents

  // Summarize runners — produce a SummaryResult
  claudeRunner,
  codexRunner,
  geminiRunner,
  getRunner,              // legacy alias of getSummarizeRunner

  // Outline annotator — fills 1-line description tags
  annotateOutline,        // outer iterative loop

  // Prompts / parsers
  buildSummarizePrompt,
  parseModelOutput,       // SummaryResult JSON
  parseAnnotateBatch,     // {descriptions: {[idx]: tag}}

  // Errors
  RunnerUnavailableError,
  ForkPrerequisiteError,
  ModelOutputParseError,
} from '@context-action/cli-runner';
```

## Layout — common vs per-agent

Per-agent code lives under `src/agents/<id>/`; agent-agnostic code
lives in the package root.

```
src/
  agents/
    types.ts        ← AnnotatorPrimitive interface, batch I/O, JSON Schema
    registry.ts     ← RUNNER_AGENTS table (runner + annotator factory)
    claude/
      runner.ts     ← claudeRunner (CliRunner) + spawn helpers
      annotator.ts  ← ClaudePrimitive
    codex/
      runner.ts     ← codexRunner (CliRunner)
      annotator.ts  ← CodexPrimitive
      appServer.ts  ← CodexAppServerClient (JSON-RPC stdio)
    gemini/
      runner.ts     ← geminiRunner — no annotator (prompt-serialize
                       loses prefix bytes)
  annotateRunner.ts ← outer iterative loop (agent-agnostic)
  prompts.ts        ← summarize prompt template
  parseModelOutput.ts
  parseAnnotateBatch.ts
  jsonBlockExtractor.ts
  types.ts          ← CliRunner / ForkContext / errors (agent-agnostic)
  cli.ts
```

`agents/registry.ts` is the single dispatch table:

```ts
const claudeRunnerAgent: RunnerAgentDefinition = {
  id: 'claude',
  summarizeRunner: claudeRunner,
  annotator: { create: ({sourceSessionId, cwd}) => new ClaudePrimitive(...) },
};
```

`gemini.annotator.create` returns `null` — explicit signal that
gemini's prompt-serialize fork can't preserve cache prefix bytes,
so iterative annotation isn't viable. `makeAnnotatorPrimitive` turns
that null into a descriptive error so callers don't have to special-
case gemini at every dispatch site.

To add a new agent see [`docs/agent-development-guide.md`](../../docs/agent-development-guide.md).

## Two cache-preserving fork shapes

Each CLI exposes a slightly different prefix-preservation primitive:

| CLI    | Mechanic                                                           |
| ------ | ------------------------------------------------------------------ |
| Claude | `claude --resume <id> --fork-session --tools "" --max-turns 1`     |
| Codex  | `codex app-server` JSON-RPC: `thread/fork --ephemeral` then `turn/start` |
| Gemini | Read session JSON, prompt-serialize a fresh `gemini -p`. **No prefix preserved** by construction. |

The summarize runner produces a uniform `SummaryResult` regardless of which
CLI was used. The annotator currently supports Claude and Codex; Gemini is
explicitly rejected because the prompt-serialize approach defeats the point
of cache preservation.

## Codex app-server

`packages/cli-runner/src/codexAppServer.ts` is a thin TypeScript JSON-RPC
client modeled after [openai/symphony's `app_server.ex`](https://github.com/openai/symphony/blob/main/elixir/lib/symphony_elixir/codex/app_server.ex)
(see `references/symphony-codex-app-server.md`). It speaks just enough of
the protocol to drive `initialize → thread/fork → turn/start → turn/completed`,
auto-denying every reverse-RPC approval so the annotator's locked-down
sandbox doesn't deadlock on user-input prompts.

When new methods are needed, run `codex app-server generate-ts --out <DIR>`
to regenerate the official bindings against your installed codex version.

## Annotator architecture

```
annotateOutline(outline, cwd, options)
   ├─ makeAnnotatorPrimitive(toolId)   ← claude or codex impl
   ├─ primitive.prepare()
   ├─ for batch in unfilled_steps:
   │     primitive.forkAndAnnotate({ prompt, outputSchema })
   │        └─ claude: spawn `claude --resume --fork-session ...`
   │        └─ codex:  client.request('thread/fork') → client.runTurn(...)
   │     parse + merge descriptions
   └─ primitive.shutdown()
```

The outer loop (batching, prior-tag context, retry-on-malformed,
maxAttempts cap) is shared. Per-CLI mechanics live behind
`AnnotatorPrimitive` in `annotatorPrimitive.ts`.

## Standalone CLI

`scripts/install-bin.mjs` installs a `cli-runner` symlink at
`~/.local/bin/cli-runner`. Subcommands include:

```
cli-runner runners
cli-runner projects [--toolId X]
cli-runner sessions <projectId>
cli-runner branch <toolId> <sessionId> [--language en|ko]
cli-runner outline <toolId> <sessionId> [--segments-only]
cli-runner annotate <toolId> <sessionId> [--batch-size N] [--max-attempts N]
cli-runner outlines list|get|delete
cli-runner summaries list|get|delete
```

Run `cli-runner help` for the full surface.

## Testing

```bash
npm test --workspace=packages/cli-runner
```

Codex JSON-RPC integration tests use a stub server at
`test-fixtures/fake-codex-app-server.mjs` so they never depend on a real
codex install. Annotator outer-loop tests inject a deterministic stub
primitive — production `claudeRunner` / `codexRunner` paths require live
binaries and are exercised manually.
