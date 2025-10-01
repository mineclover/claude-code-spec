# Claude Code 실행 전략 문서

## 개요

Claude Code CLI를 효과적으로 실행하고 제어하기 위한 전략 문서입니다. MCP 서버 선택, 권한 관리, 출력 형식 등 다양한 실행 옵션을 조합하여 목적에 맞는 실행 환경을 구성할 수 있습니다.

## 기본 실행 명령어 구조

```bash
claude [options] [query]
```

### 핵심 옵션

| 옵션 | 설명 | 사용 시점 |
|------|------|----------|
| `-p, --print` | 헤드리스 모드 (비대화형) | 자동화, 스크립트 실행 |
| `--verbose` | 상세 로그 출력 | 디버깅, 분석 |
| `--dangerously-skip-permissions` | 권한 확인 건너뛰기 | 자동화, 신뢰된 환경 |
| `--mcp-config <path>` | MCP 설정 파일 지정 | 특정 MCP 서버만 사용 |
| `--strict-mcp-config` | 지정된 MCP만 사용 | 서버 격리, 테스트 |
| `--model <name>` | 모델 선택 | 작업별 최적 모델 |
| `--max-turns <n>` | 최대 에이전트 턴 제한 | 비용 제어 |
| `--output-format <format>` | 출력 형식 지정 | 파싱, 분석 |

## MCP 서버 선택 전략

### 1. 전체 MCP 서버 사용 (기본)

```bash
claude -p "분석 쿼리"
```

**특징:**
- User, Project, Local 모든 scope의 MCP 서버 로드
- 가장 많은 기능 사용 가능
- 초기화 시간이 가장 김
- 컨텍스트 사용량이 높음

**사용 시점:**
- 대화형 개발 작업
- 다양한 도구 필요
- MCP 기능 전체 탐색

### 2. 특정 MCP만 선택 사용 (권장)

```bash
claude --mcp-config .claude/.mcp.json --strict-mcp-config -p "쿼리"
```

**특징:**
- 지정된 설정 파일의 MCP만 로드
- `--strict-mcp-config`로 다른 scope 무시
- 빠른 초기화
- 컨텍스트 효율적

**사용 시점:**
- 특정 작업에 필요한 MCP만 사용
- 빠른 실행 필요
- 비용 최적화
- 프로덕션 환경

**설정 예시 (.claude/.mcp.json):**

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@serena/mcp-server"]
    },
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

### 3. MCP 없이 실행 (최소)

```bash
# 빈 MCP 설정 사용
echo '{"mcpServers":{}}' > .claude/.mcp-empty.json
claude --mcp-config .claude/.mcp-empty.json --strict-mcp-config -p "쿼리"
```

**특징:**
- MCP 서버 없음
- 가장 빠른 초기화
- 기본 Claude 기능만 사용

**사용 시점:**
- 순수 언어 모델 기능만 필요
- 최소 컨텍스트
- 빠른 질의응답

## 권한 관리 전략

