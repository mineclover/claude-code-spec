# Coding Conventions

## TypeScript

### 타입 정의

```typescript
// 인터페이스 사용 (확장 가능)
export interface User {
  id: string;
  name: string;
  email?: string; // Optional
}

// Type alias (유니온, 인터섹션)
export type Status = 'pending' | 'in_progress' | 'completed';
export type UserWithRole = User & { role: string };
```

### 함수 시그니처

```typescript
// 명시적 반환 타입
export async function fetchUser(id: string): Promise<User | null> {
  // ...
}

// 화살표 함수
const handleClick = (event: React.MouseEvent): void => {
  // ...
};
```

### Import 순서

```typescript
// 1. External libraries
import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// 2. Internal modules (types first)
import type { User } from '../types/user';
import { fetchUser } from '../lib/api';

// 3. Styles
import styles from './Component.module.css';
```

## React 컴포넌트

### 함수형 컴포넌트

```typescript
import type React from 'react';

interface ComponentProps {
  title: string;
  onSave: () => void;
}

export const Component: React.FC<ComponentProps> = ({ title, onSave }) => {
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className={styles.container}>
      <h1>{title}</h1>
      <button onClick={onSave}>Save</button>
    </div>
  );
};
```

### Hooks 사용

```typescript
// useState
const [value, setValue] = useState<string>('');

// useEffect with cleanup
useEffect(() => {
  const subscription = subscribe();
  return () => subscription.unsubscribe();
}, [dependency]);

// useCallback
const handleSubmit = useCallback(async () => {
  // ...
}, [dependency]);

// Custom hook
function useAgents(projectPath: string) {
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    loadAgents();
  }, [projectPath]);

  return { agents, loadAgents };
}
```

### 조건부 렌더링

```typescript
// Early return
if (!projectPath) {
  return <div>No project selected</div>;
}

// 삼항 연산자
{isLoading ? <Spinner /> : <Content />}

// && 연산자
{error && <ErrorMessage error={error} />}

// 옵셔널 체이닝
{user?.name}
```

## CSS Modules

### 클래스 네이밍

```css
/* kebab-case */
.container { }
.form-group { }
.submit-button { }
.is-active { }  /* 상태 클래스 */
.has-error { }  /* 상태 클래스 */
```

### 스타일 패턴

```css
/* VS Code Dark Theme 기반 */
.container {
  background: #1e1e1e;
  color: #d4d4d4;
  border: 1px solid #333;
}

/* Primary color */
.button-primary {
  background: #0e639c;
  color: white;
}

/* Danger color */
.button-danger {
  background: #d32f2f;
  color: white;
}

/* Input focus */
.input:focus {
  outline: none;
  border-color: #0e639c;
}
```

## 파일 구조

### 컴포넌트 파일

```
ComponentName/
├── ComponentName.tsx        # 메인 컴포넌트
├── ComponentName.module.css # 스타일
└── index.ts                 # Re-export (선택사항)
```

### 페이지 파일

```
pages/
├── AgentsPage.tsx
├── AgentsPage.module.css
├── TasksPage.tsx
└── TasksPage.module.css
```

## 에러 핸들링

### try-catch + toast

```typescript
const handleSave = async () => {
  try {
    const result = await window.agentAPI.createAgent(data);
    if (result.success) {
      toast.success('Agent created');
    } else {
      toast.error(result.error || 'Failed to create agent');
    }
  } catch (error) {
    console.error('Failed to create agent:', error);
    toast.error('Failed to create agent');
  }
};
```

### 유효성 검증

```typescript
// 필수 필드 검증
if (!title.trim()) {
  toast.error('Title is required');
  return;
}

// 패턴 검증
const namePattern = /^[a-z0-9-_]+$/;
if (!namePattern.test(name)) {
  toast.error('Name must contain only lowercase letters, numbers, hyphens, and underscores');
  return;
}
```

## IPC 통신

### Handler 작성

```typescript
// src/ipc/handlers/resourceHandlers.ts
import type { IPCRouter } from '../IPCRouter';

export function registerResourceHandlers(router: IPCRouter) {
  router.handle('listResources', async ({ projectPath }) => {
    const resources = await loadResources(projectPath);
    return resources;
  });

  router.handle('getResource', async ({ id, projectPath }) => {
    const resource = await loadResource(id, projectPath);
    return resource;
  });
}
```

