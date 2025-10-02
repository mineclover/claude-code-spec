# Managed Regions 설계 안정성 분석

## 핵심 문제점 및 개선 방안

### 1. 🔴 CRITICAL: Line-based ID의 불안정성

#### 문제
```typescript
// 현재 ID 생성 방식
id: `${type}-${lineNumber}`

// 예: "direct-ref-15"
```

**시나리오:**
1. Line 10에 항목 A (ID: `direct-ref-10`)
2. Line 5에 새 항목 삽입
3. 항목 A가 Line 11로 이동
4. **기존 ID `direct-ref-10`이 다른 항목을 가리킴** ❌

**영향:**
- CRUD 연산 시 잘못된 항목 수정/삭제
- UI state 불일치
- 데이터 손실 가능성

#### 해결 방안 ✅

**Option 1: UUID 기반 ID**
```typescript
import { v4 as uuidv4 } from 'uuid';

interface RegionItem {
  id: string;  // UUID: "a1b2c3d4-..."
  // ...
}

// 생성 시
id: uuidv4()
```

**장점:**
- 영구적으로 고유함
- 위치 변경 무관

**단점:**
- 디버깅이 어려움
- 저장된 ID 관리 필요

**Option 2: Content Hash 기반 ID**
```typescript
import crypto from 'crypto';

function generateItemId(item: RegionItem): string {
  const content = item.raw;
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// 예: "3f2a1b4c" (content 기반)
```

**장점:**
- Content가 같으면 ID도 같음
- 중복 감지 용이

**단점:**
- Content 변경 시 ID 변경
- Hash 충돌 가능성 (낮음)

**Option 3: Sequence + Region 조합**
```typescript
// Region마다 고유 sequence
interface ManagedRegion {
  name: string;
  nextItemId: number;  // Auto-increment
}

// ID 형식: "{regionName}-{sequence}"
// 예: "references-1", "references-2"
```

**장점:**
- Region 내에서 안정적
- 사람이 읽기 쉬움

**단점:**
- Region 간 이동 시 문제
- Sequence 관리 필요

**🎯 권장: Option 1 (UUID)** - 가장 안정적

---

### 2. 🟡 MEDIUM: 여러 줄 항목의 처리

#### 문제
```typescript
// itemToMarkdown()에서
case 'code-block':
  return `\`\`\`${language}\n${content}\n\`\`\``;
```

**문제점:**
- Code block은 여러 줄을 차지
- `lines.splice(line, 1, newLine)` - 한 줄만 교체
- **나머지 줄들이 남음** ❌

**시나리오:**
```markdown
<!-- Before -->
```bash
npm run dev
npm run build
```

<!-- After updateRegionItem (잘못된 결과) -->
```bash
new command
```
npm run build    ← 이전 내용 남음!
```
```

#### 해결 방안 ✅

**수정된 itemToMarkdown:**
```typescript
private itemToMarkdown(item: Partial<RegionItem>): string | string[] {
  switch (item.type) {
    case 'code-block':
      const codeBlock = item as CodeBlockItem;
      return [
        `\`\`\`${codeBlock.language}`,
        ...codeBlock.content.split('\n'),
        '```'
      ];

    default:
      return '...';
  }
}

// updateRegionItem 수정
const newLines = Array.isArray(markdown) ? markdown : [markdown];
const deleteCount = item.endLine - item.line + 1;
this.lines.splice(item.line, deleteCount, ...newLines);
```

**장점:**
- 정확한 줄 수 계산
- 이전 내용 완전 제거

---

### 3. 🟡 MEDIUM: Region Type과 Content의 불일치

#### 문제
```typescript
// 사용자가 "section" type으로 생성
region.type = 'section';

// 하지만 실제로 code block 추가
editor.addRegionItem(regionName, {
  type: 'code-block',
  language: 'bash',
  content: 'npm run dev'
}, 'end');

// Type과 실제 내용 불일치! ❌
```

**영향:**
- UI 혼란
- 검증 실패
- 자동화 도구 오작동

#### 해결 방안 ✅

**Option 1: Type 자동 추론**
```typescript
inferRegionType(items: RegionItem[]): 'section' | 'code' | 'mixed' {
  const hasHeading = items.some(i => i.type === 'heading');
  const hasDirectRef = items.some(i => i.type === 'direct-ref');
  const hasIndirectRef = items.some(i => i.type === 'indirect-ref');
  const hasCodeBlock = items.some(i => i.type === 'code-block');

  if (hasHeading && hasDirectRef && !hasCodeBlock && !hasIndirectRef) {
    return 'section';
  }
  if (hasCodeBlock && hasIndirectRef && !hasDirectRef) {
    return 'code';
  }
  return 'mixed';
}

// 자동 업데이트
updateManagedRegionContent(name: string, content: string) {
  // ... 기존 로직
  const items = this.parseRegionItems(name);
  const inferredType = this.inferRegionType(items);
  region.type = inferredType;  // 자동 보정
}
```

**Option 2: Strict Validation**
```typescript
validateRegionType(region: ManagedRegion): ValidationResult {
  const items = this.parseRegionItems(region.name);
  const actualType = this.inferRegionType(items);

  if (region.type !== actualType) {
    return {
      valid: false,
      message: `Type mismatch: declared "${region.type}" but content is "${actualType}"`
    };
  }

  return { valid: true };
}
```

**🎯 권장: Option 1 (자동 추론)** - 사용자 편의성

---

### 4. 🟢 LOW: Heading Level 무시

#### 문제
```markdown
## Main Section        ← Level 2
### Subsection        ← Level 3
#### Sub-subsection  ← Level 4
```

**현재:** 모두 동일하게 처리 (flat structure)

**원하는 것:**
```
📌 Main Section
  📌 Subsection
    📌 Sub-subsection
