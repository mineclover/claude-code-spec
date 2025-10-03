# Memory Editor - Implementation Tasks & Status

**Last Updated:** 2025-10-04
**Component:** `src/pages/MemoryPage.tsx` (622 lines)
**Library:** `src/lib/MarkdownEditor.ts` (1433 lines)

## 현재 구현 상태

### ✅ 완료된 핵심 기능

#### 1. CLAUDE.md 파일 관리
- [x] CLAUDE.md 읽기/쓰기 (IPC handlers: `file:read`, `file:write`)
- [x] 프로젝트 경로 기반 자동 로드
- [x] 전체 문서 미리보기
- [x] 수동 Reload 버튼

#### 2. Managed Regions 관리
- [x] Region 탐지 및 파싱 (`<!-- MEMORY_START/END -->` 주석)
- [x] Region 생성 (이름 입력 → 기본 템플릿 생성)
- [x] Region 삭제 (확인 대화상자 포함)
- [x] Region 확장/축소 UI
- [x] Region 타입 구분 (section, code, mixed)

#### 3. Region 콘텐츠 편집
- [x] **구조화된 편집 모드**:
  - 항목별 파싱 (Heading, Direct-ref, Indirect-ref, Code-block, Text)
  - 개별 항목 추가/수정/삭제
  - 항목 순서 변경 (⬆️⬇️ 버튼)
  - 항목 타입별 아이콘 표시
- [x] **JSON 편집 모드**:
  - Region → JSON 변환
  - JSON 편집 및 저장
  - JSON 파일 내보내기
- [x] **Raw 마크다운 편집**:
  - Textarea 직접 편집
  - 즉시 저장

#### 4. 참조(Reference) 관리
- [x] Direct Reference 파싱 (`@context/file.md`)
- [x] Indirect Reference 파싱 (`` `@context/file.md` + 설명``)
- [x] Multi-line Indirect Reference 지원 (복수 bullet 설명)
- [x] @context 경로 추출

#### 5. 검증(Validation) 시스템
- [x] 중복 참조 탐지 (`findDuplicateReferences()`)
- [x] 유효하지 않은 참조 탐지 (파일 존재 확인)
- [x] 경고 메시지 UI (중복/유효하지 않은 참조별)
- [x] 라인 번호 표시

#### 6. 자동 수정(Auto-fix)
- [x] 중복 참조 제거 (첫 번째만 유지)
- [x] 유효하지 않은 참조 제거
- [x] Region 재배치 (문서 하단으로 이동)
- [x] Auto Fix 버튼 (한 번에 모두 실행)
- [x] Reorganize 버튼 (Region만 재배치)

#### 7. Region 재배치(Reorganization)
- [x] Region이 문서 하단에 있는지 확인 (`areRegionsAtBottom()`)
- [x] 모든 Region을 문서 하단으로 이동
- [x] 구분자 추가 (`---` 또는 `## Memory 관리 영역`)
- [x] 재배치 필요 알림 배너

#### 8. 성능 최적화
- [x] Parsed items 캐싱 (content hash 기반)
- [x] 캐시 무효화 (수정 시)
- [x] Stable Item IDs (FNV-1a 해시, content-based)

### ⚠️ 부분 구현 / 개선 필요

#### 1. 항목(Item) 편집 UX
- [x] 항목 추가: Add Item 메뉴
- [x] 항목 이동: 버튼 방식
- [ ] **누락**: 항목 인라인 편집 (현재는 JSON 모드에서만 가능)
- [ ] **누락**: 항목 Drag & Drop 순서 변경
- [ ] **개선 필요**: 새 항목 기본값이 너무 단순 (템플릿 부족)

#### 2. Indirect Reference 편집
- [x] Multi-line description 표시
- [x] Multi-line description 파싱
- [ ] **누락**: Multi-line description 인라인 편집
- [ ] **개선 필요**: Description bullet이 여러 줄일 때 편집 UI 복잡

