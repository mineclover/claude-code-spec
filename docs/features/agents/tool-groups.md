# Agent Tool Groups

## 개요

Agent 생성 시 도구(allowedTools)를 투명하게 선택할 수 있도록 그룹화된 도구 세트를 제공합니다. 프리셋과 달리, 각 그룹을 개별적으로 선택/해제할 수 있어 정확히 어떤 도구가 허용되는지 명확히 알 수 있습니다.

## 도구 그룹 분류

### 1. All Tools
모든 도구를 허용합니다.

```yaml
allowedTools:
  - Read
  - Write
  - Edit
  - Bash
  - Grep
  - Glob
  - WebFetch
  - WebSearch
  - Task
  - TodoWrite
  # ... (모든 사용 가능한 도구)
```

**사용 사례**: 제한 없이 모든 작업을 수행할 수 있는 범용 Agent

### 2. Read-only Tools (읽기 전용)
파일 및 정보 조회만 가능한 도구입니다.

```yaml
allowedTools:
  - Read         # 파일 읽기
  - Grep         # 패턴 검색
  - Glob         # 파일 찾기
  - WebFetch     # 웹 컨텐츠 읽기
  - WebSearch    # 웹 검색
```

**사용 사례**:
- 코드 분석 Agent
- 리뷰 Agent
- 문서 조사 Agent

### 3. Edit Tools (편집 도구)
파일 생성 및 수정 도구입니다.

```yaml
allowedTools:
  - Write        # 파일 작성
  - Edit         # 파일 편집
```

**사용 사례**:
- 코드 생성 Agent
- 문서 작성 Agent
- 리팩토링 Agent

### 4. Execution Tools (실행 도구)
명령 및 스크립트 실행 도구입니다.

```yaml
allowedTools:
  - Bash         # 쉘 명령 실행
```

**사용 사례**:
- 테스트 실행 Agent
- 빌드 Agent
- 배포 Agent

### 5. MCP Tools
MCP 서버에서 제공하는 도구들입니다.

```yaml
allowedTools:
  - mcp__serena__list_dir
  - mcp__serena__find_file
  - mcp__serena__search_for_pattern
  - mcp__serena__get_symbols_overview
  - mcp__serena__find_symbol
  - mcp__serena__find_referencing_symbols
  - mcp__serena__replace_symbol_body
  - mcp__serena__insert_after_symbol
  - mcp__serena__insert_before_symbol
  # ... (기타 MCP 도구)
```

**사용 사례**:
- 심볼 기반 코드 분석 Agent
- 구조적 리팩토링 Agent

### 6. Task Management Tools
작업 및 할일 관리 도구입니다.

```yaml
allowedTools:
  - Task         # 복잡한 작업 실행
  - TodoWrite    # 할일 목록 관리
```

**사용 사례**:
- 프로젝트 매니저 Agent
- 작업 계획 Agent

### 7. Other Tools
기타 특수 목적 도구입니다.

```yaml
allowedTools:
  - NotebookEdit     # Jupyter 노트북 편집
  - SlashCommand     # 슬래시 명령 실행
  - KillShell        # 쉘 프로세스 종료
  - BashOutput       # 백그라운드 쉘 출력 조회
```

**사용 사례**:
- Jupyter 노트북 작업 Agent
- 프로세스 관리 Agent

## UI 설계

### Agent 생성/수정 화면

```
┌─────────────────────────────────────────────────────────┐
│  Create New Agent                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Name: * my-agent                      (필수)          │
│  Description: * 설명                   (필수)          │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Allowed Tools                                   │   │
│  │                                                 │   │
│  │ Quick Select:                                   │   │
│  │ ☐ All tools                                     │   │
│  │ ☐ Read-only tools                               │   │
│  │ ☐ Edit tools                                    │   │
│  │ ☐ Execution tools                               │   │
│  │ ☐ MCP tools                                     │   │
│  │ ☐ Task Management tools                         │   │
│  │ ☐ Other tools                                   │   │
│  │                                                 │   │
│  │ Individual Tools:                               │   │
│  │ ☑ Read          ☐ Write         ☐ Edit         │   │
│  │ ☑ Grep          ☐ Bash          ☑ Glob         │   │
│  │ ☐ WebFetch      ☐ WebSearch     ☐ Task         │   │
│  │ ☐ TodoWrite     ☐ NotebookEdit  ...            │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Permissions                                     │   │
│  │                                                 │   │
│  │ Allow List:                                     │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ read:src/**                      [Remove]   │ │   │
│  │ │ write:tests/**                   [Remove]   │ │   │
│  │ │ bash:npm run test                [Remove]   │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  │ [+ Add Pattern]                                 │   │
│  │                                                 │   │
│  │ Deny List:                                      │   │
│  │ ┌─────────────────────────────────────────────┐ │   │
│  │ │ write:src/**                     [Remove]   │ │   │
│  │ │ read:.env                        [Remove]   │ │   │
│  │ └─────────────────────────────────────────────┘ │   │
│  │ [+ Add Pattern]                                 │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  [Create Agent] [Cancel]                                │
└─────────────────────────────────────────────────────────┘
```