### Preload API

```typescript
// src/preload/apis/resource.ts
export interface ResourceAPI {
  listResources: (projectPath: string) => Promise<Resource[]>;
  getResource: (id: string, projectPath: string) => Promise<Resource | null>;
}

export function exposeResourceAPI(): void {
  const resourceAPI: ResourceAPI = {
    listResources: (projectPath) =>
      ipcRenderer.invoke('resource:listResources', { projectPath }),
    getResource: (id, projectPath) =>
      ipcRenderer.invoke('resource:getResource', { id, projectPath }),
  };

  contextBridge.exposeInMainWorld('resourceAPI', resourceAPI);
}
```

## Markdown 파싱

### YAML Frontmatter

```typescript
import yaml from 'yaml';

function parseFrontmatter(content: string): { metadata: any; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    throw new Error('Invalid frontmatter format');
  }

  const metadata = yaml.parse(match[1]);
  const body = match[2].trim();

  return { metadata, body };
}

function generateFrontmatter(metadata: any, body: string): string {
  const yamlStr = yaml.stringify(metadata);
  return `---\n${yamlStr}---\n\n${body}`;
}
```

## 상태 관리

### Local State (useState)

```typescript
// 단순한 로컬 상태
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState({ name: '', email: '' });
```

### Context (공유 상태)

```typescript
// contexts/ThemeContext.tsx
interface ThemeContextValue {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
```

## 성능 최적화

### useMemo / useCallback

```typescript
// 비용이 큰 계산
const filteredItems = useMemo(() => {
  return items.filter(item => item.status === 'active');
}, [items]);

// 콜백 메모이제이션
const handleClick = useCallback(() => {
  doSomething(value);
}, [value]);
```

### 조건부 렌더링 최적화

```typescript
// Early return으로 불필요한 렌더링 방지
if (!data) return null;

// 리스트 최적화 (key 사용)
{items.map(item => (
  <Item key={item.id} data={item} />
))}
```

## Git 커밋 메시지

```
feat: Add user authentication
fix: Resolve login error on Safari
refactor: Simplify task parsing logic
docs: Update API documentation
style: Format code with Biome
test: Add unit tests for task parser
chore: Update dependencies
```

### 커밋 본문 (선택사항)

```
feat: Add agent management UI

- AgentsPage with CRUD operations
- ToolSelector component for tool selection
- PermissionEditor for permission patterns

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

## 주석 작성

### JSDoc

```typescript
/**
 * Parse agent markdown file and extract metadata
 * @param content - Markdown content with YAML frontmatter
 * @param filePath - Path to the markdown file
 * @param source - Storage level (project or user)
 * @returns Parsed agent object
 */
export function parseAgentMarkdown(
  content: string,
  filePath: string,
  source: 'project' | 'user'
): Agent {
  // ...
}
```

### 인라인 주석

```typescript
// Good: 왜 이렇게 했는지 설명
// Use node: protocol for better compatibility with ESM
import * as fs from 'node:fs/promises';

// Bad: 코드가 무엇을 하는지 단순 반복
// Parse the content
const parsed = parse(content);
```

## 테스트

### 유닛 테스트

```typescript
import { describe, it, expect } from 'vitest';
import { validateAgent } from './agentParser';

describe('validateAgent', () => {
  it('should return valid for correct agent', () => {
    const agent = {
      name: 'test-agent',
      description: 'Test agent',
    };

    const result = validateAgent(agent);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should return invalid for missing name', () => {
    const agent = {
      description: 'Test agent',
    };

    const result = validateAgent(agent);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Name is required');
  });
});
```

## 모범 사례

1. **타입 안전성**: `any` 사용 최소화, 명시적 타입 정의
2. **에러 핸들링**: 모든 async 함수에 try-catch
3. **사용자 피드백**: 성공/실패 toast 메시지
4. **접근성**: 시맨틱 HTML, ARIA 속성
5. **성능**: 불필요한 리렌더링 방지
6. **코드 리뷰**: Biome 린터 통과 필수
