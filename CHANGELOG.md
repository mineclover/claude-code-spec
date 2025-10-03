# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

#### Tasks 기능 - Execute 최적화
- **의존성 분석 시스템**: 작업에 필요한 파일 및 문서 의존성 사전 정의
- **컨텍스트 자동 배정**: Execute 시 References 기반 자동 컨텍스트 구성
- **작업 영역 제한**: Area 설정으로 불필요한 컨텍스트 차단 및 토큰 절약
- **성공 기준 검증**: 체크리스트 기반 작업 완료 검증
- **리뷰 시스템**: 리뷰어 지정 및 산출물 검토 프로세스
- **작업 상태 추적**: pending/in_progress/completed/cancelled 상태 관리
- **Tasks 페이지**: 작업 목록 및 마크다운 편집기 UI
- **Task IPC API**: 작업 CRUD를 위한 IPC 핸들러
- **Task 마크다운 파서**: Task 객체 ↔ 마크다운 변환

#### Agents 기능 - 전문화된 AI 어시스턴트 (계획 단계)
- **Agent 시스템 설계**: Tasks를 수행할 전문화된 Agent 정의 및 관리
- **권한 제어**: Agent별 허용 도구 및 파일 접근 권한 제한
- **Agent 저장소**: 프로젝트 레벨(`.claude/agents/`)과 사용자 레벨(`~/.claude/agents/`) 지원
- **Tasks 통합**: Tasks에서 assigned_agent 및 reviewer 선택 기능
- **Execute 통합**: `claude --agent <name>` 명령으로 Agent 실행

#### 실행 관리 개선
- **ExecutionsPage**: 모든 실행 목록을 한눈에 확인
- **ExecutionDetailPage**: 개별 실행의 상세 정보 및 실시간 스트림
- **병렬 실행 모니터링**: 여러 실행을 동시에 추적
- **프로세스 제어**: 실행 중인 프로세스 종료 및 정리 기능

#### UI/UX 개선
- **전역 box-sizing**: 모든 요소에 `box-sizing: border-box` 기본 적용
- **레이아웃 최적화**: Layout mainContent의 overflow 수정으로 스크롤 개선
- **세션 카드 개선**: 고정 크기 제약 제거, 내용에 맞춰 자동 조정
- **세션 미리보기**: line-clamp 제거하여 전체 내용 표시
- **반응형 그리드**: Session 카드 그리드 레이아웃 개선

### Changed

#### 아키텍처 개선
- **페이지 분리**: ExecutePage를 ExecutionsPage와 ExecutionDetailPage로 분리
- **IPC 모듈화**: Task 관련 IPC 핸들러 추가
- **타입 시스템 확장**: Task 타입 정의 추가
- **페이지 인덱스 업데이트**: Tasks 페이지 정보 추가

#### 문서 업데이트
- **CLAUDE.md**: 현재 기능 목록 업데이트, 아키텍처 섹션 개선
- **README.md**: 주요 특징 재구성, Tasks 기능 섹션 추가, 프로젝트 구조 업데이트
- **Tasks 문서**: 상세한 Tasks 기능 사용 가이드 추가
- **Agents 문서**: Agents 기능 설계 및 구현 계획 문서 작성

### Fixed
- **세션 아이템 overflow**: ExecutePage와 ExecutionsPage의 sessionItem 내용 잘림 현상 해결
- **세션 카드 크기**: ClaudeSessionsListPage의 sessionCard 크기 제약 제거
- **스크롤 문제**: Layout의 이중 스크롤바 문제 해결

## Previous Releases

### [Earlier] - 2025-10-03

#### Features
- Claude CLI headless 실행
- Stream JSON 실시간 파싱
- 세션 관리 및 이어가기
- MCP 서버 선택 (분석/개발/최소)
- 세밀한 권한 제어 (settings.json)
- 프로젝트별 세션 로그 조회
- Memory 편집기 (CLAUDE.md)
- MCP 설정 편집기
- 문서 뷰어 (Claude Docs, Controller Docs)
- 설정 페이지

#### Technical
- Electron + React 19 + TypeScript
- IPC 라우터 시스템
- ProcessManager (병렬 실행)
- StreamParser (JSON 스트림 파싱)
- SessionManager (실행 이력)
- 모듈화 아키텍처
