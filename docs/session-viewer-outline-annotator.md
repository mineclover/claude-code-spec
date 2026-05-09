# Session Viewer — Outline & Annotator

End-to-end developer guide for the outline-extraction and iterative-annotator
flow that spans `session-core`, `cli-runner`, and the `session-viewer` app.

> Audience: anyone extending the feature (new CLI extractor, new annotator
> backend, schema tweaks, GUI surface). For end-user docs see
> `apps/session-viewer/README.md`.

## Conceptual model

A **SessionOutline** is a structured decomposition of one CLI session into
discrete steps grouped into segments bounded by user instructions:

```
SessionOutline
├── steps[]      ← every meaningful event in source order
│   ├── kind     ← user-instruction | thinking | tool-call | tool-result | assistant-text | meta
│   ├── excerpt  ← up-to-600-char raw text from the source
│   └── description?  ← 1-line tag added by the annotator (optional)
├── segments[]   ← steps[] partitioned at user-instruction boundaries
└── annotation?  ← present when the iterative annotator has run
    ├── forks[]  ← per-batch fork audit (cache_read tokens, fork session id)
    └── remainingUntagged
```

Two phases produce this object:

1. **Extract**: read the on-disk session for a CLI (Claude / Codex / Gemini),
   classify events, group into segments. Pure deterministic transformation —
   no model involvement.
2. **Annotate**: iteratively fork the source session, ask the model for 1-line
   description tags on batches of unfilled steps, merge responses into the
   outline. Cache prefix is preserved so incremental forks are cheap.