### 1. Settings 기반 권한 제어 (권장)

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./src/**)",
      "Bash(npm run test)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(rm:*)",
      "Bash(git push:*)"
    ]
  }
}
```

```bash
# settings.json이 자동 로드됨
claude -p "TODO 주석 수정"
```

**특징:**
- 세밀한 도구/파일별 권한 제어
- 팀 공유 가능 (버전 관리)
- 안전하면서도 자동화 가능
- `--dangerously-skip-permissions` 불필요

**사용 시점:**
- 프로덕션 환경 (필수)
- 팀 협업 프로젝트
- CI/CD 파이프라인
- 자동화 워크플로우

**장점:**
- ✅ 최소 권한 원칙 적용
- ✅ 민감한 파일/명령 차단
- ✅ 감사 추적 가능
- ✅ 팀 정책 공유

**상세 문서:** [Permissions Configuration](../config/permissions-configuration.md)

### 2. 대화형 권한 확인 (기본)

```bash
claude "파일 수정해줘"
```

**특징:**
- 모든 작업에 사용자 확인 요청
- 안전하지만 느림
- 수동 개입 필요

**사용 시점:**
- 탐색 및 학습
- 중요한 파일 작업
- 검토가 필요한 변경

### 3. Plan 모드 (읽기 전용)

```bash
claude --permission-mode plan -p "분석해줘"
```

**특징:**
- 읽기 전용
- 코드 변경 불가
- 안전한 분석

**사용 시점:**
- 코드 탐색
- 아키텍처 분석
- 영향도 분석
- 학습

### 4. 자동 승인 (주의)

```bash
claude --permission-mode acceptAll -p "자동화 작업"
```

**특징:**
- 모든 작업 자동 승인
- 빠르지만 위험함
- 세밀한 제어 불가

**사용 시점:**
- 격리된 테스트 환경
- 신뢰된 스크립트
- 임시 자동화

**대안:** settings.json으로 세밀하게 제어 (권장)

### 5. 권한 건너뛰기 (위험, 비권장)

```bash
claude --dangerously-skip-permissions -p "작업"
```

**특징:**
- 권한 시스템 완전 우회
- 가장 빠름
- 보안 위험

**문제점:**
- ❌ 민감한 파일 보호 불가
- ❌ 위험한 명령 차단 불가
- ❌ 팀 정책 적용 불가
- ❌ 감사 추적 불가

**대안:** settings.json으로 필요한 권한만 allow (권장)

## 출력 형식 전략

### 1. 스트림 JSON (분석 최적)

```bash
claude -p "쿼리" --output-format stream-json
```

**출력 형식 (JSONL):**
```jsonl
{"type":"system","subtype":"init","session_id":"...","model":"..."}
{"type":"message","subtype":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"응답"}]}}
{"type":"tool_use","tool":"Read","parameters":{"file_path":"..."}}
{"type":"tool_result","tool":"Read","result":"..."}
{"type":"result","result":{"status":"success","duration_ms":1234}}
```

**특징:**
- 각 이벤트가 완전한 JSON 객체
- 줄바꿈으로 구분
- 실시간 파싱 가능
- 도구 호출 추적

**사용 시점:**
- 실시간 모니터링
- 이벤트 추적
- 도구 사용 분석
- UI 업데이트

**파싱 방법:**
```typescript
import { StreamParser, UserEvent } from './lib/StreamParser'

const parser = new StreamParser()

process.stdin.on('data', (chunk: Buffer) => {
  const events = parser.processChunk(chunk.toString())

  events.forEach(event => {
    switch(event.type) {
      case 'system':
        console.log('Session:', event.session_id)
        break
      case 'message':
        console.log('Assistant:', event.message.content)
        break
      case 'tool_use':
        console.log('Tool:', event.tool, event.parameters)
        break
      case 'result':
        console.log('Status:', event.result.status)
        break
    }
  })
})
```

### 2. 일반 텍스트 (사람 친화적)

```bash
claude -p "쿼리"  # 기본
```

**특징:**
- 읽기 쉬운 형식
- Markdown 렌더링
- 사람이 읽기 위한 출력

**사용 시점:**
- 대화형 사용
- 리포트 생성
- 문서화

### 3. JSON (구조화된 출력)

```bash
claude -p "쿼리" --output-format json
```

**특징:**
- 최종 결과만 JSON
- 전체 응답 구조화
- 후처리 용이

**사용 시점:**
- API 통합
- 배치 처리
- 결과 저장

## 실전 사용 패턴

### 패턴 1: 빠른 분석 (읽기 전용)

```bash
claude \
  --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  -p "코드베이스 아키텍처 분석"
```

**최적화 포인트:**
- Plan 모드로 안전성 확보
- 분석용 MCP만 로드 (serena 등)
- 빠른 실행

### 패턴 2: 자동화된 코드 수정

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./src/**)",
      "Edit(./src/**)",
      "Bash(npm run test)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(rm:*)",
      "Bash(git push:*)"
    ]
  }
}
```

```bash
claude \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  --output-format stream-json \
  --verbose \
  -p "모든 TODO 주석에 이슈 번호 추가"
```

**최적화 포인트:**
- settings.json으로 필요한 권한만 허용 (안전)
- 개발용 MCP만 로드
- Stream JSON으로 진행상황 추적
- 상세 로그로 디버깅

### 패턴 3: CI/CD 통합

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read(**/*)",
      "Write(./src/**)",
      "Write(./tests/**)",
      "Edit(./src/**)",
      "Edit(./tests/**)",
      "Bash(npm run build)",
      "Bash(npm run test:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Bash(npm publish:*)",
      "Bash(git push origin main:*)",
      "WebFetch",
      "Read(./.env.production)"
    ]
  }
}
```

```bash
claude \
  --mcp-config .claude/.mcp-ci.json \
  --strict-mcp-config \
  --max-turns 5 \
  --output-format json \
  -p "테스트 실패 원인 분석하고 수정"
