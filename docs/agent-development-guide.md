# Agent Development Guide

How to add a new CLI agent (or extend an existing one) without
touching every consumer in the tree.

## Vocabulary

| Term         | Meaning                                                                |
| ------------ | ---------------------------------------------------------------------- |
| **Agent**    | One supported CLI assistant: `claude`, `codex`, or `gemini`.           |
| **Reader**   | Pulls a session's raw bytes off disk for that agent.                   |
| **Outline**  | Translates raw bytes into a `SessionOutline` (steps + segments).       |
| **Runner**   | Drives a Branch & Summarize fork; produces a `SummaryResult`.          |
| **Annotator primitive** | Drives one batch of the iterative outline annotator.        |
| **Registry** | Per-package table mapping `AgentId` → that package's per-agent code.   |

## Layout — everything for one agent in one place

Each package collects per-agent code under `agents/<id>/`. The
session-core layer holds **data** (where on disk, how to parse it);
the cli-runner layer holds **runtime mechanics** (how to spawn the
CLI, how to fork, how to drain notifications).

```
packages/session-core/src/
  agents/
    types.ts             ← AgentId, AgentReader, AgentOutlineExtractor
    registry.ts          ← AGENTS table (reader + extractor) + loadOutlineForSession
    claude/
      reader.ts          ← scanAll + readClaudeSessionRaw
      outline.ts         ← extractClaudeOutline
      outline.test.ts
    codex/
      reader.ts          ← scanAll + readCodexSessionRaw
      outline.ts         ← extractCodexOutline
      outline.test.ts
    gemini/
      reader.ts          ← scanAll + readGeminiSessionRaw
      outline.ts         ← extractGeminiOutline
      outline.test.ts
  outline/
    types.ts             ← SessionOutline / SessionStep / SessionSegment
    grouping.ts          ← groupIntoSegments (agent-agnostic)
    annotate-schema.ts   ← prompt builder + Zod schema (agent-agnostic)
  server/
    readers/types.ts     ← CliSessionReader interface
    session-reader.ts    ← multi-agent project aggregator
    summary-store.ts
    outline-store.ts

packages/cli-runner/src/
  agents/
    types.ts             ← AnnotatorPrimitive interface, batch I/O, JSON Schema
    registry.ts          ← RUNNER_AGENTS table (runner + annotator factory)
    registry.test.ts
    claude/
      runner.ts          ← claudeRunner (CliRunner) + spawn helpers
      annotator.ts       ← ClaudePrimitive
    codex/
      runner.ts          ← codexRunner (CliRunner)
      annotator.ts       ← CodexPrimitive
      appServer.ts       ← CodexAppServerClient (JSON-RPC stdio)
      appServer.test.ts
    gemini/
      runner.ts          ← geminiRunner (CliRunner)
                            (no annotator — prompt-serialize loses prefix)
  annotateRunner.ts      ← outer iterative loop, agent-agnostic
  annotateRunner.test.ts
  prompts.ts             ← summarize prompt template
  parseModelOutput.ts    ← SummaryResult JSON parser
  parseAnnotateBatch.ts  ← annotation batch JSON parser
  jsonBlockExtractor.ts  ← shared "find first balanced {…}" helper
  types.ts               ← CliRunner / ForkContext / errors
  cli.ts                 ← standalone CLI dispatch (uses registries)
```

## Common interfaces — what every agent must satisfy

### 1. Data layer (`session-core/src/agents/types.ts`)

```ts
export type AgentId = 'claude' | 'codex' | 'gemini';

export interface AgentReader {
  readSessionRaw(sessionId: string, cwd: string): Promise<string | null>;
}

export interface AgentOutlineExtractor {
  extract(args: {
    raw: string;
    sourceSessionId: string;
    cwd: string;
    language?: 'en' | 'ko';
  }): SessionOutline;
}

export interface AgentDefinition {
  id: AgentId;
  reader: AgentReader;
  outline: AgentOutlineExtractor;
}
```

Plus `CliSessionReader` (also in `agents/types.ts`) for the
project-level scan that powers the multi-agent project list.

### 2. Runtime layer (`cli-runner/src/agents/types.ts`)

```ts
export interface AnnotatorPrimitive {
  toolId: AgentId;
  prepare(): Promise<void>;
  forkAndAnnotate(input: AnnotateBatchInput): Promise<AnnotateBatchResult>;
  shutdown(): Promise<void>;
}
```

Plus `CliRunner` (under `cli-runner/src/types.ts`) for the
Branch & Summarize fork.

## Common vs specialization — what goes where

| Concern                              | Lives in                                         |
| ------------------------------------ | ------------------------------------------------ |
| Step kind enum, segment shape        | `outline/types.ts` (common)                      |
| User-instruction boundary algorithm  | `outline/grouping.ts` (common)                   |
| Annotator prompt template + schema   | `outline/annotate-schema.ts` (common)            |
| Annotator batch loop + retry logic   | `cli-runner/annotateRunner.ts` (common)          |
| JSON fragment extraction             | `cli-runner/jsonBlockExtractor.ts` (common)      |
| **CLI storage layout, file format**  | `agents/<id>/reader.ts` (specialization)         |
| **Wire-format event classification** | `agents/<id>/outline.ts` (specialization)        |
| **Fork CLI flags / RPC protocol**    | `agents/<id>/runner.ts` + `annotator.ts` (specialization) |