## 동작 방식

### 1. Quick Select (그룹 선택)

그룹 체크박스를 선택하면 해당 그룹의 모든 도구가 자동으로 선택됩니다:

```
☑ Read-only tools 선택
  ↓
☑ Read
☑ Grep
☑ Glob
☑ WebFetch
☑ WebSearch
```

### 2. Individual Tools (개별 선택)

개별 도구를 직접 선택/해제할 수 있습니다. 개별 도구를 수정하면 해당 그룹의 체크박스는 부분 선택 상태(indeterminate)가 됩니다.

```
☑ Read-only tools (모든 도구 선택됨)
  ↓ Grep 해제
▣ Read-only tools (일부만 선택됨, indeterminate 상태)
```

### 3. All Tools 선택

"All tools"를 선택하면 모든 도구가 활성화됩니다:

```
☑ All tools
  ↓
☑ Read-only tools
☑ Edit tools
☑ Execution tools
☑ MCP tools
☑ Task Management tools
☑ Other tools
```

## 권한 패턴 예시

### 읽기 전용 권한

```yaml
permissions:
  allowList:
    - "read:**"
  denyList:
    - "read:.env"
    - "read:**/*.key"
    - "read:**/*.pem"
```

### 테스트 작성 권한

```yaml
permissions:
  allowList:
    - "read:src/**"
    - "read:types/**"
    - "write:tests/**"
    - "bash:npm run test"
    - "bash:npm run test:*"
  denyList:
    - "write:src/**"
    - "bash:rm:*"
```

### 문서 작성 권한

```yaml
permissions:
  allowList:
    - "read:src/**"
    - "read:docs/**"
    - "write:docs/**"
    - "write:README.md"
    - "write:CHANGELOG.md"
  denyList:
    - "write:src/**"
    - "write:tests/**"
```

### 전체 개발 권한

```yaml
permissions:
  allowList:
    - "read:**"
    - "write:**"
    - "bash:npm run *"
    - "bash:git add:*"
    - "bash:git commit:*"
  denyList:
    - "read:.env"
    - "write:.env"
    - "bash:rm:*"
    - "bash:git push:*"
```

## 구현

### 타입 정의 (`src/types/toolGroups.ts`)

```typescript
export interface ToolGroup {
  id: string;
  name: string;
  description: string;
  tools: string[];
}

export const TOOL_GROUPS: ToolGroup[] = [
  {
    id: 'all',
    name: 'All tools',
    description: '모든 도구 허용',
    tools: ['*'], // 특수 케이스: 모든 도구
  },
  {
    id: 'read-only',
    name: 'Read-only tools',
    description: '읽기 전용 도구',
    tools: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
  },
  {
    id: 'edit',
    name: 'Edit tools',
    description: '편집 도구',
    tools: ['Write', 'Edit'],
  },
  {
    id: 'execution',
    name: 'Execution tools',
    description: '실행 도구',
    tools: ['Bash'],
  },
  {
    id: 'mcp',
    name: 'MCP tools',
    description: 'MCP 서버 도구',
    tools: [
      'mcp__serena__list_dir',
      'mcp__serena__find_file',
      'mcp__serena__search_for_pattern',
      'mcp__serena__get_symbols_overview',
      'mcp__serena__find_symbol',
      'mcp__serena__find_referencing_symbols',
      'mcp__serena__replace_symbol_body',
      'mcp__serena__insert_after_symbol',
      'mcp__serena__insert_before_symbol',
      // ... 기타 MCP 도구
    ],
  },
  {
    id: 'task-management',
    name: 'Task Management tools',
    description: '작업 관리 도구',
    tools: ['Task', 'TodoWrite'],
  },
  {
    id: 'other',
    name: 'Other tools',
    description: '기타 도구',
    tools: ['NotebookEdit', 'SlashCommand', 'KillShell', 'BashOutput'],
  },
];

export function getToolsByGroups(groupIds: string[]): string[] {
  if (groupIds.includes('all')) {
    return ['*']; // 모든 도구
  }

  const tools = new Set<string>();
  groupIds.forEach(groupId => {
    const group = TOOL_GROUPS.find(g => g.id === groupId);
    if (group) {
      group.tools.forEach(tool => tools.add(tool));
    }
  });

  return Array.from(tools);
}

export function getGroupsByTools(tools: string[]): string[] {
  if (tools.includes('*')) {
    return ['all'];
  }

  const selectedGroups: string[] = [];
  TOOL_GROUPS.forEach(group => {
    if (group.id === 'all') return;

    const allToolsInGroup = group.tools.every(tool => tools.includes(tool));
    if (allToolsInGroup) {
      selectedGroups.push(group.id);
    }
  });

  return selectedGroups;
}
```

