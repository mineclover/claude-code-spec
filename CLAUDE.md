# Claude CLI Analytics & Control Platform

Claude CLI의 실행을 제어하고 컨텍스트 사용을 최적화하기 위한 분석 플랫폼입니다. Electron 기반으로 Claude CLI를 헤드리스 모드로 실행하며, 상세한 로깅과 프로세스 분석을 통해 효율적인 컨텍스트 관리를 지원합니다.

## 실행 방법

```bash
npm run start
```

## 현재 기능

1. **프로젝트 디렉토리 선택**: Browse 버튼 또는 직접 입력으로 프로젝트 경로 지정
2. **Claude CLI 실행**: 선택한 디렉토리에서 `claude -p "쿼리"` 명령 실행 (headless 모드)
3. **실시간 응답 스트리밍**: Claude CLI의 stdout/stderr를 실시간으로 화면에 표시
4. **에러 핸들링**: 에러 메시지를 별도로 표시

## 예정 기능

### 컨텍스트 제어
- **컨텍스트 크기 모니터링**: 실시간 토큰 사용량 추적
- **컨텍스트 최적화 제안**: 불필요한 컨텍스트 자동 감지 및 제거 제안
- **커스텀 컨텍스트 프리셋**: 프로젝트별 최적화된 컨텍스트 설정 저장/로드
- **컨텍스트 윈도우 관리**: 동적 컨텍스트 윈도우 크기 조절

### 로깅 및 분석
- **상세 실행 로그**: 모든 Claude CLI 실행 내역 및 파라미터 기록
- **응답 시간 분석**: 쿼리별 응답 시간 측정 및 통계
- **토큰 사용량 분석**: 입력/출력 토큰 사용 패턴 분석
- **비용 추적**: API 사용 비용 실시간 계산 및 리포트

### 프로세스 분석
- **작업 패턴 분석**: 자주 사용하는 명령 및 쿼리 패턴 식별
- **성능 메트릭**: CPU/메모리 사용량, 네트워크 지연시간 모니터링
- **에러 패턴 분석**: 반복되는 에러 유형 감지 및 해결 방안 제시
- **워크플로우 최적화**: 작업 흐름 분석을 통한 개선점 도출

### 데이터 시각화
- **대시보드**: 주요 메트릭 실시간 시각화
- **트렌드 차트**: 시간대별 사용 패턴 및 성능 추이
- **히트맵**: 컨텍스트 사용 집중도 시각화
- **리포트 생성**: 분석 결과 PDF/Excel 내보내기

## 기술 스택

- **Electron**: 데스크톱 앱 프레임워크
- **React 19**: UI 라이브러리
- **Vite**: 빌드 도구
- **TypeScript**: 타입 안전성
- **IPC 통신**: Main process와 Renderer process 간 통신

## 아키텍처

### Main Process (src/main.ts)
- Claude CLI를 `spawn`으로 실행
- stdout/stderr를 실시간으로 캡처
- IPC 채널로 renderer에 데이터 전송

### Preload (src/preload.ts)
- 안전한 IPC API를 window 객체에 노출
- `claudeAPI.executeClaudeCommand()`: 명령 실행
- `claudeAPI.onClaudeResponse()`: 응답 수신
- `claudeAPI.onClaudeError()`: 에러 수신
- `claudeAPI.selectDirectory()`: 디렉토리 선택

### Renderer (src/App.tsx)
- React로 구현된 UI
- 프로젝트 경로 입력/선택
- 쿼리 입력
- 실시간 응답 표시

## IPC 채널

- `claude:execute`: 명령 실행 요청
- `claude:response`: stdout 데이터 전송
- `claude:error`: stderr 데이터 전송
- `claude:complete`: 프로세스 완료 알림
- `dialog:selectDirectory`: 디렉토리 선택 다이얼로그

## 프로젝트 비전

이 프로젝트는 단순한 Claude CLI 실행 도구를 넘어, AI 개발 워크플로우의 효율성을 극대화하는 분석 플랫폼을 지향합니다. 컨텍스트 사용을 최적화하고, 상세한 로깅과 분석을 통해 개발자가 더 효과적으로 Claude를 활용할 수 있도록 지원하는 것이 목표입니다.

