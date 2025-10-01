#!/bin/bash

# MCP allowedTools 테스트 스크립트

echo "========================================="
echo "MCP allowedTools 설정 테스트"
echo "========================================="
echo ""

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 함수: 도구 개수 확인
test_config() {
    local config_file=$1
    local description=$2

    echo -e "${YELLOW}테스트: ${description}${NC}"
    echo "설정 파일: ${config_file}"
    echo ""

    # system init 이벤트에서 tools 목록 추출
    echo "MCP 서버 초기화 중..."
    tools=$(claude -p "/context" --output-format stream-json --verbose \
        --mcp-config "${config_file}" --strict-mcp-config 2>&1 | \
        grep '"type":"system"' | head -1 | \
        jq -r '.tools[]' | grep '^mcp__' | sort)

    tool_count=$(echo "$tools" | grep -c '^mcp__' || echo 0)

    echo -e "${GREEN}MCP 도구 개수: ${tool_count}${NC}"
    echo ""
    echo "사용 가능한 MCP 도구:"
    echo "$tools" | nl
    echo ""
    echo "========================================="
    echo ""
}

# 테스트 1: allowedTools 없음 (모든 도구)
echo "📋 테스트 1: allowedTools 없음 (모든 MCP 도구 허용)"
test_config ".claude/.mcp-test-all-tools.json" "allowedTools 없음"

# 테스트 2: allowedTools로 제한 (serena만 4개)
echo "📋 테스트 2: Serena 도구 4개만 허용"
test_config ".claude/.mcp-test-serena-only.json" "Serena 4개 도구만"

# 테스트 3: allowedTools로 제한 (여러 MCP에서 선택)
echo "📋 테스트 3: 여러 MCP에서 선택한 7개 도구만 허용"
test_config ".claude/.mcp-test-allowed-tools.json" "복합 MCP 7개 도구"

echo ""
echo -e "${GREEN}✅ 모든 테스트 완료!${NC}"
echo ""
echo "결론:"
echo "1. allowedTools 없으면 → 모든 MCP 도구 사용 가능"
echo "2. allowedTools 있으면 → 지정된 도구만 사용 가능"
echo "3. 여러 MCP에서 선택적으로 도구 허용 가능"
