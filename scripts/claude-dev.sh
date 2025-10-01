#!/bin/bash
# Claude Code - 개발 모드 (코드 수정 가능)

claude \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  "$@"
