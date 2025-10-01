# MCP 설정 가이드

## 개요

`--mcp-config`와 `--strict-mcp-config` 옵션을 사용하여 작업에 필요한 MCP 서버만 선택적으로 로드할 수 있습니다. 이를 통해 초기화 시간을 단축하고 컨텍스트 사용량을 최적화할 수 있습니다.

## 기본 개념

### 1. MCP 설정 파일

MCP 설정은 JSON 파일로 정의됩니다:

```json
{
  "mcpServers": {
    "server-name": {
      "type": "stdio",
      "command": "command",
      "args": ["arg1", "arg2"],
      "env": {}
    }
  }
}
```

### 2. --strict-mcp-config 플래그

```bash
claude --mcp-config .claude/.mcp-custom.json --strict-mcp-config
```

**역할:**
- 지정된 MCP 설정 파일만 사용
- 사용자 레벨(`~/.claude.json`)의 MCP 무시
- 프로젝트에 필요한 도구만 로드

**장점:**
- ✅ 빠른 초기화 (불필요한 MCP 제외)
- ✅ 컨텍스트 효율성 (도구 개수 감소)
- ✅ 명확한 의존성 (프로젝트별 필요 도구 명시)

## 프로젝트 MCP 설정

### 디렉토리 구조

```
.claude/
├── .mcp-analysis.json    # 분석 전용 (읽기 + 사고)
├── .mcp-dev.json          # 개발 전용 (코드 + 문서)
├── .mcp-ui.json           # UI 개발 (코드 + UI)
├── .mcp-e2e.json          # E2E 테스트 (코드 + 브라우저)
└── .mcp-empty.json        # MCP 없음 (성능 테스트)
```

### 1. 분석 전용 (.mcp-analysis.json)

**용도:** 코드 탐색, 아키텍처 분석, Plan 모드

**MCP 서버:**
- `serena` - 코드 심볼 분석
- `sequential-thinking` - 복잡한 문제 단계적 해결

**도구 개수:** 21개

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--project", "$(pwd)"],
      "env": {}
    },
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"],
      "env": {}
    }
  }
}
```

**실행:**
```bash
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "프로젝트 아키텍처 분석"
```

### 2. 개발 전용 (.mcp-dev.json)

**용도:** 일반 코드 작성, 리팩토링, 문서 참조

**MCP 서버:**
- `serena` - 코드 작업
- `context7` - 라이브러리 문서

**도구 개수:** 22개

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--project", "$(pwd)"],
      "env": {}
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": {}
    }
  }
}
```

**실행:**
```bash
claude --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  -p "리팩토링 및 타입 에러 수정"
```

### 3. UI 개발 (.mcp-ui.json)

**용도:** UI 컴포넌트 생성, 스타일링, 로고 추가

**MCP 서버:**
- `serena` - 코드 작업
- `magic` - UI 컴포넌트 빌더

**도구 개수:** 24개

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--project", "$(pwd)"],
      "env": {}
    },
    "magic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@21st-dev/magic"],
      "env": {}
    }
  }
}
```

**실행:**
```bash
claude --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config \
  -p "로그인 페이지 UI 개선"
```

### 4. E2E 테스트 (.mcp-e2e.json)

**용도:** 브라우저 자동화, E2E 테스트 작성

**MCP 서버:**
- `serena` - 코드 작업
- `playwright` - 브라우저 제어

**도구 개수:** 43개

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "serena",
      "args": ["start-mcp-server", "--context", "ide-assistant", "--project", "$(pwd)"],
      "env": {}
    },
    "playwright": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest"],
      "env": {}
    }
  }
}
```

**실행:**
```bash
claude --mcp-config .claude/.mcp-e2e.json \
  --strict-mcp-config \
  -p "로그인 플로우 E2E 테스트 작성"
```

### 5. MCP 없음 (.mcp-empty.json)

**용도:** 순수 LLM 기능, 성능 벤치마크

**MCP 서버:** 없음

**도구 개수:** 17개 (기본 도구만)

```json
{
  "mcpServers": {}
}
```

**실행:**
```bash
claude --mcp-config .claude/.mcp-empty.json \
  --strict-mcp-config \
  -p "간단한 질문"
```

## 사용 패턴

### 패턴 1: 작업별 자동 선택

```bash
# 분석 작업
if [[ $task == "analyze" ]]; then
  mcp_config=".claude/.mcp-analysis.json"
fi

# UI 작업
if [[ $task == "ui" ]]; then
  mcp_config=".claude/.mcp-ui.json"
fi

# E2E 테스트 작업
if [[ $task == "e2e" ]]; then
  mcp_config=".claude/.mcp-e2e.json"
fi

claude --mcp-config "$mcp_config" --strict-mcp-config -p "$query"
```

### 패턴 2: 대화형 선택

```bash
#!/bin/bash

echo "작업 유형을 선택하세요:"
echo "1) 분석 (읽기 전용)"
echo "2) 개발 (코드 수정)"
echo "3) UI 개발"
echo "4) E2E 테스트"
read -p "선택 (1-4): " choice

case $choice in
  1) mcp_config=".claude/.mcp-analysis.json" ;;
  2) mcp_config=".claude/.mcp-dev.json" ;;
  3) mcp_config=".claude/.mcp-ui.json" ;;
  4) mcp_config=".claude/.mcp-e2e.json" ;;
  *) echo "잘못된 선택"; exit 1 ;;
esac

read -p "쿼리 입력: " query

claude --mcp-config "$mcp_config" --strict-mcp-config -p "$query"
```

### 패턴 3: 성능 비교