#### 3. Code Block 편집
- [x] 언어 태그 표시
- [x] 코드 내용 표시
- [ ] **누락**: 코드 syntax highlighting
- [ ] **누락**: 언어 선택 드롭다운
- [ ] **개선 필요**: 긴 코드 블록 스크롤 UI

#### 4. 검증 및 경고
- [x] 중복/유효하지 않은 참조 경고
- [ ] **누락**: 잘못된 마크다운 문법 경고
- [ ] **누락**: 순환 참조 감지 (A → B → A)
- [ ] **누락**: 파일 크기 경고 (대용량 direct ref)

#### 5. Region 템플릿
- [x] 기본 템플릿 (Heading + Direct-ref)
- [ ] **누락**: 미리 정의된 템플릿 선택 (references, tools, architecture 등)
- [ ] **누락**: 커스텀 템플릿 저장/로드

#### 6. 파일 경로 관리
- [x] `@context/` → `docs/claude-context/` 변환
- [ ] **누락**: 경로 자동완성
- [ ] **누락**: 파일 브라우저 (대화상자로 선택)
- [ ] **개선 필요**: 경로 검증 피드백 (타이핑 중)

## 검증 결과

### ✅ 정상 동작 확인

1. **CLAUDE.md 로드**: 프로젝트 선택 시 자동 로드
2. **Region 탐지**: `<!-- MEMORY_START/END -->` 정확히 파싱
3. **Region 편집**:
   - 구조화 모드: 항목 추가/삭제/이동 정상
   - JSON 모드: JSON 편집 및 저장 정상
   - Raw 모드: 마크다운 직접 편집 정상
4. **참조 검증**:
   - 중복 참조 정확히 탐지 (라인 번호 표시)
   - 유효하지 않은 참조 탐지 (`docs/claude-context/` 경로 확인)
5. **Auto Fix**:
   - 중복 제거 정상 (첫 번째만 유지)
   - 유효하지 않은 참조 제거 정상
   - Reorganize 정상 (하단 이동 + 구분자 추가)
6. **캐싱**:
   - Content hash 기반 캐싱 작동
   - 수정 시 캐시 무효화 정상

### ⚠️ 발견된 문제

1. **Region 재배치 경고 조건**:
   - `areRegionsAtBottom()`이 `## Memory 관리 영역` 헤딩을 찾음
   - `reorganizeManagedRegions()`는 `---` 구분자를 추가
   - 불일치로 인해 재배치 후에도 경고가 계속 나타날 수 있음
   - **해결 방법**: 두 함수가 같은 패턴 사용하도록 통일

2. **Item ID 충돌 가능성**:
   - Content-based hash 사용으로 같은 내용이면 같은 ID
   - 같은 Region에 동일 항목 추가 시 ID 충돌
   - React key 경고 발생 가능
   - **해결 방법**: ID에 순서 번호 추가 또는 UUID 사용

3. **Indirect Reference 파싱 제한**:
   - Multi-line description은 bullet(`-`)로 시작해야 함
   - 일반 텍스트 paragraph는 지원 안 함
   - **개선**: Paragraph 형식 description 지원

4. **JSON 편집 에러 핸들링**:
   - Invalid JSON 입력 시 `alert()` 사용
   - 에러 위치/원인 상세 정보 부족
   - **개선**: JSON validation 메시지 개선

5. **파일 저장 실패 처리**:
   - 저장 실패 시 `console.error()`만 출력
   - 사용자에게 피드백 없음
   - **개선**: Toast 알림 또는 에러 배너 추가

## 누락된 기능

### 1. 사용성(Usability) 개선

#### 1.1 인라인 편집
- **현황**: 항목을 수정하려면 JSON 모드 또는 Raw 모드 사용
- **필요**:
  - Direct-ref: 경로 입력 필드
  - Indirect-ref: 경로 + description textarea
  - Heading: 텍스트 입력 필드
  - Code-block: 언어 선택 + 코드 textarea
