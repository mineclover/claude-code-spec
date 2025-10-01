# Permissions Configuration

## 개요

Claude Code는 세밀한 권한 제어를 통해 안전하면서도 자동화된 실행이 가능합니다. `--dangerously-skip-permissions` 플래그 대신 `settings.json`에서 도구별, 파일별 권한을 설정하여 보안을 유지하면서 워크플로우를 자동화할 수 있습니다.

## 권한 규칙 타입

### 1. allow (허용)

명시적으로 자동 승인할 작업을 지정합니다.

**특징:**
- 확인 없이 자동 실행
- 반복적이고 안전한 작업에 적합
- 자동화 워크플로우에 필수

**사용 시점:**
- 읽기 전용 명령어 (git status, npm run lint)
- 안전한 빌드/테스트 명령
- 특정 디렉토리의 파일 읽기

### 2. deny (거부)

특정 작업을 완전히 차단합니다.

**특징:**
- 실행 시도 시 즉시 차단
- 민감한 파일이나 위험한 명령 보호
- 실수 방지

**사용 시점:**
- 환경 변수 파일 접근
- 프로덕션 배포 명령
- 민감한 API 호출
- 시스템 변경 명령

### 3. ask (확인 요청)

실행 전 사용자 확인을 요청합니다. (기본값)

**특징:**
- 수동 승인 필요
- 유연한 제어
- 학습 및 검토용

**사용 시점:**
- 코드 수정 작업
- 파일 쓰기
- Git 푸시
- 불확실한 작업

## 권한 규칙 문법

### Bash 명령어 권한

```json
{
  "permissions": {
    "allow": [
      "Bash(git status)",           // 정확한 명령어 매칭
      "Bash(npm run test:*)",       // 패턴 매칭 (test:로 시작)
      "Bash(git diff:*)"            // git diff로 시작하는 모든 명령
    ],
    "deny": [
      "Bash(rm -rf:*)",             // 위험한 삭제 명령 차단
      "Bash(curl:*)",               // 외부 요청 차단
      "Bash(npm publish:*)"         // 배포 차단
    ],
    "ask": [
      "Bash(git push:*)",           // 푸시 전 확인
      "Bash(npm install:*)"         // 패키지 설치 확인
    ]
  }
}
```

**패턴 규칙:**
- `Bash(command)`: 정확한 명령어
- `Bash(command:*)`: command로 시작하는 모든 명령
- `:*` 와일드카드로 접두사 매칭

