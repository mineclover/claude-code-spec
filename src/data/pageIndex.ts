export interface PageIndex {
  id: string;
  name: string;
  displayName: string;
  description: string;
  route: string;
  icon: string;
  category: 'execution' | 'documentation' | 'management' | 'configuration';
  keywords: string[];
}

export const PAGE_INDEX: PageIndex[] = [
  // Execution
  {
    id: 'execute',
    name: 'Execute',
    displayName: 'Claude CLI 실행',
    description: 'Claude CLI 명령을 실행하고 실시간 스트림 응답을 확인합니다.',
    route: '/',
    icon: '▶️',
    category: 'execution',
    keywords: ['execute', 'run', 'command', 'cli', '실행', '명령', '쿼리'],
  },
  {
    id: 'sessions',
    name: 'Sessions',
    displayName: '세션 관리',
    description: '이전 실행 세션을 조회하고 재개합니다.',
    route: '/',
    icon: '📋',
    category: 'execution',
    keywords: ['session', 'history', 'resume', '세션', '히스토리', '이력'],
  },

  // Documentation
  {
    id: 'claude-docs',
    name: 'Claude Docs',
    displayName: 'Claude 문서',
    description: 'Claude Code 컨텍스트 및 사용법 문서를 탐색합니다.',
    route: '/claude-docs',
    icon: '📚',
    category: 'documentation',
    keywords: ['docs', 'documentation', 'context', 'guide', '문서', '가이드', '매뉴얼'],
  },
  {
    id: 'controller-docs',
    name: 'Controller Docs',
    displayName: '컨트롤러 문서',
    description: '용어집 및 메타데이터 관리 문서입니다.',
    route: '/controller-docs',
    icon: '🎛️',
    category: 'documentation',
    keywords: ['glossary', 'terms', 'metadata', '용어집', '메타', '용어'],
  },

  // Management
  {
    id: 'central-dashboard',
    name: 'Central Dashboard',
    displayName: '중앙 대시보드',
    description: '모든 프로젝트의 통합 현황을 모니터링하고 관리합니다.',
    route: '/central-dashboard',
    icon: '🎛️',
    category: 'management',
    keywords: ['central', 'dashboard', 'monitoring', 'overview', '중앙', '대시보드', '모니터링', '현황'],
  },
  {
    id: 'claude-projects',
    name: 'Claude Projects',
    displayName: 'Claude 프로젝트',
    description: 'Claude CLI 프로젝트 및 세션 로그를 관리합니다.',
    route: '/claude-projects',
    icon: '📁',
    category: 'management',
    keywords: ['projects', 'sessions', 'logs', '프로젝트', '세션', '로그'],
  },
  {
    id: 'mcp-configs',
    name: 'MCP Configs',
    displayName: 'MCP 설정',
    description: 'MCP 서버 설정 파일을 생성하고 관리합니다.',
    route: '/mcp-configs',
    icon: '🔌',
    category: 'management',
    keywords: ['mcp', 'config', 'servers', 'tools', 'configuration', '설정', '서버', '도구'],
  },

  // Configuration
  {
    id: 'memory',
    name: 'Memory',
    displayName: 'Memory 편집기',
    description: 'CLAUDE.md 파일의 참조 및 컨텍스트를 관리합니다.',
    route: '/memory',
    icon: '🧠',
    category: 'configuration',
    keywords: [
      'memory',
      'claude.md',
      'context',
      'reference',
      'markdown',
      '메모리',
      '참조',
      '문서',
      '컨텍스트',
    ],
  },
  {
    id: 'tasks',
    name: 'Tasks',
    displayName: '작업 관리',
    description:
      '프로젝트 작업을 정의하고 에이전트에게 할당합니다. 리뷰어를 지정하여 결과를 검토할 수 있습니다.',
    route: '/tasks',
    icon: '✅',
    category: 'management',
    keywords: ['tasks', 'todo', 'agent', 'review', 'assignment', '작업', '할당', '리뷰'],
  },
  {
    id: 'workflow',
    name: 'Workflow',
    displayName: '워크플로우 자동화',
    description:
      'Task 실행을 자동화하고 모니터링합니다. 의존성 기반 스케줄링으로 여러 작업을 순차적으로 실행합니다.',
    route: '/workflow',
    icon: '⚙️',
    category: 'management',
    keywords: ['workflow', 'automation', 'monitor', 'execution', 'progress', '워크플로우', '자동화', '모니터링', '진행'],
  },
  {
    id: 'agents',
    name: 'Agents',
    displayName: 'Agent 관리',
    description:
      'Tasks를 수행할 전문화된 AI Agent를 생성하고 관리합니다. 도구 및 파일 권한을 제어할 수 있습니다.',
    route: '/agents',
    icon: '🤖',
    category: 'management',
    keywords: [
      'agents',
      'sub-agent',
      'ai',
      'automation',
      'permissions',
      '에이전트',
      '자동화',
      '권한',
    ],
  },
  {
    id: 'skills',
    name: 'Skills',
    displayName: 'Skills 관리',
    description:
      'Claude Code의 능력을 확장하는 모듈형 Skills를 관리합니다. 공식 저장소에서 Skills를 탐색하고 Import할 수 있습니다.',
    route: '/skills',
    icon: '🎯',
    category: 'management',
    keywords: [
      'skills',
      'repository',
      'import',
      'workflow',
      'extend',
      '스킬',
      '워크플로우',
      '확장',
      '저장소',
    ],
  },
  {
    id: 'output-styles',
    name: 'Output Styles',
    displayName: 'Output Styles',
    description:
      'Claude Code의 출력 스타일과 동작을 설정합니다. JSON 출력, 설명형 응답 등 다양한 스타일을 적용할 수 있습니다.',
    route: '/output-styles',
    icon: '🎨',
    category: 'configuration',
    keywords: ['output', 'style', 'format', 'json', 'custom', 'behavior', '출력', '스타일', '형식'],
  },
  {
    id: 'settings',
    name: 'Settings',
    displayName: '설정',
    description: '애플리케이션 설정 및 프로젝트 경로를 관리합니다.',
    route: '/settings',
    icon: '⚙️',
    category: 'configuration',
    keywords: ['settings', 'config', 'preferences', '설정', '환경설정'],
  },
];

export const CATEGORY_INFO = {
  execution: {
    name: '실행',
    description: 'Claude CLI 실행 및 세션 관리',
    icon: '⚡',
  },
  documentation: {
    name: '문서',
    description: '가이드 및 참조 문서',
    icon: '📖',
  },
  management: {
    name: '관리',
    description: '프로젝트 및 로그 관리',
    icon: '🗂️',
  },
  configuration: {
    name: '설정',
    description: '애플리케이션 설정',
    icon: '🔧',
  },
} as const;

// Search function
export function searchPages(query: string): PageIndex[] {
  const lowerQuery = query.toLowerCase();
  return PAGE_INDEX.filter((page) => {
    const searchString = [page.name, page.displayName, page.description, ...page.keywords]
      .join(' ')
      .toLowerCase();

    return searchString.includes(lowerQuery);
  });
}

// Get page by ID
export function getPageById(id: string): PageIndex | undefined {
  return PAGE_INDEX.find((page) => page.id === id);
}

// Get pages by category
export function getPagesByCategory(category: PageIndex['category']): PageIndex[] {
  return PAGE_INDEX.filter((page) => page.category === category);
}