- **구현 위치**: `RegionEditor` 컴포넌트에 편집 상태 추가

#### 1.2 Drag & Drop 순서 변경
- **현황**: ⬆️⬇️ 버튼으로만 이동 (한 칸씩)
- **필요**:
  - 항목을 드래그하여 원하는 위치에 드롭
  - React DnD 또는 dnd-kit 라이브러리 사용
- **이점**: 긴 목록에서 이동 편리

#### 1.3 검색 및 필터
- **현황**: 검색 기능 없음
- **필요**:
  - Region 이름 검색
  - 참조 경로 검색
  - 항목 타입 필터
- **구현**: 상단 검색창 + 필터 드롭다운

#### 1.4 실행 취소(Undo/Redo)
- **현황**: 실행 취소 없음 (수동 복원만 가능)
- **필요**:
  - Command history stack
  - Undo/Redo 버튼
  - Ctrl+Z / Ctrl+Shift+Z 단축키
- **구현**: History manager 추가

### 2. 템플릿 시스템

#### 2.1 미리 정의된 템플릿
- **References 템플릿**:
  ```markdown
  ## References

  @context/architecture/overview.md
  @context/config/settings.md
  ```
- **Tools 템플릿**:
  ```markdown
  ## Development Tools

  `@context/usage/cli-reference.md`
  - CLI 명령어 참조
  - 옵션 및 플래그 설명
  ```
- **Architecture 템플릿**:
  ```markdown
  ## Architecture

  `@context/architecture/system-design.md`
  - 시스템 구조
  - 컴포넌트 관계도

  ```bash
  # 프로젝트 구조
  src/
    components/
    lib/
    pages/
  ```
  ```

#### 2.2 커스텀 템플릿
- **저장**: 현재 Region을 템플릿으로 저장
- **로드**: 저장된 템플릿 선택하여 새 Region 생성
- **공유**: 템플릿 export/import (JSON)

### 3. 참조 관리 고급 기능

#### 3.1 경로 자동완성
- **현황**: 수동 타이핑만 가능
- **필요**:
  - `docs/claude-context/` 디렉토리 스캔
  - 타이핑 중 자동완성 제안
  - 파일 브라우저 대화상자
- **구현**: Autocomplete 컴포넌트 + IPC handler

#### 3.2 순환 참조 감지
- **현황**: 순환 참조 미감지
- **필요**:
  - A → B → C → A 패턴 감지
  - 경고 메시지 및 시각화
- **구현**: Graph traversal 알고리즘

#### 3.3 파일 크기 경고
- **현황**: Direct-ref 파일 크기 미확인
- **필요**:
  - 대용량 파일 (> 100KB) 경고
  - Indirect-ref 전환 제안
- **구현**: 파일 크기 체크 + 경고 배너

#### 3.4 참조 미리보기
- **현황**: 참조 파일 내용 확인 불가
- **필요**:
  - 참조 항목 hover 시 tooltip으로 파일 내용 미리보기
  - 또는 클릭 시 모달로 전체 내용 표시
- **구현**: Tooltip/Modal 컴포넌트 + 파일 읽기

### 4. 편집 경험 개선

#### 4.1 Syntax Highlighting
- **현황**: Code block이 plain text로 표시
- **필요**:
  - 언어별 syntax highlighting
  - Monaco Editor 또는 CodeMirror 통합
- **이점**: 코드 가독성 향상

#### 4.2 실시간 검증 피드백
- **현황**: 저장 후에만 검증
- **필요**:
  - 타이핑 중 실시간 경로 검증
  - 존재하지 않는 파일 빨간색 표시
  - 중복 참조 노란색 표시
- **구현**: Debounced validation + inline 표시

#### 4.3 Diff View
- **현황**: 변경 사항 추적 없음
- **필요**:
  - 저장 전/후 비교 뷰
  - 변경된 라인 하이라이트