### 핵심 가치
- **효율성**: 컨텍스트 최적화를 통한 비용 절감
- **가시성**: 모든 프로세스의 투명한 모니터링
- **인사이트**: 데이터 기반 의사결정 지원
- **자동화**: 반복 작업 및 최적화 자동화

## Claude Code 실행 설정

### 권한 관리
프로젝트는 `.claude/settings.json`을 통해 세밀한 권한 제어를 사용합니다.
`--dangerously-skip-permissions` 대신 필요한 권한만 명시적으로 허용하여 안전하게 자동화합니다.

**설정 파일:** `.claude/settings.json` (팀 공유, git 커밋됨)

**자세한 내용:** [SETUP.md](./docs/SETUP.md) | [실행 전략](./docs/claude-context/usage/claude-execution-strategy.md) | [권한 설정](./docs/claude-context/config/permissions-configuration.md)

### MCP 서버 선택
- **분석용:** `.claude/.mcp-analysis.json` (serena + sequential-thinking)
- **개발용:** `.claude/.mcp-dev.json` (serena + context7)
- **최소:** `.claude/.mcp-empty.json` (MCP 없음)

## 테스트용 쿼리 템플릿

### UI 입력 → CLI 명령어 변환
UI의 Query 입력란에 입력한 내용은 다음과 같이 변환됩니다:
```
UI 입력: "/context"
↓
CLI 실행: claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config
```

**특징:**
- `settings.json`의 권한 규칙 자동 적용 (안전)
- 개발용 MCP 서버만 로드 (빠른 초기화)
- 안전하면서도 자동화된 실행

### 빠른 테스트용 명령어 (터미널에서 직접 실행)

```bash
# 프로젝트 디렉토리로 이동
cd /Users/junwoobang/project/claude-code-spec

# 1. 읽기 전용 분석 (Plan 모드)
claude --permission-mode plan \
  --mcp-config .claude/.mcp-analysis.json --strict-mcp-config \
  -p "프로젝트 아키텍처 분석"

# 2. /context 명령어 (settings.json 권한 사용)
claude -p "/context" --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config

# 3. 간단한 질문 (최소 MCP)
claude --mcp-config .claude/.mcp-empty.json --strict-mcp-config \
  -p "What files are in this directory?"

# 4. 코드 분석
claude --mcp-config .claude/.mcp-analysis.json --strict-mcp-config \
  -p "Explain the StreamParser class in src/lib/StreamParser.ts"

# 5. 파일 수정 (settings.json 권한 사용)
claude --mcp-config .claude/.mcp-dev.json --strict-mcp-config \
  -p "Add a comment to the processChunk method explaining what it does"

# 6. 실시간 모니터링
claude --output-format stream-json --verbose \
  --mcp-config .claude/.mcp-dev.json --strict-mcp-config \
  -p "/context" 2>&1 | tee test-output.log
```

### UI에서 테스트하기

1. **프로젝트 경로**: `/Users/junwoobang/project/claude-code-spec`
2. **테스트 쿼리**:
   - `/context` - 현재 컨텍스트 정보 확인
   - `/help` - 도움말 확인
   - `List all files in src/components` - 파일 목록
   - `What is the purpose of this project?` - 프로젝트 설명

### 출력 형식 확인

Stream JSON 출력은 JSONL 형식 (JSON Lines):
```jsonl
{"type":"system","subtype":"init","session_id":"...","model":"...","cwd":"..."}
{"type":"message","subtype":"assistant","message":{"role":"assistant","content":[...]}}
{"type":"result","result":{"status":"success","duration_ms":1234}}
```

각 줄은 완전한 JSON 객체여야 하며, 줄바꿈(`\n`)으로 구분됩니다.

---

## Memory 관리 영역

아래 영역들은 Memory Editor를 통해 관리됩니다.

<!-- MEMORY_START: references -->
## References
@context/memory/index.md
@context/config/permissions-configuration.md
<!-- MEMORY_END: references -->

<!-- MEMORY_START: tools -->
## Development Tools


`@context/usage/claude-execution-strategy.md` 

- 실행 전략 문서입니다. 필요 시 참조하세요.
- 실행
<!-- MEMORY_END: tools -->