### 파일 접근 권한

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",             // src 디렉토리 읽기 허용
      "Read(./package.json)",       // 특정 파일 읽기
      "Glob(*.ts)"                  // 타입스크립트 파일 검색
    ],
    "deny": [
      "Read(./.env)",               // 환경 변수 차단
      "Read(./.env.*)",             // 모든 env 파일
      "Read(./secrets/**)",         // secrets 디렉토리 전체
      "Write(./dist/**)",           // 빌드 결과 수정 차단
      "Edit(./package-lock.json)"   // lock 파일 수정 방지
    ],
    "ask": [
      "Write(./src/**)",            // 소스 수정 전 확인
      "Edit(./package.json)"        // 패키지 정보 수정 확인
    ]
  }
}
```

**파일 도구:**
- `Read(path)`: 파일 읽기
- `Write(path)`: 파일 쓰기
- `Edit(path)`: 파일 편집
- `Glob(pattern)`: 파일 검색

**경로 패턴:**
- `./file.txt`: 정확한 파일
- `./*.txt`: 현재 디렉토리의 txt 파일
- `./dir/**`: 디렉토리와 모든 하위 항목

### 기타 도구 권한

```json
{
  "permissions": {
    "deny": [
      "WebFetch",                   // 모든 외부 요청 차단
      "Task"                        // 서브 에이전트 차단
    ],
    "allow": [
      "Grep(**/*.ts)"               // 타입스크립트 파일 검색
    ]
  }
}
```

**도구 목록:**
- `WebFetch`: 외부 웹 요청
- `Task`: 서브 에이전트 실행
- `Grep`: 파일 내용 검색
- `Glob`: 파일 이름 검색

## 실전 설정 예시

### 1. 자동화된 분석 환경

```json
{
  "permissions": {
    "allow": [
      // 안전한 읽기 작업
      "Read(./src/**)",
      "Read(./docs/**)",
      "Read(./package.json)",
      "Read(./tsconfig.json)",

      // 정보 조회 명령
      "Bash(git status)",
      "Bash(git log:*)",
      "Bash(git diff:*)",
      "Bash(npm run lint)",
      "Bash(npm run test)",

      // 검색 도구
      "Grep(**/*.ts)",
      "Glob(**/*.ts)"
    ],
    "deny": [
      // 민감한 파일
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",

      // 위험한 명령
      "Bash(rm:*)",
      "Bash(curl:*)",
      "Bash(npm publish:*)",

      // 외부 접근
      "WebFetch"
    ],
    "ask": [
      // 기본적으로 확인 (명시하지 않아도 ask가 기본값)
    ]
  }
}
```

**용도:** Plan 모드, 코드 분석, 아키텍처 탐색

### 2. 개발 환경 (자동 수정)

```json
{
  "permissions": {
    "allow": [
      // 읽기 (분석 환경과 동일)
      "Read(./src/**)",
      "Read(./docs/**)",
      "Glob(**/*)",
      "Grep(**/*)",

      // 소스 코드 수정
      "Write(./src/**)",
      "Edit(./src/**)",

      // 문서 수정
      "Write(./docs/**)",
      "Edit(./docs/**)",

      // 안전한 빌드/테스트
      "Bash(npm run build)",
      "Bash(npm run test:*)",
      "Bash(npm run lint:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      // 민감한 파일
      "Read(./.env)",
      "Write(./.env)",
      "Edit(./package-lock.json)",

      // 위험한 작업
      "Bash(rm:*)",
      "Bash(git push:*)",
      "Bash(npm publish:*)",
      "WebFetch"
    ],
    "ask": [
      // 중요한 파일 수정
      "Edit(./package.json)",
      "Edit(./tsconfig.json)",
      "Edit(./.gitignore)",

      // 의존성 변경
      "Bash(npm install:*)",
      "Bash(npm uninstall:*)"
    ]
  }
}
```

**용도:** 일반 개발, 코드 수정, 리팩토링

### 3. CI/CD 환경

```json
{
  "permissions": {
    "allow": [
      // 전체 읽기
      "Read(**/*)",
      "Glob(**/*)",
      "Grep(**/*)",

      // 소스 수정
      "Write(./src/**)",
      "Edit(./src/**)",

      // 테스트 수정
      "Write(./tests/**)",
      "Edit(./tests/**)",

      // CI 명령
      "Bash(npm run build)",
      "Bash(npm run test:*)",
      "Bash(npm run lint:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(git diff:*)",
      "Bash(git status)"
    ],
    "deny": [
      // 프로덕션 보호
      "Bash(npm publish:*)",
      "Bash(git push origin main:*)",

      // 외부 접근
      "WebFetch",

      // 민감 파일
      "Read(./.env.production)",
      "Write(./dist/**)"
    ]
  }
}
```

**용도:** 자동화된 테스트 수정, CI 파이프라인

### 4. 읽기 전용 (최대 보안)

```json
{
  "permissions": {
    "allow": [
      // 읽기만 허용
      "Read(./src/**)",
      "Read(./docs/**)",
      "Read(./package.json)",
      "Glob(**/*.ts)",
      "Grep(**/*.ts)",

      // 정보 조회만
      "Bash(git status)",
      "Bash(git log:*)",
      "Bash(git diff:*)"
    ],
    "deny": [
      // 모든 쓰기 차단
      "Write(**/*)",
      "Edit(**/*)",

      // 모든 Bash 실행 차단 (allow 제외)
      "Bash(*)",

      // 외부 접근 차단
      "WebFetch",
      "Task"
    ]
  }
}
```

**용도:** 코드 리뷰, 외부 분석, 학습

### 5. UI 개발 환경

```json
{
  "permissions": {
    "allow": [
      // UI 파일 수정
      "Read(./src/**)",
      "Write(./src/components/**)",
      "Edit(./src/components/**)",
      "Write(./src/pages/**)",
      "Edit(./src/pages/**)",
      "Write(./src/styles/**)",
      "Edit(./src/styles/**)",

      // 개발 서버
      "Bash(npm run dev)",
      "Bash(npm run build)",

      // UI 도구
      "WebFetch",  // 21st.dev 등 UI 리소스
      "Task"       // UI 생성 에이전트
    ],
    "deny": [
      // 백엔드 보호
      "Edit(./src/api/**)",
      "Edit(./src/models/**)",

      // 설정 보호
      "Edit(./package.json)",
      "Edit(./tsconfig.json)",

      // 민감 파일
      "Read(./.env)"
    ]
  }
}
```

**용도:** 프론트엔드 개발, UI 컴포넌트 작업

## 설정 파일 구조

### 디렉토리 구조

```
project/
├── .claude/
│   ├── settings.json              # 팀 공유 설정
│   ├── settings.local.json        # 개인 설정
│   ├── .mcp-analysis.json         # 분석용 MCP
│   ├── .mcp-dev.json              # 개발용 MCP
│   └── .mcp-ci.json               # CI용 MCP
└── ~/.claude/
    └── settings.json              # 사용자 전역 설정