- **구현**: Diff library 사용 (diff-match-patch)

#### 4.4 Live Preview
- **현황**: Raw markdown만 미리보기
- **필요**:
  - 렌더링된 마크다운 미리보기
  - Split view (편집 | 미리보기)
- **구현**: Markdown renderer (react-markdown)

### 5. 협업 및 공유

#### 5.1 Import/Export
- **현황**: Region별 JSON export만 가능
- **필요**:
  - 전체 CLAUDE.md export (JSON, YAML)
  - 다른 프로젝트에서 import
  - Region 병합 기능
- **구현**: Export/Import 대화상자

#### 5.2 버전 관리 통합
- **현황**: Git 상태 미표시
- **필요**:
  - CLAUDE.md 변경 사항 표시
  - Git diff 연동
  - Commit 전 검증
- **구현**: Git status IPC + UI 표시

#### 5.3 충돌 감지
- **현황**: 다중 편집 충돌 미감지
- **필요**:
  - 파일 수정 시각 체크
  - 다른 프로세스 변경 감지
  - 리로드 알림
- **구현**: File watcher + timestamp 비교

### 6. 성능 및 안정성

#### 6.1 Auto-save
- **현황**: 수동 저장만 가능
- **필요**:
  - 일정 시간 후 자동 저장 (30초)
  - 변경 감지 시 자동 저장
  - 저장 상태 표시
- **구현**: Debounced save + 상태 indicator

#### 6.2 에러 복구
- **현황**: 저장 실패 시 복구 없음
- **필요**:
  - 저장 실패 시 변경 사항 보존
  - Retry 메커니즘
  - 백업 파일 생성
- **구현**: Error boundary + local backup

#### 6.3 대용량 파일 처리
- **현황**: 전체 파일 로드 (메모리 부담)
- **필요**:
  - Virtual scrolling (긴 Region)
  - Lazy loading (Region별)
  - 파일 크기 제한 경고
- **구현**: Virtual list 라이브러리

## 개선점

### 우선순위 1 (긴급)

1. **Region 재배치 패턴 통일**
   - `areRegionsAtBottom()`과 `reorganizeManagedRegions()` 동기화
   - 파일: `src/lib/MarkdownEditor.ts` (lines 1408-1431, 1346-1403)
   - 영향: 재배치 경고 정확성

2. **Item ID 충돌 방지**
   - Stable ID 생성 시 순서 번호 추가
   - 파일: `src/lib/MarkdownEditor.ts` (lines 164-176)
   - 영향: React key warning 제거

3. **파일 저장 에러 피드백**
   - Toast 알림 또는 에러 배너 추가
   - 파일: `src/pages/MemoryPage.tsx` (lines 84-93)
   - 영향: 사용자 경험

### 우선순위 2 (중요)

4. **인라인 편집 UI**
   - 항목별 편집 필드 추가
   - 파일: `src/pages/MemoryPage.tsx` (RegionEditor 컴포넌트)
   - 영향: 편집 편의성

5. **경로 자동완성**
   - Autocomplete 컴포넌트
   - IPC: `file:listDirectory` 추가
   - 영향: 참조 입력 속도

6. **템플릿 시스템**
   - 미리 정의된 템플릿 3종 (references, tools, architecture)
   - Region 생성 시 템플릿 선택
   - 영향: Region 생성 속도

### 우선순위 3 (유용)

7. **검색 및 필터**
   - Region/참조 검색 기능
   - 파일: `src/pages/MemoryPage.tsx` (상단 추가)
   - 영향: 대규모 CLAUDE.md 관리

8. **Drag & Drop 순서 변경**
   - dnd-kit 라이브러리 통합
   - 파일: `src/pages/MemoryPage.tsx` (RegionEditor)
   - 영향: 항목 재배치 편의성

