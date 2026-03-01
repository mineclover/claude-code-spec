#!/usr/bin/env bash
set -euo pipefail

# Run Claude Code in bypass permissions mode for non-interactive execution.
#
# Usage:
#   scripts/run-claude-bypass.sh "your query here" [extra claude args...]
#
# Optional env vars:
#   CLAUDE_MODEL=claude-sonnet-4-5-20250514
#   CLAUDE_MCP_CONFIG=.claude/.mcp-dev.json
#   CLAUDE_BYPASS_MODE=auto|dangerous-flag|permission-mode

if ! command -v claude >/dev/null 2>&1; then
  echo "Error: 'claude' CLI not found in PATH." >&2
  exit 1
fi

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 \"query\" [extra claude args...]" >&2
  exit 1
fi

query="$1"
shift || true
extra_args=("$@")

model="${CLAUDE_MODEL:-claude-sonnet-4-5-20250514}"
mcp_config="${CLAUDE_MCP_CONFIG:-}"
bypass_mode="${CLAUDE_BYPASS_MODE:-dangerous-flag}"

cmd=(claude -p "$query" --output-format stream-json --verbose --model "$model")

case "$bypass_mode" in
  permission-mode)
    cmd+=(--permission-mode bypassPermissions)
    ;;
  dangerous-flag)
    cmd+=(--dangerously-skip-permissions)
    ;;
  auto)
    if claude --help 2>&1 | grep -q -- '--dangerously-skip-permissions'; then
      cmd+=(--dangerously-skip-permissions)
    else
      cmd+=(--permission-mode bypassPermissions)
    fi
    ;;
  *)
    echo "Error: CLAUDE_BYPASS_MODE must be one of: auto, permission-mode, dangerous-flag" >&2
    exit 1
    ;;
esac

if [[ -n "$mcp_config" ]]; then
  cmd+=(--mcp-config "$mcp_config" --strict-mcp-config)
fi

cmd+=("${extra_args[@]}")

exec "${cmd[@]}"
