# ralph-tui CLI Execution Review

Reference repo: `references/ralph-tui-upstream`

## Key files reviewed

- `src/plugins/agents/base.ts`
- `src/plugins/agents/builtin/claude.ts`
- `src/plugins/agents/builtin/codex.ts`
- `src/plugins/agents/builtin/gemini.ts`
- `src/plugins/agents/registry.ts`
- `src/engine/index.ts`

## Observed execution architecture

1. Plugin-per-agent execution contract
- Each CLI is implemented as an agent plugin.
- Plugin is responsible for:
  - building command args (`buildArgs`)
  - optional stdin prompt payload (`getStdinInput`)
  - parsing structured JSON stream per CLI format

2. Safe process execution defaults
- Uses `spawn` with direct args (shell off by default on Unix).
- Uses `shell: true` only on Windows compatibility path.
- Supports timeout and graceful interrupt (`SIGTERM` then `SIGKILL`).

3. JSONL-first parsing with chunk buffering
- Stdout is chunked; parser buffers incomplete lines.
- Complete lines are parsed as JSONL.
- Parsed events are normalized before rendering and tracing.

4. Tool-specific command behavior
- Claude: `--print --output-format stream-json --verbose`
- Codex: `codex exec --json ... -` with prompt via stdin
- Gemini: `gemini --output-format stream-json ...` with prompt via stdin

5. Extensibility model
- Built-in plugins are registered centrally.
- User plugins can be loaded from a plugin directory.

## Mapping applied in this codebase

- Added `codex` / `gemini` execution interpreters.
- Added tool definitions and registration for `codex` / `gemini`.
- Added optional interpreter stdin payload (`getStdinInput`).
- Updated execution service to use tool-specific line parser instead of Claude-only schema parser.
- Updated process spawn behavior to use shell only on Windows.