9. **실시간 검증 피드백**
   - 타이핑 중 경로 검증
   - Inline 에러 표시
   - 영향: 즉각적인 피드백

### 우선순위 4 (나중에)

10. **Syntax Highlighting**
    - Code block에 Monaco Editor 통합
    - 파일: `src/pages/MemoryPage.tsx` (CodeBlockItem)
    - 영향: 가독성

11. **Undo/Redo**
    - History manager 추가
    - Command pattern 구현
    - 영향: 편집 안전성

12. **Live Preview**
    - Split view (편집 | 미리보기)
    - react-markdown 통합
    - 영향: 결과 확인

## 버그 및 이슈

### 🐛 확인된 버그

1. **ID 충돌 시 React Warning**
   - **증상**: 같은 내용의 항목 추가 시 `key` 중복 경고
   - **원인**: Content-based hash ID
   - **재현**: 같은 Direct-ref를 같은 Region에 두 번 추가
   - **수정**: ID에 index 추가 또는 UUID 사용

2. **Reorganize 패턴 불일치**
   - **증상**: Reorganize 후에도 경고 배너 계속 표시
   - **원인**: `areRegionsAtBottom()`은 헤딩 찾고, `reorganizeManagedRegions()`는 `---` 추가
   - **재현**: Reorganize 버튼 클릭
   - **수정**: 두 함수 동일한 패턴 사용

3. **JSON 편집 에러 메시지 부족**
   - **증상**: Invalid JSON 입력 시 `alert()` 한 줄만 표시
   - **원인**: 에러 상세 정보 미제공
   - **재현**: JSON View에서 잘못된 JSON 입력 후 저장
   - **수정**: Validation 메시지 개선, 에러 위치 표시

### ⚠️ 잠재적 문제

4. **대용량 CLAUDE.md 성능**
   - **증상**: 파일 크기 > 1MB 시 로딩/파싱 느림
   - **원인**: 전체 파일 메모리 로드
   - **예방**: Virtual scrolling, lazy loading

5. **Multi-line Description 파싱 제한**
   - **증상**: Paragraph 형식 description 미지원
   - **원인**: Bullet(`-`)만 인식
   - **영향**: 자유 형식 설명 불가
   - **개선**: Paragraph 파싱 추가

6. **파일 저장 동기화 문제**
   - **증상**: 빠른 연속 저장 시 일부 변경 누락 가능
   - **원인**: 비동기 저장 race condition
   - **예방**: Save queue 또는 debounce 추가

## 다음 단계

### Phase 1: 안정성 개선 (1-2주)

#### Sprint 1.1 - 버그 수정
- [ ] Region 재배치 패턴 통일
- [ ] Item ID 충돌 방지
- [ ] 파일 저장 에러 피드백 추가
- [ ] JSON 편집 에러 메시지 개선

#### Sprint 1.2 - 성능 최적화
- [ ] 대용량 파일 경고 추가
- [ ] Save debouncing 구현
- [ ] 캐싱 로직 검증

### Phase 2: 사용성 개선 (2-3주)

#### Sprint 2.1 - 편집 UX
- [ ] 인라인 편집 UI 구현
  - Direct-ref: 경로 입력 필드
  - Indirect-ref: 경로 + textarea
  - Heading: 텍스트 입력
  - Code-block: 언어 + 코드 입력
- [ ] 편집 상태 관리 (editing item ID)
- [ ] 저장/취소 버튼

#### Sprint 2.2 - 템플릿 시스템
- [ ] 미리 정의된 템플릿 3종
  - References 템플릿
  - Tools 템플릿
  - Architecture 템플릿
- [ ] Region 생성 시 템플릿 선택 UI
- [ ] 커스텀 템플릿 저장/로드 (선택사항)

#### Sprint 2.3 - 참조 관리
- [ ] 경로 자동완성 구현
  - IPC: `file:listDirectory` 추가
  - Autocomplete 컴포넌트
