# MCP 설정 요약

## 핵심 개념

### --mcp-config + --strict-mcp-config

```bash
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config -p "작업"
```

**역할:**
- `--mcp-config`: 사용할 MCP 설정 파일 지정
- `--strict-mcp-config`: 사용자 설정(`~/.claude.json`) 무시, 지정된 파일만 사용

**효과:**
- ✅ 필요한 MCP 서버만 로드 → 빠른 초기화
- ✅ 도구 개수 감소 → 컨텍스트 효율
- ✅ 명확한 의존성 → 재현 가능한 환경

## 사용 가능한 MCP 서버

| MCP 서버 | 도구 개수 | 용도 |
|----------|-----------|------|
| serena | 20개 | 코드 심볼 분석, 파일 검색 |
| sequential-thinking | 1개 | 복잡한 문제 단계적 해결 |
| context7 | 2개 | 최신 라이브러리 문서 |
| magic | 4개 | UI 컴포넌트 생성 |
| playwright | 23개 | 브라우저 자동화 |

**전체 도구 개수:** ~70개 (기본 도구 17개 + MCP 도구 ~50개)

## 프로젝트 MCP 설정

### 1. 분석 전용 (.mcp-analysis.json)

```json
{
  "mcpServers": {
    "serena": { ... },
    "sequential-thinking": { ... }
  }
}
```

**도구:** 21개 (serena 20 + thinking 1)
**용도:** 코드 분석, Plan 모드
**실행:** `./scripts/claude-analyze.sh`

### 2. 개발 전용 (.mcp-dev.json)

```json
{
  "mcpServers": {
    "serena": { ... },
    "context7": { ... }
  }
}
```

**도구:** 22개 (serena 20 + context7 2)
**용도:** 일반 개발, 리팩토링
**실행:** `./scripts/claude-dev.sh`

### 3. UI 개발 (.mcp-ui.json)

```json
{
  "mcpServers": {
    "serena": { ... },
    "magic": { ... }
  }
}
```

**도구:** 24개 (serena 20 + magic 4)
**용도:** UI 컴포넌트 생성
**실행:** `./scripts/claude-ui.sh`

### 4. E2E 테스트 (.mcp-e2e.json)

```json
{
  "mcpServers": {
    "serena": { ... },
    "playwright": { ... }
  }
}
```

**도구:** 43개 (serena 20 + playwright 23)
**용도:** 브라우저 테스트 자동화

### 5. MCP 없음 (.mcp-empty.json)

```json
{
  "mcpServers": {}
}
```

**도구:** 17개 (기본 도구만)
**용도:** 순수 LLM, 성능 벤치마크

## 성능 비교

| 설정 | MCP | 도구 | 초기화 | 용도 |
|------|-----|------|--------|------|
| 전체 | 6개 | ~70개 | 5-10초 | 모든 기능 |
| E2E | 2개 | 43개 | 3-5초 | 브라우저 |
| UI | 2개 | 24개 | 3-5초 | UI 개발 |
| 개발 | 2개 | 22개 | 3-5초 | 일반 개발 |
| 분석 | 2개 | 21개 | 3-5초 | 분석 |
| 없음 | 0개 | 17개 | 1-2초 | 순수 LLM |

## 빠른 시작

### 1. 분석 (읽기 전용)

```bash
./scripts/claude-analyze.sh -p "프로젝트 구조 분석"

# 또는
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "아키텍처 분석"
```

### 2. 개발 (코드 수정)

```bash
./scripts/claude-dev.sh -p "리팩토링"

# 또는
claude --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  -p "타입 에러 수정"
```

### 3. UI 개발

```bash
./scripts/claude-ui.sh -p "로그인 페이지 개선"

# 또는
claude --mcp-config .claude/.mcp-ui.json \
  --strict-mcp-config \
  -p "Material Design 버튼 생성"
```

## 도구 조회

### 전체 MCP 서버 목록

```bash
jq '.mcpServers | keys' ~/.claude.json
```

### 활성화된 도구 확인

```bash
claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__'
```

### 도구 개수 확인

```bash
claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config 2>&1 | \
  grep '"type":"system"' | jq -r '.tools[]' | grep '^mcp__' | wc -l
```

## allowedTools 실험 결과

**테스트:** `settings.json`과 `.mcp-*.json`에 `allowedTools` 필드 추가

**결과:** ❌ 작동하지 않음

**대안:** `--mcp-config`로 필요한 MCP 서버만 선택 ✅

```json
// ❌ 작동 안 함
{
  "mcpServers": { ... },
  "allowedTools": [
    "mcp__serena__find_symbol",
    "mcp__serena__list_dir"
  ]
}

// ✅ 권장 방법
{
  "mcpServers": {
    "serena": { ... }  // serena의 20개 도구만 사용
  }
}
```

## 베스트 프랙티스

### 1. 작업별 MCP 설정 사용

```bash
# ❌ 나쁜 예: 모든 MCP 로드
claude -p "코드 분석"

# ✅ 좋은 예: 필요한 MCP만
claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config -p "분석"
```

### 2. --strict-mcp-config 항상 사용

```bash
# 사용자 설정 무시, 프로젝트 설정만 사용
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

### 3. 스크립트로 자동화

```bash
# scripts/claude-analyze.sh
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  "$@"
```

### 4. Git에 커밋

```bash
git add .claude/.mcp-*.json scripts/*.sh
git commit -m "Add MCP configurations"
```

## 체크리스트

### 설정 작성

- [ ] `.claude/` 디렉토리에 작업별 MCP 설정 생성
- [ ] JSON 문법 검증 (`jq . < file.json`)
- [ ] Git에 커밋

### 실행

- [ ] `--mcp-config` 옵션으로 설정 파일 지정
- [ ] `--strict-mcp-config` 플래그 사용
- [ ] 도구 목록 확인 (`/context`)

## 참고 문서

- [MCP 설정 가이드](./mcp-config-guide.md) - 상세 가이드
- [MCP Tools Reference](./mcp-tools-reference.md) - 전체 도구 목록
- [실행 전략](./claude-context/usage/claude-execution-strategy.md) - 최적화 패턴

## 핵심 요약

1. **`--mcp-config`로 필요한 MCP만 선택** → 빠른 초기화
2. **`--strict-mcp-config`로 사용자 설정 무시** → 명확한 환경
3. **`allowedTools`는 작동 안 함** → MCP 서버 선택으로 해결
4. **작업별 설정 파일 준비** → 분석/개발/UI/E2E
5. **스크립트로 자동화** → `./scripts/claude-*.sh`
