# Managed Regions 표준 명세서

## 개요

Managed Regions는 CLAUDE.md 파일 내에서 구조화된 컨텍스트 관리를 위한 시스템입니다. 마크다운 주석을 사용하여 관리 영역을 명확히 구분하고, 각 영역 내부의 항목들을 프로그래밍 방식으로 관리할 수 있습니다.

## 기본 구조

### Region 마커

```markdown
<!-- MEMORY_START: region-name -->
[콘텐츠]
<!-- MEMORY_END: region-name -->
```

**규칙:**
- `region-name`은 영역 고유 식별자 (영문, 숫자, 하이픈 허용)
- START와 END의 이름이 정확히 일치해야 함
- Region은 중첩 불가 (flat structure)

## Region 타입

### 1. Section Type
**용도:** 직접 참조 중심의 구조화된 섹션

```markdown
<!-- MEMORY_START: references -->
## References

@context/memory/index.md
@context/usage/cli-reference.md
<!-- MEMORY_END: references -->
```

**특징:**
- Heading + Direct References
- 설명 없이 참조만 나열
- Claude가 즉시 로드

### 2. Code Type
**용도:** 명령어 + 간접 참조

```markdown
<!-- MEMORY_START: tools -->
## Development Tools

```bash
npm run dev
npm run build
```

`@context/troubleshooting/debug-guide.md` - 디버깅 시 참조하세요.
<!-- MEMORY_END: tools -->
```

**특징:**
- Code Block + Indirect References
- 실행 가능한 명령어 중심
- 간접 참조는 필요 시에만 로드

### 3. Mixed Type
**용도:** 직접 참조 + 코드 + 간접 참조 혼합

```markdown
<!-- MEMORY_START: setup -->
## Development Setup

@context/setup/prerequisites.md

```bash
npm install
npm run dev
```

`@context/troubleshooting/common-issues.md` - 문제 발생 시 참조하세요.
<!-- MEMORY_END: setup -->
```

## 항목 타입 (Region Items)

### 1. Heading
**역할:** 섹션 구분자

```markdown
## Section Title
### Subsection Title
```

**특징:**
- Level 2-6 지원 (## ~ ######)
- 섹션의 시작을 표시
- 이후 항목들을 그룹화

### 2. Direct Reference
**역할:** 즉시 로드되는 컨텍스트 참조

```markdown
@context/path/to/file.md
```

**특징:**
- backticks 없음
- 설명 불필요
- Claude가 자동으로 로드
- 한 줄에 하나씩

### 3. Indirect Reference
**역할:** 조건부 로드 참조

```markdown
`@context/path/to/file.md` - 설명이 필수입니다
```

**특징:**
- 인라인 backticks 사용
- 하이픈(-) 뒤에 설명 필수
- 사용자가 필요 시에만 읽도록 유도

### 4. Code Block
**역할:** 실행 가능한 명령어/코드

```markdown
```language
code content
```
```

**특징:**
- 언어 지정 가능 (bash, javascript, python 등)
- 여러 줄 지원
- 주석 포함 가능

### 5. Text
**역할:** 일반 설명 텍스트

```markdown
이것은 일반 텍스트입니다.
```

**특징:**
- 위 4가지 타입에 해당하지 않는 모든 텍스트
- 줄바꿈 포함 가능

## 데이터 모델

### RegionItem 타입 정의

```typescript
type RegionItemType =
  | 'heading'      // ## 제목
  | 'direct-ref'   // @context/... (직접 참조)
  | 'indirect-ref' // `@context/...` - 설명 (간접 참조)
  | 'code-block'   // ```...```
  | 'text';        // 일반 텍스트

interface RegionItem {
  id: string;           // 고유 ID
  type: RegionItemType;
  line: number;         // 시작 라인 (0-based)
  endLine: number;      // 종료 라인 (0-based)
  raw: string;          // 원본 텍스트
}

interface HeadingItem extends RegionItem {
  type: 'heading';
  level: number;        // 1-6
  text: string;
}

interface DirectRefItem extends RegionItem {
  type: 'direct-ref';
  path: string;         // @context/... 경로
}

interface IndirectRefItem extends RegionItem {
  type: 'indirect-ref';
  path: string;         // @context/... 경로
  description: string;  // 설명
}

interface CodeBlockItem extends RegionItem {
  type: 'code-block';
  language: string;
  content: string;
}

interface TextItem extends RegionItem {
  type: 'text';
  content: string;
}
```

## 파싱 규칙

### 우선순위
1. Heading: `^#{1,6}\s+(.+)$`
2. Direct Reference: `^\s*(@context\/[^\s`]+)\s*$`
3. Indirect Reference: `^\s*`(@context\/[^`]+)`\s*-\s*(.+)$`
4. Code Block: ` ```language` ~ ` ``` `
5. Text: fallback

### 파싱 알고리즘
```
for each line in region:
  if matches heading pattern:
    create HeadingItem
  else if matches direct-ref pattern:
    create DirectRefItem
  else if matches indirect-ref pattern:
    create IndirectRefItem
  else if matches code-block start:
    parse until code-block end
    create CodeBlockItem
  else:
    create TextItem
```

