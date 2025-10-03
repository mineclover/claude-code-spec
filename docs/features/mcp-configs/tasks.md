# MCP Configs Feature - Tasks & Improvements

## 현재 구현 상태

### ✅ 완료된 기능

#### 1. 설정 파일 관리 (CRUD)
- **목록 조회** (`listMcpConfigs`)
  - `.claude/` 디렉토리의 `.mcp-*.json` 파일 자동 검색
  - 파일명, 경로, 내용, 수정 시간 포함
  - 알파벳 순 정렬

- **파일 생성** (`createMcpConfig`)
  - 프로젝트별 MCP 설정 파일 생성
  - 선택한 서버들로 JSON 자동 구성
  - `.claude/` 디렉토리 자동 생성
  - 중복 이름 검증

- **파일 편집** (`writeSettingsFile`)
  - JSON 유효성 검증 (`validateMcpJson`)
  - 파일 내용 업데이트
  - 변경 사항 저장 및 리로드

- **파일 삭제** (`deleteSettingsFile`)
  - 삭제 확인 다이얼로그
  - 파일 시스템에서 제거
  - UI 상태 자동 업데이트

#### 2. MCP 서버 관리
- **서버 목록 조회** (`getMcpServers`)
  - `~/.claude.json`에서 사용자 설정 로드
  - 추가 리소스 경로 지원 (설정 기반)
  - 중복 서버 자동 필터링
  - 서버 출처 경로 표시

- **서버 선택 UI**
  - 체크박스 기반 다중 선택
  - 서버 이름 및 명령어 표시
  - 선택된 서버 개수 표시
  - 새로고침 기능

#### 3. UI/UX 기능
- **프로젝트 컨텍스트**
  - 현재 선택된 프로젝트 표시
  - 프로젝트 미선택 시 안내 화면
  - Claude Projects 페이지로 이동 버튼

- **설정 편집기**
  - JSON 구문 강조 (textarea)
  - 실시간 내용 편집
  - Reset 기능 (원본으로 복원)

- **사용 스크립트 자동 생성**
  - Interactive 모드 스크립트
  - Single Query 모드 스크립트
  - 클립보드 복사 기능
  - 상대 경로 자동 처리

#### 4. 백엔드 아키텍처
- **IPC 통신**
  - `settings:list-mcp-configs`
  - `settings:get-mcp-servers`
  - `settings:create-mcp-config`
  - `settings:read-file`
  - `settings:write-file`
  - `settings:delete-file`
  - `settings:validate-mcp-json`

- **파일 시스템 작업**
  - 비동기 파일 I/O
  - 디렉토리 자동 생성
  - 파일 상태 추적 (lastModified)

## 검증 결과

### ✅ 동작 확인
1. **설정 생성**: 새 MCP 설정 파일 생성 성공
2. **설정 편집**: JSON 내용 편집 및 저장 성공
3. **설정 삭제**: 파일 삭제 및 UI 업데이트 성공
4. **서버 로드**: `~/.claude.json`에서 서버 목록 로드 성공
5. **JSON 검증**: 잘못된 JSON 입력 시 오류 표시 확인
6. **스크립트 생성**: 사용 스크립트 자동 생성 및 복사 확인

### 📋 테스트된 시나리오
- ✅ 프로젝트 없이 페이지 접근 (Empty State)
- ✅ 설정 파일 없는 프로젝트 (No Configs)
- ✅ 설정 파일 생성 및 즉시 편집
- ✅ 중복 이름으로 설정 생성 시도 (차단 확인)
- ✅ 잘못된 JSON 저장 시도 (검증 확인)
- ✅ 서버 목록 새로고침
- ✅ 설정 삭제 및 선택 상태 클리어

## 누락된 기능

### 1. 템플릿 시스템
**설명**: 사전 정의된 설정 템플릿 제공

**필요성**:
- 사용자가 매번 서버를 선택하는 수고 감소
- 검증된 설정 조합 제공
- 신규 사용자 온보딩 개선

