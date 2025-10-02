# Memory Editor 가이드

Memory Editor는 CLAUDE.md 파일 내의 특정 영역을 관리하는 도구입니다. 마크다운 주석을 활용하여 관리 영역을 명확히 구분하고, UI를 통해 쉽게 편집할 수 있습니다.

## 기본 개념

### Managed Region (관리 영역)

관리 영역은 마크다운 주석으로 시작과 끝을 표시합니다:

```markdown
<!-- MEMORY_START: region-name -->
내용...
<!-- MEMORY_END: region-name -->
```

## 영역 타입

### 1. Section (섹션 타입)

**직접 참조** - `@context/` 경로를 나열합니다. 설명 불필요.

```markdown
<!-- MEMORY_START: references -->
## References

@context/memory/index.md
@context/usage/cli-reference.md
@context/config/permissions-configuration.md
<!-- MEMORY_END: references -->
```

**특징:**
- Claude가 자동으로 로드하는 직접 임포트
- 참조 바로 아래 설명 불필요
- 심플하고 깔끔한 목록 형태

### 2. Code (코드 타입)

**간접 참조** - backticks로 감싸고 설명을 추가합니다.

```markdown
<!-- MEMORY_START: tools -->
## Development Tools

```bash
npm run dev
npm run build
npm run test
```

`@context/usage/cli-reference.md` - CLI 명령어 참조 문서입니다. 필요 시 읽으세요.
<!-- MEMORY_END: tools -->
```

**특징:**
- backticks로 감싼 참조는 로드 안 됨 (언급만)
- 설명 추가하여 사용 상황 명시
- 명령어 + 간접 참조 혼합 가능

### 3. Mixed (혼합 타입)

**직접 참조 + 간접 참조** - 두 가지를 함께 사용합니다.

```markdown
<!-- MEMORY_START: setup -->
## Development Setup

@context/setup/prerequisites.md
@context/setup/configuration.md

```bash
npm install
npm run dev
```

`@context/troubleshooting/common-issues.md` - 문제 발생 시에만 참조하세요.
<!-- MEMORY_END: setup -->
```

**특징:**
- 직접 참조 (backticks 없음): 즉시 로드
- 간접 참조 (backticks 있음): 언급만, 로드 안 됨
- 명령어와 참조 혼합 가능

## Memory Editor 사용법

### 1. Memory 페이지 접근

1. 프로젝트 선택 (Execute 페이지 또는 Settings)
2. 사이드바에서 **Memory** (🧠) 클릭

### 2. 새 영역 생성

1. **Create Managed Region** 섹션에서:
   - 영역 이름 입력 (예: `references`, `tools`, `setup`)
   - 영역 타입 선택 (Section / Code / Mixed)
   - **Create** 버튼 클릭

2. 생성된 영역이 CLAUDE.md 끝에 추가됨

### 3. 영역 편집

#### 시각적 편집

- Section 타입: Heading과 Bullet 항목이 구조화되어 표시
- Code 타입: 코드 블록이 언어별로 하이라이트되어 표시
- Mixed 타입: 두 가지 모두 표시

#### Raw 편집

1. 영역 카드를 클릭하여 확장
2. **Raw Content** 텍스트 영역에서 직접 수정
3. **Save Changes** 클릭

### 4. 영역 삭제

1. 영역 카드 헤더의 **Delete** 버튼 클릭
2. 확인 다이얼로그에서 승인

## 실전 활용 예시

### 1. 직접 참조 (Section 타입)

```markdown
<!-- MEMORY_START: references -->
## References

@context/architecture/overview.md
@context/api/specification.md
@context/config/settings.md
<!-- MEMORY_END: references -->
```

**특징:**
- ✅ 직접 참조: Claude가 즉시 로드
- ✅ 설명 불필요: 심플한 목록
- ❌ 일반 링크 `[문서](./path)`: 로드 안 됨

### 2. 간접 참조 (Code 타입)

```markdown
<!-- MEMORY_START: dev-tools -->
## Development Tools

```bash
npm run dev
npm run build
npm run test
npm run lint:fix
```

`@context/troubleshooting/debug-guide.md` - 디버깅 시에만 참조하세요.
<!-- MEMORY_END: dev-tools -->
```