```

### 팀 공유 설정 (.claude/settings.json)

```json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Bash(npm run lint)",
      "Bash(npm run test)"
    ],
    "deny": [
      "Read(./.env)",
      "Bash(npm publish:*)"
    ]
  }
}
```

### 개인 오버라이드 (.claude/settings.local.json)

```json
{
  "permissions": {
    "allow": [
      // 개인 개발에 필요한 추가 권한
      "Write(./src/**)",
      "Edit(./src/**)",
      "Bash(npm run dev)"
    ]
  }
}
```

## 명령줄 실행 방법

### 1. 설정 파일 사용

```bash
# .claude/settings.json 자동 로드
claude -p "코드 분석해줘"
```

### 2. 명령줄 권한 모드

```bash
# 모든 작업 자동 승인
claude --permission-mode acceptAll -p "작업"

# 플랜 모드 (읽기 전용)
claude --permission-mode plan -p "분석"

# 기본 모드 (ask)
claude -p "작업"  # 매번 확인
```

### 3. 설정 조합

```bash
# 분석용 MCP + 읽기 전용 권한
claude \
  --mcp-config .claude/.mcp-analysis.json \
  --strict-mcp-config \
  --permission-mode plan \
  -p "아키텍처 분석"

# 개발용 MCP + settings.json 권한
claude \
  --mcp-config .claude/.mcp-dev.json \
  --strict-mcp-config \
  -p "TODO 주석 수정"
# .claude/settings.json의 권한 규칙이 자동 적용됨
```

## 우선순위 및 병합 규칙

### 설정 우선순위 (높음 → 낮음)

1. **Enterprise Managed Policy** (시스템 레벨)
2. **Command Line Arguments** (`--permission-mode`)
3. **Local Project Settings** (`.claude/settings.local.json`)
4. **Shared Project Settings** (`.claude/settings.json`)
5. **User Settings** (`~/.claude/settings.json`)

### 병합 동작

```json
// User (~/.claude/settings.json)
{
  "permissions": {
    "allow": ["Read(./src/**)"],
    "deny": ["WebFetch"]
  }
}

// Project (.claude/settings.json)
{
  "permissions": {
    "allow": ["Bash(npm run test)"],
    "deny": ["Bash(rm:*)"]
  }
}

// 결과: 배열은 병합됨
{
  "permissions": {
    "allow": [
      "Read(./src/**)",      // From user
      "Bash(npm run test)"   // From project
    ],
    "deny": [
      "WebFetch",            // From user
      "Bash(rm:*)"           // From project
    ]
  }
}
```

## 권한 디버깅

### 1. 권한 확인

```bash
# verbose 모드로 권한 동작 확인
claude --verbose -p "작업" 2>&1 | grep -i permission
```

### 2. 설정 검증

```bash
# JSON 문법 확인
jq . < .claude/settings.json

