# Claude Code 설정 가이드

## 개요

이 프로젝트는 Claude Code의 세밀한 권한 제어와 MCP 서버 선택을 통해 안전하고 효율적인 실행 환경을 제공합니다.

## 설정 파일 구조

```
.claude/
├── settings.json              # 팀 공유 권한 설정 (git에 커밋됨)
├── settings.local.json        # 개인 권한 오버라이드 (git에서 제외)
├── settings.local.json.example # 개인 설정 예시
├── .mcp-analysis.json         # 분석용 MCP 서버 설정
├── .mcp-dev.json              # 개발용 MCP 서버 설정
└── .mcp-empty.json            # MCP 없음 (성능 테스트용)
```

## 권한 설정 (settings.json)

### 자동 허용 (allow)
- `src/`, `docs/` 디렉토리 읽기/쓰기
- 프로젝트 설정 파일 읽기
- npm 스크립트 실행 (build, dev, lint, test 등)
- git 명령 (status, log, diff, add, commit)

### 차단 (deny)
- `.env` 파일 접근 (환경 변수 보호)
- `package-lock.json` 수정 (의존성 무결성)
- 위험한 명령 (`rm`, `git push`, `npm publish`)

## 실행 방법

### 1. 기본 실행 (팀 권한 설정 사용)

```bash
# settings.json이 자동으로 로드됩니다
claude -p "코드 분석해줘"
```

### 2. 분석 전용 (Plan 모드 + 최소 MCP)

```bash
claude \
  --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "아키텍처 분석"
```

**특징:**
- 읽기 전용 (코드 변경 불가)
- Serena + Sequential Thinking MCP만 로드
- 빠른 초기화

### 3. 개발 모드 (코드 수정 가능)

```bash
claude \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  -p "TODO 주석 수정"
```

**특징:**
- settings.json 권한으로 안전하게 수정
- Serena + Context7 MCP 로드
- 실시간 스트리밍

### 4. 성능 테스트 (MCP 없음)

```bash
time claude \
  --mcp-config .claude/.mcp-empty.json \
  --strict-mcp-config \
  -p "/context" \
  > /dev/null
```

**특징:**
- MCP 서버 없음
- 순수 Claude 성능 측정

## 개인 설정 추가 (선택사항)

개인적으로 추가 권한이 필요한 경우:

```bash
cp .claude/settings.local.json.example .claude/settings.local.json
```

`.claude/settings.local.json` 편집:

```json
{
  "permissions": {
    "allow": [
      "Bash(git push:*)"
    ]
  }
}
```

**주의:** 이 파일은 git에서 무시되므로 개인 환경에만 적용됩니다.

## MCP 서버 설명

### serena (@agentic-insights/mcp-server-serena)
- 코드 심볼 분석
- 파일 검색 및 탐색
- 리팩토링 지원

### sequential-thinking (@modelcontextprotocol/server-sequential-thinking)
- 복잡한 문제 단계적 해결
- 추론 과정 시각화

### context7 (@context7/mcp-server)
- 최신 라이브러리 문서 제공
- API 참조

## 문제 해결

### 권한 오류 발생 시

```bash
# verbose 모드로 권한 확인
claude --verbose -p "작업" 2>&1 | grep -i permission
```

### JSON 문법 확인

```bash
jq . < .claude/settings.json
jq . < .claude/.mcp-dev.json
```

### 설정 파일 재생성

```bash
# 손상된 경우 git에서 복원
git checkout .claude/settings.json
```

## 보안 가이드

### ✅ 하세요
- 팀 공유 권한은 `.claude/settings.json`에 정의
- 개인 권한은 `.claude/settings.local.json`에 추가
- 민감한 파일은 명시적으로 `deny`
- 최소 권한 원칙 적용

### ❌ 하지 마세요
- `--dangerously-skip-permissions` 사용 금지
- `.env` 파일을 allow에 추가 금지
- `settings.local.json`을 git에 커밋 금지
- 프로덕션 명령을 allow에 추가 금지

## 참고 문서

- [Claude Code 실행 전략](./docs/claude-context/usage/claude-execution-strategy.md)
- [권한 설정 상세 가이드](./docs/claude-context/config/permissions-configuration.md)
- [MCP 설정](./docs/claude-context/mcp-config/mcp-configuration.md)

## 예제 명령어 모음

```bash
# 1. 코드 분석 (읽기 전용)
claude --permission-mode plan -p "프로젝트 구조 파악"

# 2. TODO 주석 정리
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config \
  -p "모든 TODO 주석에 작성자와 날짜 추가"

# 3. 문서 업데이트
claude -p "docs/CLAUDE.md 업데이트"

# 4. 실시간 모니터링
claude --output-format stream-json --verbose \
  -p "타입 에러 수정" | jq -r '.type + ": " + (.tool // .message.content[0].text // "")'

# 5. 컨텍스트 확인
claude -p "/context"
```

## 빠른 실행 스크립트

프로젝트에는 작업별 실행 스크립트가 포함되어 있습니다:

```bash
# 분석 전용 (읽기 전용)
./scripts/claude-analyze.sh -p "프로젝트 구조 분석"

# 개발 모드 (코드 수정)
./scripts/claude-dev.sh -p "리팩토링"

# UI 개발
./scripts/claude-ui.sh -p "로그인 페이지 개선"
```

## 참고 문서

- [MCP 설정 가이드](./mcp-config-guide.md) - 작업별 MCP 서버 선택
- [MCP Tools Reference](./mcp-tools-reference.md) - 전체 도구 목록
- [실행 전략 문서](./claude-context/usage/claude-execution-strategy.md) - 최적화된 실행 패턴
- [권한 설정](./claude-context/config/permissions-configuration.md) - 세밀한 권한 제어
- [프로젝트 CLAUDE.md](../CLAUDE.md) - 프로젝트 비전
- [Claude Code 공식 문서](https://docs.claude.com/en/docs/claude-code)