**특징:**
- ✅ 명령어: 바로 실행 가능
- ✅ 간접 참조: backticks + 설명
- ✅ 로드 안 됨: 필요할 때 읽도록 유도

### 3. 혼합 (Mixed 타입)

```markdown
<!-- MEMORY_START: context-optimization -->
## Context Optimization

@context/config/context-limits.md
@context/usage/optimization-strategies.md

```bash
# 현재 컨텍스트 크기
wc -l CLAUDE.md

# MCP 서버 확인
ls -la .claude/.mcp-*.json
```

`@context/troubleshooting/context-overflow.md` - 컨텍스트 초과 시 참조하세요.
<!-- MEMORY_END: context-optimization -->
```

**특징:**
- ✅ 직접 참조: 즉시 로드 (backticks 없음)
- ✅ 명령어: 실행 가능
- ✅ 간접 참조: 언급만 (backticks 있음)

## 모범 사례

### ✅ DO

1. **올바른 참조 형식 사용**
   - 직접 참조: `@context/file.md` (설명 없음)
   - 간접 참조: 코드블럭 + 설명

2. **타입에 맞는 내용 작성**
   - Section: 직접 참조 목록
   - Code: 명령어 + 간접 참조
   - Mixed: 직접 + 간접 + 명령어

3. **중복 참조 방지**
   - 같은 파일을 여러 번 참조하지 않기
   - Validation 경고 확인

4. **재배치 주기적 실행**
   - Memory 영역을 문서 하단에 유지
   - 일반 컨텍스트와 분리

### ❌ DON'T

1. **잘못된 참조 형식**
   ```markdown
   # ❌ 직접 참조에 설명 추가
   @context/file.md
   이것은 설명입니다.  # 불필요!

   # ❌ 간접 참조에 설명 없음
   `@context/file.md`  # 설명이 필요함!
   ```

2. **일반 마크다운 링크 사용**
   - ❌ `[문서](./docs/file.md)` - 로드 안 됨
   - ✅ `@context/file.md` - 정상 로드

3. **backticks 용도 혼동**
   - ❌ 여러 줄 코드블럭(```) 사용
   - ✅ 인라인 backticks(`) 사용

4. **영역 외부에 참조 작성**
   - Memory 관리 대상은 영역 내부에만

## 고급 기능

### 영역 순서 조정

영역의 순서는 CLAUDE.md에서 직접 편집하거나, 영역을 삭제 후 원하는 위치에 재생성할 수 있습니다.

### 영역 복사

1. 원본 영역의 Raw Content 복사
2. 새 영역 생성
3. Raw Content에 붙여넣기
4. 영역 이름 변경

### 버전 관리

영역은 Git으로 관리되므로:
```bash
# 변경 이력 확인
git log -p CLAUDE.md

# 특정 시점으로 복원
git checkout <commit> -- CLAUDE.md
```

## 문제 해결

### 영역이 표시되지 않음

주석 형식이 정확한지 확인:
- 시작: `<!-- MEMORY_START: name -->`
- 종료: `<!-- MEMORY_END: name -->`
- 이름이 정확히 일치해야 함

### 영역 이름 변경

1. CLAUDE.md 직접 편집
2. 주석의 영역 이름을 일괄 변경
3. Memory Editor에서 Reload

### 저장 안 됨

1. 프로젝트 경로가 올바른지 확인
2. CLAUDE.md 파일 쓰기 권한 확인
3. 콘솔 에러 메시지 확인

## 참고 자료

Claude 컨텍스트 참조 (간접 참조 - 로드하지 않음):
- `@context/memory/context-reference-guide.md` - CLAUDE.md 작성 가이드
- `@context/memory/memory-hierarchy.md` - Memory 계층 구조
- `@context/memory/memory-features.md` - Memory 기능

**참조 방식:**
- 직접 참조: `@context/path/file.md` (backticks 없음) → Claude가 즉시 로드
- 간접 참조: `` `@context/path/file.md` `` (backticks 있음) → 언급만, 로드 안 됨
