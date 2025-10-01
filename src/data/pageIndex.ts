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