**구현 제안**:
```typescript
// 템플릿 정의
const MCP_TEMPLATES = {
  development: {
    name: "Development",
    description: "General coding with Serena + Context7",
    servers: ["serena", "context7"]
  },
  analysis: {
    name: "Analysis",
    description: "Code exploration with Serena + Sequential Thinking",
    servers: ["serena", "sequential-thinking"]
  },
  ui: {
    name: "UI Development",
    description: "UI work with Serena + Magic",
    servers: ["serena", "magic"]
  }
};

// UI: 템플릿 선택 드롭다운
// 선택 시 서버 자동 체크
```

### 2. 설정 복제 기능
**설명**: 기존 설정을 복사하여 새 설정 생성

**필요성**:
- 비슷한 설정 생성 시 시간 절약
- 설정 변형 실험 용이

**구현 제안**:
```typescript
// UI: 각 설정 항목에 "Duplicate" 버튼 추가
const handleDuplicateConfig = async (config: McpConfigFile) => {
  const newName = `${config.name.replace('.json', '')}-copy.json`;
  await window.settingsAPI.writeFile(
    path.join(projectPath, '.claude', newName),
    config.content
  );
  loadConfigs();
};
```

### 3. 설정 유효성 고급 검증
**설명**: JSON 구조 검증 외 MCP 스키마 검증

**현재**: JSON.parse()만 수행
**개선**: MCP 스키마 검증
- `mcpServers` 객체 존재 확인
- 각 서버의 필수 필드 확인 (type, command, args)
- 알려진 서버 타입 검증 (stdio, sse)

**구현 제안**:
```typescript
export const validateMcpSchema = (content: string): ValidationResult => {
  try {
    const config = JSON.parse(content);

    if (!config.mcpServers || typeof config.mcpServers !== 'object') {
      return { valid: false, error: 'Missing mcpServers object' };
    }

    for (const [name, server] of Object.entries(config.mcpServers)) {
      if (!server.type || !server.command || !Array.isArray(server.args)) {
        return { valid: false, error: `Invalid server config: ${name}` };
      }

      if (!['stdio', 'sse'].includes(server.type)) {
        return { valid: false, error: `Unknown server type: ${server.type}` };
      }
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: error.message };
  }
};
```

### 4. 설정 프리뷰
**설명**: 설정 파일로 로드될 도구 미리보기

**필요성**:
- 설정 적용 전 영향 파악
- 도구 개수 및 목록 확인

**구현 제안**:
```typescript
// 설정 선택 시 서버별 제공 도구 표시
const showConfigPreview = (config: McpConfigFile) => {
  // Parse config
  // For each server, show expected tools
  // Display total tool count
  // Estimate initialization time
};
```

### 5. 설정 비교 기능
**설명**: 두 설정 파일의 차이점 표시

**필요성**:
- 설정 간 차이 이해
- 최적 설정 선택 지원

**구현 제안**:
```typescript
// UI: "Compare" 모드 추가
// 두 설정 선택 시 diff 표시
// - 추가된 서버 (녹색)
// - 제거된 서버 (빨강)
// - 변경된 설정 (노랑)
```

### 6. 설정 내보내기/가져오기
**설명**: 설정을 다른 프로젝트로 이동

**필요성**:
- 프로젝트 간 설정 공유
- 팀원과 설정 공유

**구현 제안**:
```typescript
// Export: 설정을 JSON 파일로 저장
// Import: JSON 파일에서 설정 로드
// Bulk import: 여러 설정 한번에 가져오기
```

## 개선점

### 1. JSON 편집 UX 개선

#### 현재 문제:
- Plain textarea로 JSON 편집
- 구문 강조 없음
- 자동 완성 없음
- 실시간 오류 표시 없음
- 들여쓰기 자동화 없음

#### 개선 방안:

**Option A: Monaco Editor 통합** (권장)
```typescript
import Editor from '@monaco-editor/react';

<Editor
  height="400px"
  defaultLanguage="json"
  value={editingContent}
  onChange={setEditingContent}
  theme="vs-dark"
  options={{
    minimap: { enabled: false },
    formatOnPaste: true,
    formatOnType: true,
    autoIndent: 'full',
    tabSize: 2,
  }}
/>
```

