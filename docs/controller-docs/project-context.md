# ProjectContext 시스템

## 개요
ProjectContext는 애플리케이션 전역에서 현재 선택된 프로젝트 정보를 공유하고 동기화하는 React Context 기반 상태 관리 시스템입니다.

## 핵심 개념

### Context Provider
`ProjectProvider`는 앱 최상위에서 프로젝트 상태를 관리하며, 모든 하위 컴포넌트에서 `useProject()` 훅을 통해 접근할 수 있습니다.

### 상태 구조
```typescript
interface ProjectContextValue {
  projectPath: string | null;          // 프로젝트 디렉토리 절대 경로
  projectDirName: string | null;       // 프로젝트 디렉토리 이름
  updateProject: (path, dirName) => void;  // 프로젝트 정보 업데이트
  clearProject: () => void;            // 프로젝트 선택 해제
}
```

## 주요 용어

### contextProjectPath
- **정의**: ProjectContext에서 관리되는 전역 프로젝트 경로 상태
- **타입**: `string | null`
- **용도**: 여러 페이지 간 프로젝트 정보 동기화
- **지속성**: localStorage에 자동 저장되어 세션 간 유지

### 로컬 projectPath vs contextProjectPath

| 구분 | 로컬 projectPath | contextProjectPath |
|------|-----------------|-------------------|
| 범위 | 컴포넌트 내부 상태 | 전역 공유 상태 |
| 용도 | UI 입력 필드 제어 | 페이지 간 동기화 |
| 지속성 | 컴포넌트 마운트 시 소멸 | localStorage 저장 |
| 업데이트 | 사용자 직접 입력 | Context API를 통한 업데이트 |

## 사용 패턴

### 1. Context 읽기
```typescript
const { projectPath: contextProjectPath } = useProject();
```

### 2. Context 업데이트
```typescript
const { updateProject } = useProject();

// 프로젝트 선택 시
updateProject('/path/to/project', 'project-name');
```

### 3. 로컬 상태와 동기화
```typescript
const [projectPath, setProjectPath] = useState('');
const { projectPath: contextProjectPath } = useProject();

// Context 변경 감지 및 로컬 상태 업데이트
useEffect(() => {
  if (contextProjectPath && contextProjectPath !== projectPath) {
    setProjectPath(contextProjectPath);
  }
}, [contextProjectPath, projectPath]);
```

## 데이터 흐름

### 프로젝트 선택 시나리오

```
1. Claude Projects 페이지
   ├─ 사용자가 "Execute" 버튼 클릭
   ├─ updateProject(path, dirName) 호출
   └─ navigate('/') → Execute 페이지로 이동

2. Execute 페이지
   ├─ contextProjectPath 변경 감지
   ├─ 로컬 projectPath 상태 업데이트
   └─ UI 입력 필드 자동 갱신
```

### 영속성 메커니즘

```
1. Context 업데이트
   └─ updateProject() 호출
      └─ localStorage.setItem('currentProjectPath', path)

2. 앱 재시작
   └─ ProjectProvider 마운트
      └─ localStorage에서 저장된 경로 복원
         └─ contextProjectPath 상태 초기화
```

## 통합 지점

### 1. Execute 페이지
- **역할**: Context를 읽어 프로젝트 경로 입력 필드 자동 설정
- **파일**: `src/pages/ExecutePage.tsx`

### 2. Claude Projects 페이지
- **역할**: 프로젝트 선택 시 Context 업데이트
- **파일**: `src/components/sessions/ClaudeProjectsList.tsx`

### 3. MCP Configs 페이지
- **역할**: Context에서 현재 프로젝트 경로 읽기
- **파일**: `src/pages/McpConfigsPage.tsx`

### 4. Layout (Sidebar Footer)
- **역할**: 현재 선택된 프로젝트 표시
- **파일**: `src/components/layout/Layout.tsx`

## 베스트 프랙티스

### ✅ 권장사항
1. Context 업데이트는 항상 `updateProject()` 사용
2. 컴포넌트 내부 입력 필드는 로컬 state 사용
3. Context 변경 시 useEffect로 동기화
4. 프로젝트 선택 후 페이지 전환 시 Context 먼저 업데이트

### ❌ 피해야 할 사항
1. Context를 직접 수정하지 않기
2. 로컬 state와 Context를 혼동하지 않기
3. Context 없이 페이지 간 프로젝트 정보 전달하지 않기

## 문제 해결

### Context가 업데이트되지 않는 경우
1. `ProjectProvider`가 앱 최상위에 있는지 확인
2. `useProject()` 훅이 Provider 내부에서 호출되는지 확인
3. Browser DevTools → Application → Local Storage에서 값 확인

### 페이지 간 동기화 안 되는 경우
1. contextProjectPath useEffect 의존성 배열 확인
2. 조건문에서 무한 루프 방지 로직 확인
3. Console에서 동기화 로그 확인

## 관련 문서
- [ARCHITECTURE.md](../ARCHITECTURE.md) - 전체 아키텍처 구조
- [glossary.md](./glossary.md) - 용어 정의