### UI 컴포넌트 (`src/components/agent/ToolSelector.tsx`)

```typescript
interface ToolSelectorProps {
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function ToolSelector({ selectedTools, onToolsChange }: ToolSelectorProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  useEffect(() => {
    // 선택된 도구로부터 그룹 계산
    setSelectedGroups(getGroupsByTools(selectedTools));
  }, [selectedTools]);

  const handleGroupToggle = (groupId: string) => {
    const group = TOOL_GROUPS.find(g => g.id === groupId);
    if (!group) return;

    if (selectedGroups.includes(groupId)) {
      // 그룹 해제: 해당 그룹의 도구들 제거
      const newTools = selectedTools.filter(t => !group.tools.includes(t));
      onToolsChange(newTools);
    } else {
      // 그룹 선택: 해당 그룹의 도구들 추가
      const newTools = [...new Set([...selectedTools, ...group.tools])];
      onToolsChange(newTools);
    }
  };

  const handleIndividualToolToggle = (tool: string) => {
    if (selectedTools.includes(tool)) {
      onToolsChange(selectedTools.filter(t => t !== tool));
    } else {
      onToolsChange([...selectedTools, tool]);
    }
  };

  return (
    <div className={styles.toolSelector}>
      <h3>Allowed Tools</h3>

      <div className={styles.quickSelect}>
        <h4>Quick Select:</h4>
        {TOOL_GROUPS.map(group => (
          <label key={group.id}>
            <input
              type="checkbox"
              checked={selectedGroups.includes(group.id)}
              onChange={() => handleGroupToggle(group.id)}
            />
            {group.name}
          </label>
        ))}
      </div>

      <div className={styles.individualTools}>
        <h4>Individual Tools:</h4>
        {/* 모든 사용 가능한 도구 목록 */}
        {ALL_TOOLS.map(tool => (
          <label key={tool}>
            <input
              type="checkbox"
              checked={selectedTools.includes(tool)}
              onChange={() => handleIndividualToolToggle(tool)}
            />
            {tool}
          </label>
        ))}
      </div>
    </div>
  );
}
```

## 장점

### 1. 투명성
사용자가 정확히 어떤 도구가 허용되는지 명확히 알 수 있습니다.

### 2. 유연성
그룹 단위로 빠르게 선택하거나, 개별 도구를 세밀하게 조정할 수 있습니다.

### 3. 안전성
불필요한 도구를 실수로 허용하는 것을 방지합니다.

### 4. 재사용성
자주 사용하는 조합(읽기 전용, 편집 가능 등)을 빠르게 선택할 수 있습니다.

## 예시 시나리오

### 시나리오 1: 코드 리뷰 Agent

1. "Read-only tools" 그룹 선택
2. 결과: Read, Grep, Glob, WebFetch, WebSearch 활성화
3. 개별 조정: WebFetch, WebSearch 해제 (필요 없음)
4. 최종: Read, Grep, Glob만 허용

### 시나리오 2: 테스트 생성 Agent

1. "Read-only tools" 그룹 선택
2. "Edit tools" 그룹 선택
3. "Execution tools" 그룹 선택
4. 개별 조정: WebFetch, WebSearch 해제
5. 최종: Read, Grep, Glob, Write, Edit, Bash 허용

### 시나리오 3: 범용 개발 Agent

1. "All tools" 선택
2. 최종: 모든 도구 허용

## 참고

- Permissions(권한)는 별도로 관리됩니다
- 도구 선택과 권한 설정을 조합하여 안전하고 제한된 Agent를 만들 수 있습니다
- MCP 도구는 프로젝트의 MCP 설정에 따라 사용 가능한 도구가 달라질 수 있습니다
