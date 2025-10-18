# 빌드 및 설치 가이드

Claude CLI Analytics & Control Platform을 macOS 앱으로 빌드하고 설치하는 방법을 안내합니다.

## 목차
- [사전 요구사항](#사전-요구사항)
- [빌드 프로세스](#빌드-프로세스)
- [설치 및 실행](#설치-및-실행)
- [트러블슈팅](#트러블슈팅)

## 사전 요구사항

### 1. Node.js 및 npm
```bash
# Node.js 버전 확인 (18.x 이상 권장)
node --version

# npm 버전 확인
npm --version
```

Node.js가 설치되지 않았다면 [공식 사이트](https://nodejs.org/)에서 다운로드하세요.

### 2. 의존성 설치
```bash
# 프로젝트 디렉토리로 이동
cd /Users/junwoobang/project/claude-code-spec

# 의존성 설치
npm install
```

### 3. Claude CLI 설치
이 앱은 시스템에 설치된 Claude CLI를 사용합니다:
```bash
# Claude CLI 설치 (이미 설치되지 않은 경우)
npm install -g @anthropic-ai/claude-code

# 설치 확인
claude --version
```

## 빌드 프로세스

### 개발 모드 실행
빌드하기 전에 개발 모드에서 정상 동작을 확인하세요:
```bash
npm start
```

### 프로덕션 빌드

#### 1. 패키징 (빠른 테스트용)
앱을 패키징만 하고 배포 가능한 설치 파일은 생성하지 않습니다:
```bash
npm run package:mac
# 또는
npm run package
```

**결과물:**
- 위치: `out/claude-code-spec-darwin-arm64/` (Apple Silicon) 또는 `out/claude-code-spec-darwin-x64/` (Intel)
- 내용: `Claude Code Spec.app` 실행 파일

#### 2. macOS 배포용 빌드 (권장)
설치 가능한 DMG 및 ZIP 파일을 생성합니다:
```bash
npm run build:mac
# 또는
npm run make
```

**결과물:**
- **DMG 파일** (추천): `out/make/Claude Code Spec.dmg` (~105MB)
- **ZIP 파일**: `out/make/zip/darwin/arm64/Claude Code Spec-darwin-arm64-1.0.0.zip` (~106MB)

**빌드 시간:** 일반적으로 1-3분 소요

**DMG vs ZIP:**
- ✅ **DMG**: 더블클릭으로 설치, 드래그 앤 드롭 UI, macOS 표준 방식
- **ZIP**: 압축 해제 후 수동 이동 필요

## 설치 및 실행

### 방법 1: DMG 파일에서 설치 (가장 쉬움, 권장)

1. **DMG 파일 열기**
   ```bash
   open out/make/Claude\ Code\ Spec.dmg
   ```

2. **드래그 앤 드롭**
   - DMG 창이 열리면 `Claude Code Spec.app`을 `Applications` 폴더로 드래그
   - 복사가 완료되면 DMG 창 닫기

3. **보안 설정**
   ```bash
   xattr -cr "/Applications/Claude Code Spec.app"
   ```

4. **실행**
   - Spotlight (⌘ + Space)에서 "Claude Code Spec" 검색
   - 또는 Launchpad에서 아이콘 클릭
   - 또는 터미널에서: `open -a "Claude Code Spec"`

### 방법 2: ZIP 파일에서 설치

1. **ZIP 파일 압축 해제**
   ```bash
   cd out/make/zip/darwin/arm64
   unzip claude-code-spec-darwin-arm64-1.0.0.zip
   ```

2. **Applications 폴더로 이동**
   ```bash
   # Finder에서
   open .
   # Claude Code Spec.app을 Applications 폴더로 드래그 앤 드롭

   # 또는 터미널에서
   cp -r "Claude Code Spec.app" /Applications/
   ```

3. **실행**
   - Spotlight (⌘ + Space)에서 "Claude Code Spec" 검색
   - 또는 Applications 폴더에서 더블클릭
   - 또는 터미널에서: `open -a "Claude Code Spec"`

### 방법 3: 패키징 디렉토리에서 직접 실행 (테스트용)

```bash
# 빌드된 앱 경로 확인
cd out/claude-code-spec-darwin-arm64

# 실행
open "Claude Code Spec.app"
```

**빠른 설치 가이드:** 더 상세한 설치 방법은 [INSTALL.md](../INSTALL.md)를 참고하세요.

## 첫 실행 설정

앱을 처음 실행하면:

1. **보안 경고 (macOS Gatekeeper)**
   - "Claude Code Spec.app"은 확인되지 않은 개발자로부터 다운로드되었습니다" 경고가 표시될 수 있습니다
   - **해결방법:**
     ```bash
     # 앱의 격리 속성 제거
     xattr -cr "/Applications/Claude Code Spec.app"

     # 또는 시스템 설정에서 수동으로 허용:
     # 시스템 설정 > 개인 정보 보호 및 보안 > 보안 > "확인 없이 열기"
     ```

2. **프로젝트 경로 설정**
   - Settings 페이지에서 분석할 프로젝트 경로를 설정하세요
   - 예: `/Users/junwoobang/project/my-project`

3. **MCP 서버 설정 (선택사항)**
   - MCP Configs 페이지에서 필요한 MCP 서버를 설정하세요
   - 기본 제공: `.claude/.mcp-analysis.json`, `.claude/.mcp-dev.json`

4. **로그 파일 위치**
   - 개발 모드: `프로젝트루트/logs/`
   - 프로덕션(설치된 앱): `~/Library/Application Support/claude-code-spec/logs/`
   - 로그 파일은 JSONL 형식으로 저장됩니다

## 업데이트

새로운 버전으로 업데이트하려면:

1. **최신 코드 받기**
   ```bash
   cd /Users/junwoobang/project/claude-code-spec
   git pull origin main
   npm install
   ```

2. **재빌드 (macOS)**
   ```bash
   npm run build:mac
   ```

3. **기존 앱 교체**
   - 새로 빌드된 앱을 Applications 폴더에 덮어쓰기

## 트러블슈팅

### 빌드 오류

#### "Cannot find module" 오류
```bash
# node_modules 삭제 후 재설치
rm -rf node_modules package-lock.json
npm install
```

#### "Not allowed to load local resource" 오류
이미 수정되었습니다. `src/main/window.ts`에서 올바른 경로를 사용합니다:
```typescript
// 수정됨: ../../renderer → ../renderer
mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
```

#### "Permission denied" 오류
```bash
# npm 캐시 정리
npm cache clean --force
npm install
```

#### TypeScript 컴파일 오류
```bash
# TypeScript 타입 체크
npm run lint

# 자동 수정
npm run lint:fix
```

### 실행 오류

#### 앱이 즉시 종료됨
```bash
# 터미널에서 실행하여 에러 로그 확인
/Applications/Claude\ Code\ Spec.app/Contents/MacOS/Claude\ Code\ Spec

# 또는 macOS Console.app에서 로그 확인
# 애플리케이션 > 유틸리티 > 콘솔 > 'Claude Code Spec' 검색
```

#### 로그 파일 접근
```bash
# 프로덕션 앱 로그 디렉토리 확인
open ~/Library/Application\ Support/claude-code-spec/logs/

# 또는 개발 모드 로그
open logs/
```

#### "Claude CLI not found" 오류
```bash
# Claude CLI 재설치
npm install -g @anthropic-ai/claude-code

# PATH 확인
which claude
# /usr/local/bin/claude 또는 ~/.npm-global/bin/claude 등이 표시되어야 함
```

#### Stream JSON 파싱 에러
- Settings에서 올바른 프로젝트 경로가 설정되었는지 확인
- `.claude/settings.json` 파일이 유효한지 확인
- MCP 설정 파일(`.claude/.mcp-*.json`)이 유효한지 확인

### 성능 문제

#### 앱이 느리게 실행됨
```bash
# 개발자 도구로 디버깅
# 앱 실행 후 View > Toggle Developer Tools (⌘⌥I)
```

#### 메모리 사용량이 높음
- Executions 페이지에서 오래된 실행 기록 정리
- 브라우저 캐시 정리 (개발자 도구 > Application > Clear Storage)

## 배포 옵션

### DMG 파일 생성 (이미 설정됨 ✅)

DMG 파일은 기본적으로 생성됩니다. `forge.config.ts`에 이미 설정되어 있습니다:

```typescript
import { MakerDMG } from '@electron-forge/maker-dmg';

makers: [
  new MakerDMG({
    name: 'Claude Code Spec',
    format: 'ULFO',  // Compressed format
  }, ['darwin'])
]
```

**커스터마이징 옵션:**
```typescript
new MakerDMG({
  name: 'Claude Code Spec',
  icon: 'assets/icon.icns',     // 커스텀 아이콘
  background: 'assets/dmg-bg.png', // 배경 이미지
  format: 'ULFO',                // ULFO(압축) or UDIF(비압축)
  window: {
    size: { width: 660, height: 400 }
  }
})
```

### 코드 서명 (Apple Developer Program 필요)

앱 스토어 배포 또는 Gatekeeper 경고 제거를 위해:

1. **Apple Developer 계정 준비**
   - [Apple Developer Program](https://developer.apple.com/programs/) 가입 필요

2. **forge.config.ts에 서명 설정 추가**
   ```typescript
   packagerConfig: {
     asar: true,
     osxSign: {
       identity: 'Developer ID Application: Your Name (TEAM_ID)',
       'hardened-runtime': true,
       entitlements: 'entitlements.plist',
       'entitlements-inherit': 'entitlements.plist'
     },
     osxNotarize: {
       appleId: process.env.APPLE_ID,
       appleIdPassword: process.env.APPLE_PASSWORD,
       teamId: process.env.APPLE_TEAM_ID
     }
   }
   ```

## 빌드 스크립트 요약

| 명령어 | 용도 | 결과물 |
|--------|------|--------|
| `npm start` | 개발 모드 실행 | 없음 (개발 서버) |
| `npm run package:mac` | macOS 패키징 (테스트용) | `out/claude-code-spec-darwin-*/` |
| `npm run build:mac` | macOS 배포용 빌드 (DMG + ZIP) | `out/make/` |
| `npm run make` | `build:mac`의 별칭 (하위 호환성) | `out/make/` |

## 추가 리소스

- [Electron Forge 문서](https://www.electronforge.io/)
- [프로젝트 아키텍처](./ARCHITECTURE.md)
- [MCP 설정 가이드](./mcp-config-guide.md)
- [개발 환경 설정](./SETUP.md)

## 도움이 필요하신가요?

문제가 지속되면:
1. [GitHub Issues](https://github.com/your-org/claude-code-spec/issues)에 보고
2. 로그 파일 첨부: 앱 실행 시 터미널 출력
3. 환경 정보 포함: macOS 버전, Node.js 버전, Apple Silicon/Intel