**장점**:
- VSCode와 동일한 에디터
- JSON 스키마 검증 내장
- 자동 완성 및 포매팅
- 오류 실시간 표시

**Option B: CodeMirror 통합**
```typescript
import CodeMirror from '@uiw/react-codemirror';
import { json } from '@codemirror/lang-json';

<CodeMirror
  value={editingContent}
  height="400px"
  extensions={[json()]}
  onChange={setEditingContent}
  theme="dark"
/>
```

**장점**:
- 경량 라이브러리
- 커스터마이징 용이
- 성능 우수

**Option C: JSON Form 에디터**
```typescript
// JSON을 폼으로 변환하여 편집
interface McpServerForm {
  name: string;
  type: 'stdio' | 'sse';
  command: string;
  args: string[];
  env: Record<string, string>;
}

// 각 서버를 카드 형식으로 표시
// 추가/제거 버튼 제공
// 드래그앤드롭으로 순서 변경
```

**장점**:
- JSON 구조 이해 불필요
- 입력 오류 방지
- 사용자 친화적

### 2. 에러 처리 개선

#### 현재 문제:
- Toast 메시지로만 오류 표시
- 오류 세부 정보 부족
- 복구 방법 안내 없음

#### 개선 방안:

**파일 작업 오류**:
```typescript
try {
  const success = await window.settingsAPI.writeFile(path, content);
  if (!success) throw new Error('Failed to write file');
} catch (error) {
  // 오류 유형별 상세 메시지
  if (error.code === 'EACCES') {
    showDetailedError({
      title: 'Permission Denied',
      message: 'Cannot write to .claude directory',
      suggestion: 'Check file permissions: chmod 755 .claude',
      recovery: 'Try running with sudo or change directory owner'
    });
  } else if (error.code === 'ENOSPC') {
    showDetailedError({
      title: 'Disk Full',
      message: 'Not enough space to save configuration',
      suggestion: 'Free up disk space and try again'
    });
  }
}
```

**MCP 서버 로드 실패**:
```typescript
const result = await window.settingsAPI.getMcpServers();
if (result.error) {
  // 오류 원인별 가이드
  showTroubleshootingPanel({
    error: result.error,
    steps: [
      'Check if ~/.claude.json exists',
      'Verify JSON syntax',
      'Ensure MCP servers are installed',
      'Try: npm install -g <mcp-package>'
    ]
  });
}
```

**JSON 검증 오류**:
```typescript
const validation = await window.settingsAPI.validateMcpJson(content);
if (!validation.valid) {
  // 오류 위치 표시
  showJsonError({
    error: validation.error,
    line: parseErrorLine(validation.error),
    column: parseErrorColumn(validation.error),
    highlight: true  // 에디터에서 오류 위치 하이라이트
  });
}
```

### 3. 사용 스크립트 개선

#### 현재 문제:
- `--dangerously-skip-permissions` 플래그 사용
- 보안 위험 존재
- 권한 관리 무시

#### 개선 방안:

**settings.json 기반 권한 사용** (권장):
```typescript
// 생성되는 스크립트
const generateUsageScript = (configName: string, mode: 'interactive' | 'query') => {
  const baseCmd = 'claude';
  const mcpConfig = `--mcp-config .claude/${configName}`;
  const strictMcp = '--strict-mcp-config';

  // settings.json이 있으면 권한 플래그 생략
  const hasSettings = checkSettingsFileExists();
  const permissionFlag = hasSettings ? '' : '--dangerously-skip-permissions';

  if (mode === 'interactive') {
    return `${baseCmd} ${mcpConfig} ${strictMcp} ${permissionFlag}`.trim();
  } else {
    return `${baseCmd} -p "your query" ${mcpConfig} ${strictMcp} ${permissionFlag}`.trim();
  }
};
```

**권한 설정 가이드 추가**:
```tsx
{!hasSettingsFile && (
  <div className={styles.warningBox}>
    <h4>⚠️ Security Warning</h4>
    <p>Using --dangerously-skip-permissions bypasses security checks.</p>
    <p>Recommended: Create .claude/settings.json for safe automation</p>
    <button onClick={() => navigate('/settings')}>
      Configure Permissions
    </button>
  </div>
)}
```