```

**최적화 포인트:**
- settings.json으로 CI 작업만 허용 (프로덕션 보호)
- CI 전용 MCP 설정
- max-turns로 비용 제어
- JSON 출력으로 결과 파싱

### 패턴 4: 인터랙티브 개발

```bash
claude \
  --model sonnet \
  --mcp-config .claude/.mcp-full.json \
  --strict-mcp-config
```

**최적화 포인트:**
- 대화형 모드
- 필요한 모든 MCP 로드
- 수동 권한 확인

### 패턴 5: 성능 벤치마크

```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read(**/*)",
      "Bash(git:*)"
    ]
  }
}
```

```bash
time claude \
  --mcp-config .claude/.mcp-empty.json \
  --strict-mcp-config \
  -p "/context" \
  > /dev/null
```

**최적화 포인트:**
- 빈 MCP로 순수 성능 측정
- settings.json으로 필요한 권한만 허용 (오버헤드 최소)
- 출력 무시로 I/O 최소화

## MCP 설정 파일 전략

### 분석용 (.claude/.mcp-analysis.json)

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@serena/mcp-server"]
    },
    "sequential-thinking": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

**용도:** 코드 분석, 아키텍처 탐색, Plan 모드

### 개발용 (.claude/.mcp-dev.json)

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@serena/mcp-server"]
    },
    "context7": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@context7/mcp-server"]
    },
    "magic": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@magic/mcp-server"]
    }
  }
}
```

**용도:** 일반 개발, 코드 작성, UI 생성

### CI/CD용 (.claude/.mcp-ci.json)

```json
{
  "mcpServers": {
    "serena": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@serena/mcp-server"]
    }
  }
}
```

**용도:** 자동화된 테스트 수정, CI 파이프라인

### 전체 기능 (.claude/.mcp-full.json)

```json
{
  "mcpServers": {
    "serena": {...},
    "context7": {...},
    "magic": {...},
    "sequential-thinking": {...},
    "playwright": {...}
  }
}
```

**용도:** 대화형 개발, 모든 기능 필요

### 최소 기능 (.claude/.mcp-empty.json)

```json
{
  "mcpServers": {}
}
```

**용도:** 순수 LLM 기능, 성능 테스트

## 컨텍스트 최적화 전략

### 1. MCP 서버 최소화

```bash
# ❌ 나쁜 예: 불필요한 MCP 로드
claude -p "간단한 질문"  # 모든 MCP 로드

# ✅ 좋은 예: 필요한 MCP만
claude --mcp-config .claude/.mcp-minimal.json --strict-mcp-config -p "간단한 질문"
```

### 2. Plan 모드 활용

```bash
# 탐색 단계: 읽기만
claude --permission-mode plan -p "코드 구조 파악"

# 실행 단계: 수정
claude --resume  # 이전 컨텍스트 이어서
```

### 3. 작업 분할

```bash
# ❌ 나쁜 예: 한 번에 모든 작업
claude -p "전체 시스템 리팩토링"

# ✅ 좋은 예: 단계별 실행
claude -p "1단계: 모델 리팩토링" --max-turns 3
claude -p "2단계: 컨트롤러 리팩토링" --max-turns 3
claude -p "3단계: 테스트 수정" --max-turns 3
```

### 4. 파일 참조 최적화

```bash
# ❌ 나쁜 예: 디렉토리 전체
claude -p "@src/ 모든 파일 분석"

# ✅ 좋은 예: 필요한 파일만
claude -p "@src/models/User.ts @src/api/users.ts 일관성 확인"
```

## 디버깅 및 모니터링

### 상세 로깅

```bash
claude --verbose -p "쿼리" 2>&1 | tee claude-debug.log
```

### 성능 측정

```bash
time claude \
  --mcp-config .claude/.mcp-test.json \
  --strict-mcp-config \
  -p "테스트 쿼리"
```

### 이벤트 추적

```bash
claude \
  --output-format stream-json \
  --verbose \
  -p "쿼리" | \
  jq -r 'select(.type=="tool_use") | .tool'
```

### 토큰 사용량 분석

```bash
claude \
  --verbose \
  -p "쿼리" 2>&1 | \
  grep -i "token"
```

## 보안 고려사항

### 1. 권한 설정 원칙

- **프로덕션**: 절대 `--dangerously-skip-permissions` 사용 금지
- **개발**: `acceptAll` 신중히 사용
- **CI/CD**: 격리된 환경에서만 자동 승인
- **탐색**: Plan 모드 기본 사용

### 2. MCP 서버 보안

```json
{
  "mcpServers": {
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${DATABASE_URL}"]
      // ✅ 환경 변수 사용
      // ❌ 하드코딩 금지: "--dsn", "postgresql://user:pass@host/db"
    }
  }
}
```

### 3. 민감 정보 보호

```bash
# .gitignore
.mcp.local.json
.claude/settings.local.json
*.log
```

## 성능 벤치마크 예시

```bash
# 1. 순수 LLM (MCP 없음)
time claude --mcp-config .claude/.mcp-empty.json --strict-mcp-config \
  --dangerously-skip-permissions -p "/context" > /dev/null
# 예상: 2-3초

# 2. 최소 MCP (serena만)
time claude --mcp-config .claude/.mcp-minimal.json --strict-mcp-config \
  --dangerously-skip-permissions -p "/context" > /dev/null
# 예상: 3-5초

# 3. 전체 MCP
time claude --dangerously-skip-permissions -p "/context" > /dev/null
# 예상: 5-10초
```

## 체크리스트

### 실행 전 확인사항

- [ ] 작업 목적에 맞는 MCP 설정 선택
- [ ] 권한 모드 적절히 설정
- [ ] 출력 형식 결정
- [ ] 필요시 verbose 로깅 활성화
- [ ] max-turns로 비용 제어 (비대화형)

### 최적화 확인사항

- [ ] 불필요한 MCP 서버 제거
- [ ] `--strict-mcp-config` 사용
- [ ] Plan 모드로 탐색 먼저
- [ ] 작업 단위 적절히 분할
- [ ] 파일 참조 최소화

### 보안 확인사항

- [ ] 민감 정보 환경 변수 처리
- [ ] .gitignore 설정 확인
- [ ] 프로덕션 환경 권한 검증
- [ ] MCP 서버 신뢰성 확인

## 참고 자료

- [CLI Reference](./claude-context/usage/cli-reference.md)
- [MCP Configuration](./claude-context/mcp-config/mcp-configuration.md)
- [Effective Queries](./claude-context/usage/effective-queries.md)
- [Settings Hierarchy](./claude-context/config/settings-hierarchy.md)
