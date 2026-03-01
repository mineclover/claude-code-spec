# vercel-labs/skills Reference

This folder snapshots key files from `https://github.com/vercel-labs/skills` for local reference.
The full upstream archive mirror is at `references/vercel-labs-skills-upstream/`.

- Source README: `references/vercel-labs-skills/README.md`
- Source agent path definitions: `references/vercel-labs-skills/src/agents.ts`

Primary path mappings used by this app (global scope):

- Claude Code: `~/.claude/skills`
- Codex: `~/.codex/skills` (or `$CODEX_HOME/skills`)
- Gemini CLI: `~/.gemini/skills`
- Canonical agents store: `~/.agents/skills`

Activation management in this app uses companion disabled folders:

- `~/.claude/skills-disabled`
- `~/.codex/skills-disabled`
- `~/.gemini/skills-disabled`
- `~/.agents/skills-disabled`