The rule of thumb: anything that depends on the wire format of one
specific CLI is specialization. Anything that operates on the
universal `SessionOutline` / `SummaryResult` shapes is common.

## Adding a new agent — checklist

Suppose you're adding `chatgpt` (hypothetical fourth agent).

1. **Pick the AgentId**

   Edit `session-core/src/agents/types.ts`:
   ```diff
   -export type AgentId = 'claude' | 'codex' | 'gemini';
   +export type AgentId = 'claude' | 'codex' | 'gemini' | 'chatgpt';
   -export const AGENT_IDS: readonly AgentId[] = ['claude', 'codex', 'gemini'] as const;
   +export const AGENT_IDS: readonly AgentId[] = ['claude', 'codex', 'gemini', 'chatgpt'] as const;
   // also extend isAgentId()
   ```

   TypeScript will now flag every dispatch site that doesn't handle
   the new id. The registry tables are exhaustive `Record<AgentId, …>`,
   so the next steps are forced into the right places.

2. **Implement the reader + outline extractor** in
   `session-core/src/agents/chatgpt/`:
   - `reader.ts`: implements both `scanAll(): Promise<ProjectScan[]>`
     and `readSessionRaw(sessionId, cwd): Promise<string | null>`.
   - `outline.ts`: implements `extract({raw, sourceSessionId, cwd,
     language}): SessionOutline`.
   - Tests live alongside.

3. **Register in the data layer** —
   `session-core/src/agents/registry.ts`:
   ```ts
   import { extractChatgptOutline } from './chatgpt/outline';
   import { readChatgptSessionRaw } from './chatgpt/reader';
   const chatgptAgent: AgentDefinition = {
     id: 'chatgpt',
     reader: { readSessionRaw: readChatgptSessionRaw },
     outline: { extract: extractChatgptOutline },
   };
   export const AGENTS = { ..., chatgpt: chatgptAgent } as const;
   ```

4. **Implement the runner + annotator primitive** in
   `cli-runner/src/agents/chatgpt/`:
   - `runner.ts`: a `CliRunner` for Branch & Summarize.
   - `annotator.ts`: an `AnnotatorPrimitive` (or skip if the CLI has
     no cache-preserving fork).

5. **Register in the runtime layer** —
   `cli-runner/src/agents/registry.ts`:
   ```ts
   import { chatgptRunner } from './chatgpt/runner';
   import { ChatgptPrimitive } from './chatgpt/annotator';
   const chatgptRunnerAgent: RunnerAgentDefinition = {
     id: 'chatgpt',
     summarizeRunner: chatgptRunner,
     annotator: {
       create: ({ sourceSessionId, cwd }) =>
         new ChatgptPrimitive(sourceSessionId, cwd),
     },
   };
   export const RUNNER_AGENTS = { ..., chatgpt: chatgptRunnerAgent } as const;
   ```

   If annotation isn't viable (e.g. no cache-preserving fork), set
   `annotator: { create: () => null }`. `makeAnnotatorPrimitive`
   translates the null into a descriptive error at the call site.

6. **Multi-agent reader list** —
   `session-core/src/server/session-reader.ts` collects readers for
   the project list. Add the new reader to the `READERS` array.

7. **Done.** Both the standalone CLI (`cli-runner outline chatgpt …`,
   `cli-runner annotate chatgpt …`) and the GUI's Outline tab work
   automatically — they delegate everything through the registries.

## Test conventions

- Reader / outline tests use hand-rolled fixture strings (no real
  filesystem dependency). See `agents/codex/outline.test.ts` for the
  pattern.
- The codex JSON-RPC client is tested against a stub server at
  `cli-runner/test-fixtures/fake-codex-app-server.mjs` instead of a
  real `codex` binary. New agents with persistent-protocol clients
  should follow the same pattern.
- Annotator behavior is tested with an injected stub primitive
  (`annotateRunner.test.ts`); production runners require live CLIs
  and are exercised manually.

## Why two registries (and not one)

Could be one `AGENTS[id]` with reader + outline + runner + annotator.
Kept separate because:

- The data layer is browser-importable (the renderer builds outlines
  in the future). The runtime layer pulls `node:child_process` and
  must stay server-side.
- Updating one without the other should not require touching the
  combined table; e.g. swapping a reader for performance reasons
  shouldn't risk breaking the runner.
- The two layers have different release cadences (the data layer
  evolves with new step kinds; the runtime layer evolves with CLI
  protocol changes). Decoupled tables let those proceed independently.

## What you should NOT do

- **Add a `switch (toolId)` outside `agents/`.** Both CLI and bun
  handlers go through the registries; the only `switch` left is in
  `cli.ts` for agent-specific error hints, and even that uses the
  registry for the actual lookup.
- **Reach into `agents/<id>/` from another agent's directory.** They
  must be peers — coupling them creates a "claude needs codex" load
  order problem, and the abstraction collapses.
- **Mix agent-agnostic code into `agents/<id>/`.** If two agents need
  the same helper, it belongs in the package's common area
  (`outline/grouping.ts`, `cli-runner/jsonBlockExtractor.ts`, etc.).
