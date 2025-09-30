# Claude CLI Headless Controller

Electron 앱으로 Claude CLI를 헤드리스 모드로 실행하고 결과를 웹 UI로 확인할 수 있는 도구입니다.

## 실행 방법

```bash
npm run start
```

## 주요 기능

1. **프로젝트 디렉토리 선택**: Browse 버튼 또는 직접 입력으로 프로젝트 경로 지정
2. **Claude CLI 실행**: 선택한 디렉토리에서 `claude -p "쿼리"` 명령 실행 (headless 모드)
3. **실시간 응답 스트리밍**: Claude CLI의 stdout/stderr를 실시간으로 화면에 표시
4. **에러 핸들링**: 에러 메시지를 별도로 표시

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