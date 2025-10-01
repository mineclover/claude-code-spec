#!/bin/bash
# Claude Code - UI 개발 모드

claude \
  --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config \
  "$@"