**추가 스크립트 변형**:
```typescript
// Plan 모드 (읽기 전용)
const planModeScript = `claude --permission-mode plan --mcp-config .claude/${configName} --strict-mcp-config`;

// JSON 출력 모드
const jsonOutputScript = `claude -p "query" --output-format stream-json --mcp-config .claude/${configName} --strict-mcp-config`;

// Verbose 모드
const verboseScript = `claude -p "query" --verbose --mcp-config .claude/${configName} --strict-mcp-config`;
```

### 4. 성능 최적화

#### 현재 문제:
- 설정 변경 시마다 전체 목록 리로드
- 서버 목록 중복 로드
- 불필요한 재렌더링

#### 개선 방안:

**캐싱 전략**:
```typescript
// MCP 서버 목록 캐싱
const [serverCache, setServerCache] = useState<{
  servers: McpServer[];
  timestamp: number;
  ttl: number;
}>(null);

const loadAvailableServers = useCallback(async (force = false) => {
  const now = Date.now();

  // 캐시 유효성 검사
  if (!force && serverCache && (now - serverCache.timestamp) < serverCache.ttl) {
    setAvailableServers(serverCache.servers);
    return;
  }

  // 새로 로드
  const result = await window.settingsAPI.getMcpServers();
  setServerCache({
    servers: result.servers,
    timestamp: now,
    ttl: 5 * 60 * 1000  // 5분
  });
  setAvailableServers(result.servers);
}, [serverCache]);
```

**증분 업데이트**:
```typescript
// 설정 생성 시 목록에 추가만 수행
const handleCreateConfig = async () => {
  const result = await window.settingsAPI.createMcpConfig(...);

  if (result.success && result.path) {
    // 전체 리로드 대신 증분 업데이트
    const newConfig = {
      name: fileName,
      path: result.path,
      content: /* generated content */,
      lastModified: Date.now()
    };

    setConfigs(prev => [...prev, newConfig].sort((a, b) =>
      a.name.localeCompare(b.name)
    ));
  }
};
```

**React 최적화**:
```typescript
// Memoization으로 재렌더링 방지
const configListItems = useMemo(() =>
  configs.map(config => (
    <ConfigItem key={config.path} config={config} />
  )),
  [configs]
);

// 무거운 계산 메모이제이션
const serversByCategory = useMemo(() =>
  categorizeServers(availableServers),
  [availableServers]
);
```

### 5. 사용자 경험 향상

#### 키보드 단축키:
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    // Ctrl/Cmd + S: 저장
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSaveConfig();
    }

    // Ctrl/Cmd + N: 새 설정
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      setIsCreating(true);
    }

    // ESC: 편집 취소
    if (e.key === 'Escape') {
      if (isCreating) {
        setIsCreating(false);
      } else {
        setEditingContent(selectedConfig?.content || '');
      }
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, [isCreating, selectedConfig]);
```

#### 검색/필터:
```tsx
// 설정 검색
const [searchQuery, setSearchQuery] = useState('');
const filteredConfigs = configs.filter(config =>
  config.name.toLowerCase().includes(searchQuery.toLowerCase())
);

// 서버 필터
const [serverFilter, setServerFilter] = useState<'all' | 'installed' | 'missing'>('all');
const filteredServers = availableServers.filter(server => {
  if (serverFilter === 'installed') return isServerInstalled(server);
  if (serverFilter === 'missing') return !isServerInstalled(server);
  return true;
});
```

#### 드래그 앤 드롭:
```tsx
// 설정 파일을 드래그하여 순서 변경
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';

// 서버 선택 시 드래그로 우선순위 지정
```

#### 시각적 피드백:
```typescript
// 저장 중 표시
const [isSaving, setIsSaving] = useState(false);

const handleSaveConfig = async () => {
  setIsSaving(true);
  try {
    // ... 저장 로직
    toast.success('Saved successfully', { icon: '✅' });
  } finally {
    setIsSaving(false);
  }
};