```

#### 해결 방안 ✅

```typescript
interface SectionTree {
  heading: HeadingItem | null;
  items: RegionItem[];
  children: SectionTree[];  // 중첩 섹션
}

buildSectionTree(items: RegionItem[]): SectionTree {
  const root: SectionTree = { heading: null, items: [], children: [] };
  const stack: SectionTree[] = [root];

  for (const item of items) {
    if (item.type === 'heading') {
      const heading = item as HeadingItem;

      // 적절한 부모 찾기
      while (stack.length > heading.level) {
        stack.pop();
      }

      const newSection: SectionTree = {
        heading,
        items: [],
        children: []
      };

      stack[stack.length - 1].children.push(newSection);
      stack.push(newSection);
    } else {
      // 현재 섹션에 항목 추가
      stack[stack.length - 1].items.push(item);
    }
  }

  return root;
}
```

**장점:**
- 진정한 계층 구조
- 복잡한 문서 지원

**단점:**
- UI 복잡도 증가
- 렌더링 성능 고려 필요

---

### 5. 🟢 LOW: Parsing 성능

#### 문제
- 매번 전체 region 파싱
- 큰 파일에서 느릴 수 있음

#### 해결 방안 ✅

**Memoization:**
```typescript
private itemsCache = new Map<string, {
  content: string;
  items: RegionItem[];
}>();

parseRegionItems(regionName: string): RegionItem[] {
  const region = this.findManagedRegion(regionName);
  if (!region) return [];

  const currentContent = this.lines.slice(
    region.contentStartLine,
    region.contentEndLine + 1
  ).join('\n');

  // 캐시 확인
  const cached = this.itemsCache.get(regionName);
  if (cached && cached.content === currentContent) {
    return cached.items;
  }

  // 파싱
  const items = this._parseItems(region);

  // 캐시 저장
  this.itemsCache.set(regionName, { content: currentContent, items });

  return items;
}

// Content 변경 시 캐시 무효화
updateManagedRegionContent(name: string, content: string) {
  // ... 기존 로직
  this.itemsCache.delete(name);
}
```

---

## 우선순위별 개선 로드맵

### Phase 1: Critical (즉시)
- [ ] UUID 기반 ID 도입
- [ ] 여러 줄 항목 처리 수정

### Phase 2: Important (1주일 내)
- [ ] Region Type 자동 추론
- [ ] Content validation 강화

### Phase 3: Nice-to-have (2주일 내)
- [ ] Heading level 기반 다단계 중첩
- [ ] 파싱 성능 최적화 (memoization)

### Phase 4: Future
- [ ] Undo/Redo 기능
- [ ] Drag & Drop으로 항목 재배치
- [ ] Real-time collaboration

---

## 테스트 시나리오

### 안정성 테스트

**Test 1: ID 안정성**
```typescript
test('ID remains stable after insertions', () => {
  const item = editor.parseRegionItems('test')[0];
  const originalId = item.id;

  // 앞에 새 항목 추가
  editor.addRegionItem('test', { type: 'text', content: 'New' }, 'start');

  // 같은 항목 다시 조회
  const sameItem = editor.parseRegionItems('test').find(i => i.id === originalId);

  expect(sameItem).toBeDefined();
  expect(sameItem.raw).toBe(item.raw);
});
```

**Test 2: 여러 줄 항목 업데이트**
```typescript
test('Multi-line item update', () => {
  editor.addRegionItem('test', {
    type: 'code-block',
    language: 'bash',
    content: 'line1\nline2\nline3'
  });

  const item = editor.parseRegionItems('test')[0] as CodeBlockItem;

  editor.updateRegionItem('test', item.id, {
    content: 'new line'
  });

  const updated = editor.parseRegionItems('test')[0] as CodeBlockItem;
  expect(updated.content).toBe('new line');

  // 이전 줄들이 남아있지 않은지 확인
  const allLines = editor.getContent().split('\n');
  expect(allLines).not.toContain('line1');
});
```

**Test 3: Type 추론**
```typescript
test('Auto-infer region type', () => {
  const region = editor.findManagedRegion('test');
  region.type = 'section';

  // Code block 추가
  editor.addRegionItem('test', {
    type: 'code-block',
    language: 'bash',
    content: 'npm run dev'
  });

  // Type이 자동으로 'mixed'로 변경되어야 함
  const updated = editor.findManagedRegion('test');
  expect(updated.type).toBe('mixed');
});
```

---

## 결론

### 현재 상태
- ✅ 기본 기능 동작
- ✅ UI 구현 완료
- ⚠️ 일부 edge case 존재

### 안정성 등급: **B+ (Good)**

**강점:**
- 명확한 데이터 모델
- 구조화된 파싱
- 사용자 친화적 UI

**약점:**
- Line-based ID 불안정
- 여러 줄 항목 처리 미흡
- Type validation 부족

### 운영 가능성: **가능하나 개선 필요**

**즉시 사용 가능한 경우:**
- 단일 사용자 환경
- 수동 검증 가능
- 중요 데이터 아님

**개선 후 사용 권장:**
- 팀 협업 환경
- 자동화 시스템
- 프로덕션 데이터

---

## 다음 단계

1. **Critical 이슈 해결** (UUID, 여러 줄 처리)
2. **자동화된 테스트 작성**
3. **성능 벤치마크**
4. **사용자 피드백 수집**
