# Features Overview

Claude Code 플랫폼의 모든 기능에 대한 통합 문서입니다. 각 기능은 Claude Code의 특정 기능을 담당하며, 라우팅 경로를 기반으로 구성되어 있습니다.

## 아키텍처 개요

이 플랫폼은 Claude Code의 실행을 제어하고 최적화하기 위한 분석 도구입니다:

- **실행 제어**: Claude CLI를 헤드리스 모드로 실행하고 제어
- **컨텍스트 최적화**: MCP 서버 선택, 권한 관리, 세션 추적을 통한 토큰 사용 최적화
- **분석 및 모니터링**: 실시간 스트림 파싱, 세션 로깅, 패턴 분석
- **문서화**: Claude Code 및 프로젝트 자체의 문서 관리

## Core Features

### 1. [Execute - Claude CLI 실행 및 제어](./execute/)
**Route**: `/` (Root)

Claude CLI를 실행하고 실시간으로 모니터링하는 핵심 기능입니다.

**담당 Claude Code 기능**:
- `claude -p "query"` 명령 실행
- `--output-format stream-json` 출력 포맷 제어
- `--mcp-config` MCP 서버 선택
- `--permission-mode` 권한 모드 제어
- 실시간 stdout/stderr 스트리밍

**주요 기능**:
- 프로젝트 경로 선택 및 컨텍스트 관리
- 쿼리 입력 및 실행
- MCP 설정 선택 (analysis, dev, empty)
- 모델 선택 (Sonnet, Opus)
- 실시간 스트림 출력 (JSON Lines 파싱)
- 최근 세션 빠른 접근
- 프로세스 제어 (실행/중단)

**관련 문서**: [Execute Feature](./execute/)

---

### 2. [Index - 페이지 인덱스](./index-page/)
**Route**: `/index`

모든 페이지와 기능에 빠르게 접근할 수 있는 카탈로그 시스템입니다.

**담당 Claude Code 기능**:
- N/A (플랫폼 자체 기능)

**주요 기능**:
- 전체 페이지 목록 및 카테고리별 분류
- 페이지 검색 (이름, 설명, 키워드)
- 빠른 네비게이션

**관련 문서**: [Index Feature](./index-page/)

---

### 3. [Claude Projects - 프로젝트 및 세션 관리](./claude-projects/)
**Routes**:
- `/claude-projects` - 프로젝트 목록
- `/claude-projects/:projectDirName` - 세션 목록
- `/claude-projects/:projectDirName/sessions/:sessionId` - 세션 상세
- `/claude-projects/:projectDirName/sessions/:sessionId/analysis` - 세션 분석 (신규)

Claude Code 실행 기록을 프로젝트 및 세션 단위로 관리합니다.

**담당 Claude Code 기능**:
- Session ID 추적 (각 실행의 고유 식별자)
- `~/.claude/projects/` 디렉토리 구조 분석
- 세션 메타데이터 수집 (CWD, 첫 메시지, 수정 시간)
- JSONL 로그 파일 읽기 및 파싱
- 서브 에이전트(isSidechain) 이벤트 추적

**주요 기능**:
- 프로젝트 목록 (페이지네이션, 정렬, 10개/페이지)
- 프로젝트별 세션 리스트 (20개/페이지, 메타데이터 enrichment)
- 세션 상세 보기 (이벤트 타임라인, 툴 호출 분석)
- **세션 분석** (신규):
  - 사용자 질문 필터링 (tool result 제외)
  - 자동 생성 요청 필터링 (isSidechain)
  - 탭 기반 뷰 전환
- IndexedDB 캐싱 (5분 TTL)
- 세션 로그 Export (JSON)
- 프로젝트 폴더 열기

**관련 문서**:
- [Claude Projects Feature](./claude-projects/)
- [Session Analysis Feature](./session-analysis.md) (신규)

---

### 4. [MCP Configs - MCP 설정 관리](./mcp-configs/)
**Route**: `/mcp-configs`

Model Context Protocol(MCP) 서버 설정을 관리하고 프리셋을 생성합니다.

**담당 Claude Code 기능**:
- `--mcp-config <path>` 설정 파일 경로 지정
- `--strict-mcp-config` 엄격 모드
- MCP 서버 선택 및 조합

**주요 기능**:
- MCP 설정 파일 목록 (`.claude/.mcp-*.json`)
- 설정 파일 생성, 편집, 삭제
- 사용 가능한 MCP 서버 조회
- 서버 선택 및 프리셋 생성
- Agent별 최적화된 MCP 프리셋 관리

**관련 문서**: [MCP Configs Feature](./mcp-configs/)

---

### 5. [Claude Docs - Claude Code 문서](./claude-docs/)
**Route**: `/claude-docs`

