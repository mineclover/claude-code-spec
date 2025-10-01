#!/bin/bash
# Claude Code - 분석 전용 (읽기 전용)

claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  "$@"