- [ ] 파일 브라우저 대화상자 (선택사항)
- [ ] 참조 미리보기 tooltip (선택사항)

### Phase 3: 고급 기능 (3-4주)

#### Sprint 3.1 - 검색 및 내비게이션
- [ ] Region 이름 검색
- [ ] 참조 경로 검색
- [ ] 항목 타입 필터
- [ ] 검색 결과 하이라이트

#### Sprint 3.2 - Drag & Drop
- [ ] dnd-kit 라이브러리 통합
- [ ] 항목 드래그 핸들
- [ ] 드롭 위치 표시
- [ ] 순서 변경 저장

#### Sprint 3.3 - 실시간 검증
- [ ] 타이핑 중 경로 검증 (debounced)
- [ ] Inline 에러 표시
- [ ] 중복/유효하지 않은 참조 실시간 표시
- [ ] 순환 참조 감지 (선택사항)

### Phase 4: 협업 기능 (4-5주)

#### Sprint 4.1 - Import/Export
- [ ] 전체 CLAUDE.md export (JSON, YAML)
- [ ] Region import from file
- [ ] Region 병합 기능
- [ ] Export/Import UI

#### Sprint 4.2 - 버전 관리
- [ ] Git 상태 표시
- [ ] CLAUDE.md 변경 사항 표시
- [ ] Commit 전 검증
- [ ] File watcher (변경 감지)

#### Sprint 4.3 - 고급 편집
- [ ] Undo/Redo 구현
- [ ] Syntax highlighting (Code block)
- [ ] Diff view
- [ ] Live preview (선택사항)

### Phase 5: 유지보수 및 문서화 (지속)

- [ ] 사용자 가이드 업데이트
- [ ] 개발자 문서 작성
- [ ] Unit test 추가
- [ ] E2E test 추가
- [ ] 성능 모니터링
- [ ] 버그 추적 및 수정

## 측정 지표

### 성능 목표
- CLAUDE.md 로딩 시간 < 500ms (< 100KB 파일)
- Region 파싱 시간 < 100ms (< 50 regions)
- 항목 추가/삭제 응답 시간 < 50ms
- Auto-fix 실행 시간 < 2s (< 200 refs)

### 사용성 목표
- Region 생성: 3 클릭 이내
- 항목 추가: 2 클릭 + 입력
- 참조 입력: 자동완성으로 < 10초
- 검증 실행: 1 클릭

### 안정성 목표
- 저장 성공률 > 99%
- ID 충돌 0건
- 파싱 에러 < 0.1%
- 데이터 손실 0건

## 참고 자료

### 관련 파일
- `src/pages/MemoryPage.tsx` - React UI 컴포넌트
- `src/lib/MarkdownEditor.ts` - 파싱 및 편집 로직
- `src/ipc/handlers/fileHandlers.ts` - 파일 읽기/쓰기 IPC
- `CLAUDE.md` - 편집 대상 파일

### 관련 문서
- [Memory Feature README](./README.md)
- [MEMORY_EDITOR.md](/Users/junwoobang/project/claude-code-spec/docs/MEMORY_EDITOR.md)
- [MANAGED_REGIONS_SPEC.md](/Users/junwoobang/project/claude-code-spec/docs/MANAGED_REGIONS_SPEC.md)

### 외부 라이브러리 후보
- **Drag & Drop**: [@dnd-kit/core](https://dndkit.com/)
- **Autocomplete**: [react-select](https://react-select.com/) 또는 커스텀
- **Syntax Highlighting**: [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- **Markdown Rendering**: [react-markdown](https://remarkjs.github.io/react-markdown/)
- **Diff View**: [diff-match-patch](https://github.com/google/diff-match-patch)
- **Toast Notifications**: [react-hot-toast](https://react-hot-toast.com/)

---

**작성자**: Claude Code
**마지막 업데이트**: 2025-10-04