// 변경 사항 표시
const hasUnsavedChanges = editingContent !== selectedConfig?.content;
```

## 버그 및 이슈

### 🐛 발견된 문제

#### 1. 보안 이슈: --dangerously-skip-permissions 사용
**위치**: `/src/pages/McpConfigsPage.tsx:418, 445`

**문제**:
- 생성된 사용 스크립트가 `--dangerously-skip-permissions` 플래그 포함
- 모든 권한 검증 우회
- 보안 위험 존재

**영향**:
- 사용자가 의도치 않게 위험한 작업 수행 가능
- 프로젝트 파일 손상 위험
- 팀 환경에서 일관성 없는 권한 설정

**해결 방안**:
```typescript
// 1. settings.json 기반 권한 사용 (권장)
const script = `claude --mcp-config .claude/${configName} --strict-mcp-config`;

// 2. 또는 권한 플래그 조건부 추가
const permissionFlag = projectHasSettingsJson ? '' : '--dangerously-skip-permissions';
const script = `claude --mcp-config .claude/${configName} --strict-mcp-config ${permissionFlag}`.trim();

// 3. UI에 경고 표시
{!projectHasSettingsJson && (
  <div className={styles.warning}>
    ⚠️ This script bypasses permission checks.
    <a href="/settings">Configure permissions</a> for safer automation.
  </div>
)}
```

#### 2. JSON 검증 제한
**위치**: `/src/services/settings.ts:203-213`

**문제**:
- `JSON.parse()`만 수행
- MCP 스키마 구조 검증 없음
- 잘못된 구조도 저장 가능

**예시**:
```json
// 유효한 JSON이지만 잘못된 MCP 설정
{
  "servers": {  // 'mcpServers'가 아님
    "serena": { ... }
  }
}
```

**해결 방안**:
```typescript
export const validateMcpJson = (content: string): ValidationResult => {
  try {
    const config = JSON.parse(content);

    // MCP 스키마 검증
    if (!config.mcpServers) {
      return { valid: false, error: 'Missing "mcpServers" field' };
    }

    if (typeof config.mcpServers !== 'object') {
      return { valid: false, error: '"mcpServers" must be an object' };
    }

    // 각 서버 검증
    for (const [name, server] of Object.entries(config.mcpServers)) {
      const s = server as any;

      if (!s.type) {
        return { valid: false, error: `Server "${name}" missing "type" field` };
      }

      if (!s.command) {
        return { valid: false, error: `Server "${name}" missing "command" field` };
      }

      if (!Array.isArray(s.args)) {
        return { valid: false, error: `Server "${name}": "args" must be an array` };
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON'
    };
  }
};
```

#### 3. 에러 핸들링 불충분
**위치**: 여러 곳

**문제**:
- 파일 작업 실패 시 세부 정보 부족
- 네트워크 오류 처리 없음
- 복구 가이드 부재

**개선**:
```typescript
// 에러 타입별 메시지
const ERROR_MESSAGES = {
  EACCES: 'Permission denied. Check file permissions.',
  ENOENT: 'File or directory not found.',
  ENOSPC: 'Disk full. Free up space and try again.',
  EISDIR: 'Expected file but found directory.',
  NETWORK: 'Network error. Check your connection.',
};

// 에러 처리 유틸
const handleFileError = (error: any, operation: string) => {
  const message = ERROR_MESSAGES[error.code] || error.message;
  toast.error(`${operation} failed: ${message}`, {
    duration: 5000,
    action: {
      label: 'Details',
      onClick: () => showErrorModal(error)
    }
  });
};
```

#### 4. 중복 서버 처리
**위치**: `/src/services/settings.ts:268-357`

**문제**:
- 서버 이름 기준으로만 중복 제거
- 같은 이름이지만 다른 설정인 서버 충돌 가능
- 우선순위 불명확

**해결**:
```typescript
// 서버 출처 추적
interface McpServer {
  name: string;
  type: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  source: string;  // 출처 경로
  priority: number;  // 우선순위
}

// 충돌 해결 전략
const resolveServerConflict = (servers: McpServer[]) => {
  const grouped = groupBy(servers, 'name');

  return Object.values(grouped).map(group => {
    if (group.length === 1) return group[0];

    // Local > Project > User 순으로 우선순위
    return group.reduce((prev, curr) =>
      curr.priority > prev.priority ? curr : prev
    );
  });
};
```

#### 5. UI 상태 동기화
**위치**: `/src/pages/McpConfigsPage.tsx`

**문제**:
- 파일 변경 후 상태 갱신 지연
- 외부 변경 감지 없음 (파일 시스템 와처 부재)

**해결**:
```typescript
// 파일 시스템 와처 추가
useEffect(() => {
  if (!projectPath) return;

  const watcher = window.settingsAPI.watchMcpConfigs(projectPath, () => {
    loadConfigs();  // 변경 감지 시 리로드
  });

  return () => watcher.close();
}, [projectPath]);

// 또는 폴링
useEffect(() => {
  const interval = setInterval(() => {
    loadConfigs();
  }, 5000);  // 5초마다 체크

  return () => clearInterval(interval);
}, [projectPath]);
```

## 다음 단계

### 우선순위 1 (긴급/중요)
1. **보안 개선**: `--dangerously-skip-permissions` 제거
   - settings.json 기반 권한 사용
   - 안전한 기본 스크립트 생성
   - 경고 메시지 추가

2. **JSON 검증 강화**: MCP 스키마 검증
   - mcpServers 필드 검증
   - 서버 구조 검증
   - 상세한 오류 메시지

### 우선순위 2 (중요/비긴급)
1. **JSON 에디터 개선**: Monaco Editor 통합
   - 구문 강조
   - 자동 완성
   - 실시간 검증
   - 포매팅

2. **템플릿 시스템**: 사전 정의 템플릿
   - 개발, 분석, UI, E2E 템플릿
   - 템플릿 선택 UI
   - 커스텀 템플릿 저장

3. **에러 처리 개선**: 상세한 오류 메시지
   - 파일 작업 오류 가이드
   - 복구 방법 제시
   - 트러블슈팅 패널

### 우선순위 3 (유용/선택)
1. **설정 관리 고급 기능**:
   - 설정 복제
   - 설정 비교
   - 설정 내보내기/가져오기

2. **UX 향상**:
   - 키보드 단축키
   - 검색/필터
   - 드래그 앤 드롭

3. **설정 프리뷰**:
   - 로드될 도구 미리보기
   - 초기화 시간 예측
   - 서버 상태 표시

### 우선순위 4 (개선/최적화)
1. **성능 최적화**:
   - 서버 목록 캐싱
   - 증분 업데이트
   - React 메모이제이션

2. **고급 기능**:
   - 파일 시스템 와처
   - 설정 버전 관리
   - 팀 설정 공유

## 권장 개발 순서

### Week 1: 보안 및 검증
- [ ] `--dangerously-skip-permissions` 제거
- [ ] settings.json 기반 권한 통합
- [ ] MCP 스키마 검증 구현
- [ ] 에러 메시지 개선

### Week 2: 에디터 및 UX
- [ ] Monaco Editor 통합
- [ ] 키보드 단축키 추가
- [ ] 검색/필터 기능
- [ ] 저장 상태 피드백

### Week 3: 고급 기능
- [ ] 템플릿 시스템
- [ ] 설정 복제
- [ ] 설정 프리뷰
- [ ] 트러블슈팅 가이드

### Week 4: 최적화 및 테스트
- [ ] 성능 최적화
- [ ] 파일 와처 구현
- [ ] E2E 테스트 작성
- [ ] 문서 업데이트

## 참고 자료

### 내부 문서
- [README.md](./README.md) - 기능 개요 및 사용 가이드
- [CLAUDE.md](../../../CLAUDE.md) - 프로젝트 설정
- [Settings Feature](../settings/tasks.md) - 권한 설정

### 외부 문서
- [Claude Code - MCP Configuration](https://docs.anthropic.com/claude-code/mcp)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Monaco Editor](https://microsoft.github.io/monaco-editor/)

### 관련 이슈
- 설정 파일 검증 강화 필요
- 보안 경고 표시 개선
- JSON 편집 UX 개선
