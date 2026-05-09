# @context-action/session-core

Cache-preserving session analytics + prefix-hash domain logic for the Session
Viewer. Transport-agnostic and Electron-free — the renderer can import the
browser-safe pieces directly, while server-only code lives behind explicit
sub-path entries that pull node:fs / node:os.

## Sub-path entries

Pick the smallest entry that fits the consumer to keep bundles tight:

| Path                                  | Use case                                 | Pulls node:fs? |
| ------------------------------------- | ---------------------------------------- | -------------- |
| `@context-action/session-core`        | Browser-safe core (types, aggregators)   | no             |
| `.../hash`                            | `sha256OfCanonicalJson` only             | yes (crypto)   |
| `.../fingerprint`                     | Static / observed fingerprint helpers    | no             |
| `.../summary`                         | Branch & Summarize types + zod schema    | no             |
| `.../outline`                         | Outline types, extractors, prompt builder, annotator schema | no |
| `.../server/readers`                  | Multi-CLI session readers + raw-bytes IO | yes            |
| `.../server/summary-store`            | `~/.session-viewer/summaries/` JSON I/O  | yes            |
| `.../server/outline-store`            | `~/.session-viewer/outlines/` JSON I/O   | yes            |

`./outline` is browser-safe even though it parses JSONL — it's pure string
manipulation, no node modules. The annotator prompt builder + Zod schema
also live there so the bun host and the renderer can share types.

## Multi-CLI readers

`server/readers/` translates each CLI's on-disk session format into a uniform
`SessionMetaView`:

| CLI    | Storage layout                                          |
| ------ | ------------------------------------------------------- |
| Claude | `~/.claude/projects/<dash-encoded-cwd>/<id>.jsonl`      |
| Codex  | `~/.codex/sessions/YYYY/MM/DD/rollout-*-<id>.jsonl`     |
| Gemini | `~/.gemini/tmp/<sha256(cwd)>/chats/session-*.json`      |

Codex scanning is windowed (`SESSION_VIEWER_CODEX_DAYS`, default 30) because
the on-disk archive can run into 10⁵ files. Per-file extraction reads only
the head (16 KB for `session_meta.cwd`) and tail (64 KB for the latest
`token_count` event) instead of full files.

Each reader also exposes a `readXSessionRaw(sessionId, cwd)` helper that
returns the raw JSONL/JSON for downstream extractors (outline + future
features).

## Outline pipeline

```
extractClaudeOutline(raw, ...)   → SessionOutline
extractCodexOutline(raw, ...)    → SessionOutline
extractGeminiOutline(raw, ...)   → SessionOutline
groupIntoSegments(steps)         → SessionSegment[]
```

Each per-CLI extractor handles its own envelope quirks:

- **Claude**: `{type: 'user'|'assistant', message: {content: [...]}}` per line. A user-role
  message containing only `tool_result` blocks is classified as a `tool-result`
  step, not a new user-instruction (so segments don't fragment around tool calls).
- **Codex**: `{type: 'response_item', payload: {...}}` envelope with developer /
  user / assistant / reasoning / function_call / function_call_output flavors.
  Pre-`event_msg.task_started` user messages are classified as meta to filter
  out the `AGENTS.md` / permissions boilerplate codex injects.
- **Gemini**: single JSON document with a `messages: [...]` array. Each
  `gemini` message is split into thinking → tool-call → tool-result →
  assistant-text steps for parity with the JSONL CLIs (Gemini bundles call+result).

The annotator's prompt builder + Zod schema live in `outline/annotate-schema.ts`
so both bun and the renderer can import them without dragging in cli-runner.

## Persistent stores

`server/summary-store` and `server/outline-store` write JSON files under
`~/.session-viewer/{summaries,outlines}/`. Both honor a
`SESSION_VIEWER_STORE_DIR` env override so tests can run against an isolated
temp dir. Sanitization neutralizes path-traversal in ids before joining.

## Testing

```bash
npm test --workspace=packages/session-core
```

130 tests covering aggregators, fingerprint extraction, cache-metric reducers,
each per-CLI outline extractor, and round-trip I/O for both stores.
