# Claude Code Spec 설치 가이드

## 빠른 설치 (5분)

### 1️⃣ 설치 파일 선택

빌드 후 `out/make/` 디렉토리에 두 가지 설치 파일이 생성됩니다:

```
out/make/
├── Claude Code Spec.dmg          ← 추천! (105MB)
└── zip/darwin/arm64/
    └── Claude Code Spec-darwin-arm64-1.0.0.zip  (106MB)
```

**DMG 파일 추천 이유:**
- ✅ 더블클릭만으로 설치 가능
- ✅ 드래그 앤 드롭 UI 제공
- ✅ macOS 표준 설치 방식
- ✅ 자동으로 권한 설정

---

## 방법 1: DMG 파일로 설치 (가장 쉬움) 🎯

### 1단계: DMG 파일 열기
```bash
open "out/make/Claude Code Spec.dmg"
```

또는 Finder에서 더블클릭

### 2단계: 드래그 앤 드롭
DMG 창이 열리면:
1. **`Claude Code Spec.app`**을 **`Applications` 폴더**로 드래그
2. 복사가 완료되면 DMG 창 닫기
3. DMG 파일 추출 (선택사항)

### 3단계: 보안 설정 (최초 1회)
```bash
xattr -cr "/Applications/Claude Code Spec.app"
```

### 4단계: 실행
- **Spotlight**: `⌘ + Space` → "Claude Code Spec" 검색
- **Launchpad**: 앱 아이콘 클릭
- **터미널**: `open -a "Claude Code Spec"`

---

## 방법 2: ZIP 파일로 설치

### 1단계: ZIP 압축 해제
```bash
cd out/make/zip/darwin/arm64/
unzip "Claude Code Spec-darwin-arm64-1.0.0.zip"
```

또는 Finder에서 더블클릭

### 2단계: Applications 폴더로 이동
```bash
cp -r "Claude Code Spec.app" /Applications/
```

또는 Finder에서 드래그 앤 드롭

### 3단계: 보안 설정
```bash
xattr -cr "/Applications/Claude Code Spec.app"
```

### 4단계: 실행
```bash
open -a "Claude Code Spec"
```

---

## 보안 경고 해결 방법

### "확인되지 않은 개발자" 경고가 뜨면?

**방법 A: 터미널 명령어 (빠름)**
```bash
xattr -cr "/Applications/Claude Code Spec.app"
```

**방법 B: 시스템 설정 (수동)**
1. **시스템 설정** 열기
2. **개인 정보 보호 및 보안** → **보안**
3. 하단에 "Claude Code Spec" 관련 메시지 확인
4. **"확인 없이 열기"** 클릭

**방법 C: 우클릭 실행 (우회)**
1. Applications 폴더에서 앱 **우클릭**
2. **열기** 선택
3. 경고창에서 **열기** 클릭

---

## 첫 실행 후 설정

### 1. 프로젝트 경로 설정
- **Settings** 페이지로 이동
- **Project Path** 입력
- 예: `/Users/junwoobang/project/my-project`

### 2. MCP 서버 설정 (선택사항)
- **MCP Configs** 페이지에서 MCP 서버 편집
- 기본 제공:
  - `.claude/.mcp-analysis.json` (분석용)
  - `.claude/.mcp-dev.json` (개발용)

### 3. Claude CLI 확인
앱은 시스템에 설치된 Claude CLI를 사용합니다:
```bash
# 설치 확인
claude --version

# 미설치 시
npm install -g @anthropic-ai/claude-code
```

---

## 업데이트

새 버전으로 업데이트하려면:

```bash
# 1. 최신 코드 받기
git pull origin main
npm install

# 2. macOS 재빌드
npm run build:mac

# 3. 기존 앱 교체
# DMG 파일 열어서 다시 Applications로 드래그
open "out/make/Claude Code Spec.dmg"
```

---

## 제거 (Uninstall)

```bash
# 앱 삭제
rm -rf "/Applications/Claude Code Spec.app"

# 사용자 데이터 삭제 (선택사항)
rm -rf ~/Library/Application\ Support/claude-code-spec/

# 로그 파일 삭제 (선택사항)
rm -rf ~/Library/Application\ Support/claude-code-spec/logs/
```

---

## 설치 파일 만들기 (개발자용)

### 빌드 명령어
```bash
# 1. 의존성 설치
npm install

# 2. macOS용 DMG + ZIP 파일 생성
npm run build:mac
# 또는
npm run make

# 3. 결과물 확인
ls -lh out/make/
```

### 빌드 결과물
- **DMG**: `out/make/Claude Code Spec.dmg` (macOS 전용)
- **ZIP**: `out/make/zip/darwin/arm64/Claude Code Spec-darwin-arm64-1.0.0.zip` (macOS 전용)

### 빌드 옵션 변경
`forge.config.ts` 파일 편집:
```typescript
new MakerDMG({
  name: 'Claude Code Spec',
  format: 'ULFO',  // 압축 형식: ULFO(압축) or UDIF(비압축)
})
```

---

## 트러블슈팅

### 앱이 실행되지 않을 때

**1. 터미널에서 직접 실행하여 에러 확인**
```bash
/Applications/Claude\ Code\ Spec.app/Contents/MacOS/Claude\ Code\ Spec
```

**2. macOS Console.app에서 로그 확인**
- 애플리케이션 > 유틸리티 > 콘솔
- 검색: "Claude Code Spec"

**3. 로그 파일 확인**
```bash
# 프로덕션 로그
open ~/Library/Application\ Support/claude-code-spec/logs/

# 개발 모드 로그
cd /Users/junwoobang/project/claude-code-spec
open logs/
```

### "Claude CLI not found" 오류
```bash
# Claude CLI 재설치
npm install -g @anthropic-ai/claude-code

# PATH 확인
which claude
# 출력: /usr/local/bin/claude 또는 ~/.npm-global/bin/claude

# 환경변수 확인
echo $PATH
```

### 권한 문제
```bash
# 앱 권한 재설정
sudo xattr -cr "/Applications/Claude Code Spec.app"

# 또는 재설치
rm -rf "/Applications/Claude Code Spec.app"
open "out/make/Claude Code Spec.dmg"
```

---

## 도움말

- **상세 빌드 가이드**: [docs/BUILD_GUIDE.md](./docs/BUILD_GUIDE.md)
- **아키텍처 문서**: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)
- **설정 가이드**: [docs/SETUP.md](./docs/SETUP.md)
- **프로젝트 README**: [README.md](./README.md)

---

## 시스템 요구사항

- **OS**: macOS 11.0 (Big Sur) 이상
- **아키텍처**: Apple Silicon (M1/M2/M3) 또는 Intel
- **Node.js**: 18.x 이상 (개발용)
- **Claude CLI**: 최신 버전 필수

---

**설치 완료! 🎉**

이제 `⌘ + Space` → "Claude Code Spec"를 검색하여 실행하세요!