# 특정 키 확인
jq .permissions < .claude/settings.json
```

### 3. 테스트 실행

```bash
# 안전한 명령으로 테스트
claude -p "/context"  # 권한 동작 확인

# 특정 권한 테스트
claude -p "Read ./package.json"
```

## 마이그레이션 가이드

### --dangerously-skip-permissions에서 전환

**Before:**
```bash
claude --dangerously-skip-permissions -p "자동화 작업"
```

**After:**
```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read(./src/**)",
      "Write(./src/**)",
      "Edit(./src/**)",
      "Bash(npm run:*)",
      "Bash(git add:*)",
      "Bash(git commit:*)"
    ],
    "deny": [
      "Bash(git push:*)",
      "Bash(rm:*)",
      "Read(./.env)"
    ]
  }
}
```

```bash
# 설정 파일이 자동 로드됨
claude -p "자동화 작업"
```

**장점:**
- 세밀한 제어
- 위험한 작업 차단
- 팀 공유 가능
- 감사 가능

### 단계별 전환

**1단계: 로깅 활성화**
```bash
claude --verbose -p "작업" 2>&1 | tee permissions.log
```

**2단계: 사용된 권한 분석**
```bash
grep -i "permission" permissions.log | sort | uniq
```

**3단계: 필요한 권한 추출**
```bash
# 로그에서 allow 할 도구 확인
grep "Tool:" permissions.log
```

**4단계: settings.json 작성**
```json
{
  "permissions": {
    "allow": [
      // 로그에서 확인한 안전한 작업들
    ],
    "deny": [
      // 절대 허용하면 안 되는 작업
    ]
  }
}
```

**5단계: 테스트**
```bash
claude -p "같은 작업" # --dangerously-skip-permissions 제거
```

## 보안 모범 사례

### 1. 최소 권한 원칙

```json
{
  "permissions": {
    "allow": [
      // 꼭 필요한 것만
      "Read(./src/specific-dir/**)"  // ✅ 구체적
      // "Read(**/*)"                 // ❌ 너무 광범위
    ]
  }
}
```

### 2. 명시적 거부

```json
{
  "permissions": {
    "deny": [
      // 명시적으로 차단
      "Read(./.env)",
      "Read(./.env.*)",
      "Read(./secrets/**)",
      "Bash(rm:*)",
      "Bash(curl:*)",
      "Bash(npm publish:*)"
    ]
  }
}
```

### 3. 버전 관리

```bash
# .gitignore
.claude/settings.local.json  # 개인 설정 제외

# 팀 설정은 커밋
git add .claude/settings.json
git commit -m "Add permissions configuration"
```

### 4. 문서화

```markdown
# README.md

## Claude Code 설정

### 권한 설정
프로젝트는 `.claude/settings.json`에 정의된 권한을 사용합니다.

허용된 작업:
- 소스 코드 읽기/쓰기
- npm run 명령 (test, lint, build)
- git 명령 (add, commit, diff)

차단된 작업:
- 환경 변수 파일 접근
- git push
- npm publish
```

## 체크리스트

### 설정 작성 시

- [ ] 최소 권한 원칙 적용
- [ ] 민감한 파일 명시적 거부
- [ ] 위험한 명령 차단
- [ ] 팀원과 권한 정책 합의
- [ ] README에 문서화

### 실행 전

- [ ] `jq`로 JSON 문법 확인
- [ ] 테스트 명령으로 검증
- [ ] verbose 모드로 디버깅
- [ ] 로그에서 권한 동작 확인

### 보안 검토

- [ ] `.env` 파일 보호
- [ ] `secrets/` 디렉토리 차단
- [ ] 프로덕션 명령 차단
- [ ] 외부 요청 제한
- [ ] 개인 설정 파일 .gitignore

## 참고 자료

- [Settings Documentation](https://docs.claude.com/en/docs/claude-code/settings)
- [Settings Hierarchy](./settings-hierarchy.md)
- [Execution Strategy](../usage/claude-execution-strategy.md)