## CRUD 연산

### Create (addRegionItem)
```typescript
addRegionItem(regionName, item, position: 'start' | 'end' | number)
```

**동작:**
1. Region 찾기
2. Position 계산
3. Item을 마크다운으로 변환
4. 해당 위치에 삽입

### Read (parseRegionItems)
```typescript
parseRegionItems(regionName): RegionItem[]
```

**동작:**
1. Region 찾기
2. Content lines 추출
3. 파싱 규칙에 따라 항목 생성
4. 배열로 반환

### Update (updateRegionItem)
```typescript
updateRegionItem(regionName, itemId, newItem)
```

**동작:**
1. Item 찾기
2. 기존 항목과 병합
3. 마크다운으로 변환
4. 해당 라인 교체

### Delete (deleteRegionItem)
```typescript
deleteRegionItem(regionName, itemId)
```

**동작:**
1. Item 찾기
2. 시작~종료 라인 삭제
3. Lines 배열 업데이트

## 검증 규칙

### 1. 중복 참조 검증
- 같은 `@context/` 경로가 여러 번 나타나면 안 됨
- Direct Reference만 체크 (Indirect는 허용)

### 2. 유효성 검증
- Direct Reference의 파일이 실제로 존재해야 함
- `docs/claude-context/` 기준으로 경로 확인

### 3. 구조 검증
- START/END 주석 쌍이 정확히 일치
- Region 이름에 특수문자 금지
- Region 중첩 금지

## Auto Fix 동작

### 실행 순서
1. **중복 제거 (removeDuplicateReferences)**
   - 모든 Region의 Direct Reference 검사
   - 첫 번째 출현만 유지, 이후 제거

2. **무효 참조 제거 (removeInvalidReferences)**
   - 모든 Region의 Direct Reference 검사
   - 파일이 존재하지 않으면 제거

3. **Region 재배치 (reorganizeManagedRegions)**
   - 모든 Managed Region을 문서 하단으로 이동
   - 원래 순서 유지

## UI 구조

### 섹션별 중첩 표시
```
Region Card
├─ 📌 Section Heading (삭제 가능)
│  ├─ 🔗 Direct Reference
│  ├─ 💡 Indirect Reference
│  └─ 💻 Code Block
├─ 📌 Another Section
│  └─ ...
└─ Raw Content Editor
```

**특징:**
- Heading이 섹션 헤더 역할
- 섹션 내 항목들이 중첩 표시
- 각 항목 개별 삭제 가능
- Raw 편집 동시 지원

## 모범 사례

### ✅ DO

1. **명확한 섹션 구분**
   ```markdown
   ## Core References
   @context/architecture/overview.md

   ## Optional Resources
   `@context/advanced/optimization.md` - 성능 최적화 시 참조
   ```

2. **일관된 명명 규칙**
   - Region name: `references`, `tools`, `setup` (소문자, 하이픈)
   - 명확하고 설명적인 이름 사용

3. **적절한 참조 타입 선택**
   - 항상 필요: Direct Reference
   - 선택적 필요: Indirect Reference

### ❌ DON'T

1. **Region 중첩**
   ```markdown
   <!-- MEMORY_START: outer -->
   <!-- MEMORY_START: inner -->  ❌ 중첩 불가
   ```

2. **직접 참조에 설명 추가**
   ```markdown
   @context/file.md
   이것은 설명입니다.  ❌ 직접 참조는 설명 불필요
   ```

3. **간접 참조에 설명 누락**
   ```markdown
   `@context/file.md`  ❌ 설명이 필요함
   `@context/file.md` - 설명 추가  ✅
   ```

## 제한사항 및 알려진 이슈

### 현재 제한사항
1. **ID 기반 라인 번호**
   - 항목 ID가 `{type}-{lineNumber}` 형식
   - 파일 수정 시 ID 변경 가능성
   - 해결 방안: UUID 기반 ID 도입 검토

2. **단일 레벨 섹션**
   - Heading level 무시 (모두 동등하게 처리)
   - h2, h3 구분 없음
   - 해결 방안: Level에 따른 다단계 중첩 지원

3. **Region Type 자동 감지 부재**
   - 수동으로 type 지정 필요
   - 내용과 불일치 가능성
   - 해결 방안: Content 기반 type 자동 추론

### 알려진 버그
- 없음 (현재 안정 버전)

## 버전 히스토리

### v1.0.0 (현재)
- 구조화된 Region Items 지원
- CRUD 연산 구현
- Auto Fix 기능
- 섹션별 중첩 UI

## 참고 자료

- [MEMORY_EDITOR.md](./MEMORY_EDITOR.md) - UI 사용 가이드
- [context-reference-guide.md](./claude-context/memory/context-reference-guide.md) - 참조 문법
- [memory-hierarchy.md](./claude-context/memory/memory-hierarchy.md) - Memory 계층 구조