Claude Code 공식 문서를 로컬에 저장하고 탐색합니다.

**담당 Claude Code 기능**:
- Claude Code CLI 옵션 및 사용법
- Hooks 시스템
- Settings.json 권한 설정
- MCP 서버 통합
- 출력 포맷 (stream-json)

**주요 기능**:
- 문서 브라우징 및 검색
- 마크다운 렌더링
- 로컬 문서 캐싱

**관련 문서**: [Claude Docs Feature](./claude-docs/)

---

### 6. [Controller Docs - Controller 문서](./controller-docs/)
**Route**: `/controller-docs`

이 프로젝트 자체(Claude Code Controller)의 문서를 관리합니다.

**담당 Claude Code 기능**:
- N/A (플랫폼 자체 문서)

**주요 기능**:
- 프로젝트 아키텍처 문서
- 개발 가이드
- API 레퍼런스

**관련 문서**: [Controller Docs Feature](./controller-docs/)

---

### 7. [Memory - Memory 관리](./memory/)
**Route**: `/memory`

CLAUDE.md 파일의 Managed Regions를 편집하여 Claude Code에게 제공할 컨텍스트를 관리합니다.

**담당 Claude Code 기능**:
- `CLAUDE.md` 파일 인식 및 로딩
- Context references (`@context/...`)
- Managed Regions (`<!-- MEMORY_START -->...<!-- MEMORY_END -->`)

**주요 기능**:
- CLAUDE.md 파일 파싱 및 편집
- Managed Regions 관리 (추가, 수정, 삭제)
- Context 참조 유효성 검사
- 중복 참조 감지
- 자동 재구성 (reorganize)

**관련 문서**: [Memory Feature](./memory/)

---

### 8. [Settings - 설정 관리](./settings/)
**Route**: `/settings`

플랫폼 전역 설정 및 Claude Code 설정을 관리합니다.

**담당 Claude Code 기능**:
- `.claude/settings.json` 파일 관리
- 권한 설정 (permissions)
- 기본 MCP 설정
- 기본 모델 선택

**주요 기능**:
- 전역 설정 편집
- 프로젝트별 기본값 설정
- 권한 프리셋 관리

**관련 문서**: [Settings Feature](./settings/)

---

## Feature Map (라우팅 구조)

```
/                                                      → Execute (Claude CLI 실행)
/index                                                 → Index (페이지 카탈로그)
/claude-projects                                       → Projects List (프로젝트 목록)
/claude-projects/:projectDirName                       → Sessions List (세션 목록)
/claude-projects/:projectDirName/sessions/:sessionId   → Session Detail (세션 상세)
/claude-projects/:projectDirName/sessions/:sessionId/analysis → Session Analysis (세션 분석, 신규)
/mcp-configs                                           → MCP Configs (MCP 설정 관리)
/claude-docs                                           → Claude Docs (Claude Code 문서)
/controller-docs                                       → Controller Docs (프로젝트 문서)
/memory                                                → Memory (CLAUDE.md 편집)
/settings                                              → Settings (설정 관리)
```

## 개발 철학

### 1. 컨텍스트 최적화
- MCP 서버를 목적별로 분리 (analysis, dev, empty)
- Agent별 최적화된 MCP 프리셋 제공
- 불필요한 도구 제외로 초기화 시간 단축

### 2. 자동화와 안전성
- `settings.json`을 통한 명시적 권한 관리
- `--dangerously-skip-permissions` 대신 세밀한 권한 제어
- 안전하면서도 반복 작업 자동화

### 3. 가시성과 분석
- 실시간 스트림 파싱 (JSON Lines)
- 세션 로깅 및 이벤트 추적
- 패턴 분석을 통한 인사이트 도출

### 4. 문서 중심 개발
- `/memory`를 통한 컨텍스트 관리
- `/claude-docs`와 `/controller-docs`로 지식 체계화
- Managed Regions로 동적 문서 구성

---

## 다음 단계

각 기능별 상세 문서는 해당 폴더의 `README.md`를 참조하세요:

- [Execute](./execute/README.md) - Claude CLI 실행 및 제어
- [Index Page](./index-page/README.md) - 페이지 카탈로그
- [Claude Projects](./claude-projects/README.md) - 프로젝트 및 세션 관리
- [Session Analysis](./session-analysis.md) - 세션 분석 (사용자 질문/자동 요청 필터링)
- [MCP Configs](./mcp-configs/README.md) - MCP 설정 관리
- [Claude Docs](./claude-docs/README.md) - Claude Code 문서
- [Controller Docs](./controller-docs/README.md) - 프로젝트 문서
- [Memory](./memory/README.md) - CLAUDE.md 편집
- [Settings](./settings/README.md) - 설정 관리