The two phases are independent. An un-annotated outline is still useful (the
GUI's Outline tab renders it as a structure tree before any annotation runs).

## Phase 1 — Extract

```
session-core/src/outline/
  types.ts                 ← SessionOutline / SessionStep / SessionSegment
  extract.ts               ← extractClaudeOutline + groupIntoSegments
  extract-codex.ts         ← extractCodexOutline (response_item envelope)
  extract-gemini.ts        ← extractGeminiOutline (single JSON document)
```

Each per-CLI extractor consumes raw bytes via the matching reader:

```
session-core/src/server/readers/
  claudeReader.readClaudeSessionRaw(sessionId, cwd) → string | null
  codexReader.readCodexSessionRaw(sessionId, cwd)  → string | null
  geminiReader.readGeminiSessionRaw(sessionId, cwd) → string | null
```

The readers handle the storage-layout differences (claude's dash-encoded cwd
dir, codex's date-partitioned rollouts, gemini's sha256(cwd) tmp dir). The
extractors handle the wire-format differences. Both layers are independent of
the model, so adding a new CLI is `reader + extractor` and that's it.

### CLI shape gotchas

- **Claude**: a user-role message that contains only `tool_result` blocks is
  a tool-result step, not a new user-instruction. Otherwise tool-using turns
  would fragment into new segments at every tool call.
- **Codex**: pre-`event_msg.task_started` user messages are `AGENTS.md` /
  permissions boilerplate codex auto-injects; classify those as `meta`.
- **Gemini**: bundles `toolCalls[]` and their `result`s in one record; we
  split them into separate `tool-call` + `tool-result` steps for parity.

## Phase 2 — Annotate

```
cli-runner/src/
  annotateRunner.ts          ← outer iterative loop (CLI-agnostic)
  annotatorPrimitive.ts      ← per-CLI fork primitive interface + impls
  parseAnnotateBatch.ts      ← {descriptions: {[idx]: string}} parser
  jsonBlockExtractor.ts      ← shared JSON-fragment locator

session-core/src/outline/
  annotate-schema.ts         ← Zod schema + prompt builder (shared with bun)
```

### Outer loop (CLI-agnostic)

```
annotateOutline(outline, cwd, options)
  primitive ← makeAnnotatorPrimitive({toolId})
  await primitive.prepare()
  for attempt in 0..maxAttempts:
    unfilled  ← steps where description is empty
    if empty: break
    batch     ← unfilled[:batchSize]
    prompt    ← buildAnnotatePrompt({batch, alreadyDescribed, language})
    result    ← primitive.forkAndAnnotate({prompt, outputSchema})
    parsed    ← parseAnnotateBatch(result.rawText)
    merge parsed.descriptions into outline by step.index
    if no descriptions filled this round: break  ← bail-out
  await primitive.shutdown()
  return outline (with .annotation stamped)
```

Two safety rails: `maxAttempts` (default 5) caps total forks, and the
"zero-progress bail-out" stops cold when a batch came back empty (the model
is stuck — trying again won't help).

### Per-CLI primitives (`annotatorPrimitive.ts`)

| CLI    | prepare()                  | forkAndAnnotate(...)                   | shutdown()           |
| ------ | -------------------------- | -------------------------------------- | -------------------- |
| Claude | mkdir tmp + write empty MCP config | spawn `claude --resume <id> --fork-session --tools "" --max-turns 1` | rm tmp dir |
| Codex  | spawn `codex app-server`, `initialize`, `initialized` | `thread/fork --ephemeral` + `turn/start --outputSchema` | SIGTERM the app-server |
| Gemini | n/a — `makeAnnotatorPrimitive('gemini')` throws    | (not viable — prompt-serialize loses cache prefix)        | n/a                  |

Claude spawns one process per batch (its CLI doesn't expose a persistent
channel). Codex spawns one `app-server` for the whole run, then forks once
per batch — much cheaper.

### Codex `app-server` client

`cli-runner/src/codexAppServer.ts` is a thin TS JSON-RPC 2.0 client modeled
after [openai/symphony's `app_server.ex`](https://github.com/openai/symphony/blob/main/elixir/lib/symphony_elixir/codex/app_server.ex)
(see `references/symphony-codex-app-server.md`).

Wire layer:

```
client                          server (codex app-server)
  → initialize (id 1)               ← {capabilities}
  → initialized (notification)
  → thread/fork (id 2)              ← {thread: {id}}
  → turn/start (id 3)               ← {turn: {id}}
                                    ← turn/started notification
                                    ← item/completed (agentMessage)
                                    ← thread/tokenUsage/updated
                                    ← turn/completed
  → execCommandApproval (reverse)   ↔ auto-respond {decision: "denied"}
```

Reverse-RPC requests (approvals, user input prompts) are auto-denied because
the annotator runs with `approvalPolicy: "never"` and `sandboxPolicy:
{type: "readOnly"}` — the model can't actually use tools, so any approval
prompt is a misroute.

### Schema enforcement

`session-core/outline/annotate-schema.ts` exports the prompt builder, the
Zod runtime schema (`AnnotateBatchSchema`), and is consumed by both bun and
the renderer.

`cli-runner/annotatorPrimitive.ts` also exports `ANNOTATE_BATCH_JSON_SCHEMA`
— a hand-rolled JSON Schema fragment that codex's `turn/start.outputSchema`
enforces on the model server-side. Claude has no equivalent, so claude relies
on the prompt's instructions plus `parseAnnotateBatch`'s tolerant fallback
parsing.

## Persistence

Annotated outlines persist to `~/.session-viewer/outlines/<sourceSessionId>.json`
via `session-core/server/outline-store`. One outline per source session —
re-running `annotate` overwrites. Unannotated extractions are NOT persisted;
they're regenerated on demand.

`SESSION_VIEWER_STORE_DIR` redirects both stores (summary + outline) for
isolated testing.

## GUI integration

```
apps/session-viewer/src/
  shared/rpc-schema.ts         ← getOutline / annotateOutline / outlineProgress
  shared/dataSource.ts         ← SessionDataSource methods
  bun/index.ts                 ← handlers: loadFreshOutline, annotateOutline
                                  with outlineProgress streaming
  mainview/
    App.tsx                    ← 'outline' view tab + state
    components/OutlineView.tsx ← collapsible segment tree
    data/electrobunDataSource  ← RPC pass-through + dispatchOutlineProgress
    data/mockDataSource        ← synthetic outline for vite preview
```

Annotation flow from the user's perspective:

1. User selects a session, switches to the **Outline** tab.
2. Renderer requests `getOutline(sessionId)`. Bun checks the outline-store,
   falls back to a fresh extraction if no annotated copy exists.
3. User clicks **Annotate**. Renderer fires `annotateOutline(sessionId, lang)`.
4. Bun runs `cli-runner.annotateOutline(...)` which iterates fork attempts,
   forwarding each `ForkProgress` event as an `outlineProgress` push.
5. On completion bun saves to the outline-store and returns the annotated
   outline. Renderer replaces the outline state and re-renders.

## Standalone CLI

Same flow without the GUI:

```bash
cli-runner outline claude <sessionId> --segments-only
cli-runner annotate claude <sessionId> --batch-size 20 --max-attempts 5
cli-runner outlines list --annotated
cli-runner outlines get <sessionId> --json
```

The CLI persists annotated outlines to the same store the GUI reads, so the
two share state. The standalone CLI is also handy for scripting / CI and for
debugging extractors against arbitrary sessions.

## Agent registries — single dispatch table

Per-CLI dispatch lives in two parallel registries:

| Layer       | Registry path                                       | Pairs                              |
| ----------- | --------------------------------------------------- | ---------------------------------- |
| Data        | `session-core/src/agents/registry.ts` (`AGENTS`)    | reader + outline extractor         |
| Runtime     | `cli-runner/src/agents.ts` (`RUNNER_AGENTS`)        | summarize runner + annotator factory |

Consumers go through registry helpers instead of inline `if toolId === ...`
ladders:

```
                                 ┌── session-core / server / agents ──┐
loadOutlineForSession({          │   AGENTS[id].reader → raw bytes    │
  agentId, sessionId, cwd })  ──→│   AGENTS[id].outline → SessionOutline │
                                 └────────────────────────────────────┘

makeAnnotatorPrimitive({         ┌── cli-runner / agents ─────────────┐
  toolId, sessionId, cwd })  ──→ │   RUNNER_AGENTS[id].annotator      │
                                 │     .create() → AnnotatorPrimitive │
                                 │     (null when not viable)         │
                                 └────────────────────────────────────┘
```

Both `cli-runner/cli.ts` and the session-viewer bun handler delegate to
these registries — there are no per-toolId switches outside `agents.ts`
files in either tree.

## Extending

To add a new CLI:

1. `session-core/src/server/readers/<name>Reader.ts` — implement `scanAll`
   for project list + `read<Name>SessionRaw(sessionId, cwd)` for raw bytes.
   Re-export from `server-readers.ts`.
2. `session-core/src/outline/extract-<name>.ts` — translate raw bytes into
   `SessionOutline`. Re-export from `outline.ts`.
3. `session-core/src/agents/types.ts` — add the new id to the `AgentId`
   union and to `AGENT_IDS`.
4. `session-core/src/agents/registry.ts` — register the new
   `AgentDefinition` (reader + extractor pair).
5. `cli-runner/src/agents.ts` — register the new `RunnerAgentDefinition`
   (summarize runner + annotator factory). Return `null` from
   `annotator.create` when the CLI lacks a cache-preserving fork.

`apps/session-viewer/src/bun/index.ts:loadFreshOutline` now goes through
the registry, so it picks up the new agent automatically once steps 1–4
land. Same for `cli-runner/src/cli.ts`'s `outline` and `annotate`
subcommands.

To add a new annotator backend on an existing CLI: implement a new
`AnnotatorPrimitive` class and pass it explicitly to `annotateOutline` via
the `options.primitive` injection point — the registry handles the default
case but doesn't preclude per-call overrides.