```bash
#!/bin/bash

echo "=== MCP 설정별 성능 비교 ==="

configs=(
  ".claude/.mcp-empty.json:MCP 없음"
  ".claude/.mcp-analysis.json:분석용"
  ".claude/.mcp-dev.json:개발용"
  ".claude/.mcp-ui.json:UI용"
  ".claude/.mcp-e2e.json:E2E용"
)

for config in "${configs[@]}"; do
  IFS=':' read -r file name <<< "$config"
  echo ""
  echo "테스트: $name ($file)"
  time claude -p "/context" \
    --output-format stream-json --verbose \
    --mcp-config "$file" --strict-mcp-config \
    > /dev/null 2>&1
done
```

## 성능 최적화

### 초기화 시간 비교

| 설정 | MCP 서버 수 | 도구 개수 | 초기화 시간 | 용도 |
|------|-------------|-----------|-------------|------|
| 전체 (기본) | 6개 | ~70개 | 5-10초 | 모든 기능 |
| E2E | 2개 | 43개 | 3-5초 | 브라우저 테스트 |
| UI | 2개 | 24개 | 3-5초 | UI 개발 |
| 개발 | 2개 | 22개 | 3-5초 | 일반 개발 |
| 분석 | 2개 | 21개 | 3-5초 | 코드 분석 |
| 최소 (serena) | 1개 | 20개 | 2-3초 | 코드 작업만 |
| 없음 | 0개 | 17개 | 1-2초 | 순수 LLM |

### 최적화 팁

1. **작업에 필요한 MCP만 로드**
   ```bash
   # ❌ 나쁜 예: 모든 MCP 로드
   claude -p "간단한 분석"

   # ✅ 좋은 예: 필요한 MCP만
   claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config -p "분석"
   ```

2. **--strict-mcp-config 항상 사용**
   ```bash
   # 사용자 설정의 MCP를 무시하고 프로젝트 설정만 사용
   claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config
   ```

3. **작업별 설정 파일 준비**
   ```bash
   .claude/
   ├── .mcp-analysis.json  # Plan 모드, 읽기 전용
   ├── .mcp-dev.json       # 일반 개발
   ├── .mcp-ui.json        # UI 작업
   └── .mcp-e2e.json       # 테스트 작업
   ```

## 문제 해결

### MCP 서버 초기화 실패

```bash
# MCP 서버 상태 확인
claude -p "/context" --verbose 2>&1 | grep 'mcp_servers'
```

**출력 예시:**
```json
"mcp_servers":[
  {"name":"serena","status":"ready"},
  {"name":"context7","status":"failed"}
]
```

**해결:**
1. 해당 MCP 패키지 설치 확인
   ```bash
   npx -y @upstash/context7-mcp --version
   ```

2. 실패한 MCP 제외하고 재실행
   ```bash
   # .mcp-custom.json에서 실패한 서버 제거
   ```

### 도구 목록 확인

```bash
# 현재 활성화된 도구 확인
claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__'
```

### JSON 문법 오류

```bash
# JSON 유효성 검사
jq . < .claude/.mcp-dev.json

# 에러 없으면 OK
```

## 실전 예시

### 예시 1: 빠른 코드 분석

```bash
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "이 프로젝트의 의존성 구조 분석"
```

**특징:**
- Plan 모드로 읽기 전용
- serena + sequential-thinking만 로드
- 빠른 초기화 (2-3초)

### 예시 2: UI 컴포넌트 생성

```bash
claude --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config \
  -p "Material Design 스타일의 로그인 폼 생성"
```

**특징:**
- magic MCP로 UI 컴포넌트 빌더 사용
- serena로 코드 삽입
- settings.json 권한으로 안전하게 수정

### 예시 3: E2E 테스트 자동화

```bash
claude --mcp-config .claude/.mcp-e2e.json \
  --strict-mcp-config \
  -p "로그인 후 대시보드 접근 E2E 테스트 작성"
```

**특징:**
- playwright로 브라우저 제어
- serena로 테스트 코드 작성
- 43개 도구로 풍부한 브라우저 제어

## 베스트 프랙티스

### 1. 프로젝트별 MCP 설정 정의

```bash
# .claude/ 디렉토리에 작업별 설정 준비
.claude/
├── .mcp-analysis.json
├── .mcp-dev.json
├── .mcp-ui.json
└── .mcp-e2e.json
```

### 2. Git에 커밋

```bash
git add .claude/.mcp-*.json
git commit -m "Add MCP configurations for different workflows"
```

**장점:**
- 팀원 모두 동일한 MCP 환경
- 명확한 도구 의존성
- 재현 가능한 실행 환경

### 3. README에 문서화

```markdown
## Claude Code 사용법

### 코드 분석
\`\`\`bash
claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config
\`\`\`

### 개발 작업
\`\`\`bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config
\`\`\`
```

### 4. 스크립트로 자동화

```bash
#!/bin/bash
# scripts/claude-analyze.sh

claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  "$@"
```

```bash
# 사용
./scripts/claude-analyze.sh -p "프로젝트 구조 파악"
```

## 체크리스트

### 설정 작성 시

- [ ] 작업 유형별 MCP 설정 파일 생성
- [ ] `.claude/` 디렉토리에 저장
- [ ] JSON 문법 검증 (`jq` 사용)
- [ ] Git에 커밋

### 실행 시

- [ ] `--mcp-config` 옵션으로 설정 파일 지정
- [ ] `--strict-mcp-config` 플래그 사용
- [ ] 필요시 `--permission-mode` 지정
- [ ] 도구 목록 확인 (`/context`)

## 참고 자료

- [MCP Tools Reference](./mcp-tools-reference.md) - 전체 도구 목록
- [Execution Strategy](./claude-context/usage/claude-execution-strategy.md) - 실행 전략
- [MCP Configuration](./claude-context/mcp-config/mcp-configuration.md) - MCP 설정 상세
