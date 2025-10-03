export interface ToolGroup {
  id: string;
  name: string;
  description: string;
  tools: string[];
  requiresMcp?: boolean; // MCP config가 필요한 그룹인지 표시
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
    description: 'MCP 서버 도구 (MCP config 필요)',
    requiresMcp: true,
    tools: [
      // serena
      'mcp__serena__list_dir',
      'mcp__serena__find_file',
      'mcp__serena__search_for_pattern',
      'mcp__serena__get_symbols_overview',
      'mcp__serena__find_symbol',
      'mcp__serena__find_referencing_symbols',
      'mcp__serena__replace_symbol_body',
      'mcp__serena__insert_after_symbol',
      'mcp__serena__insert_before_symbol',
      'mcp__serena__write_memory',
      'mcp__serena__read_memory',
      'mcp__serena__list_memories',
      'mcp__serena__delete_memory',
      // magic
      'mcp__magic__21st_magic_component_builder',
      'mcp__magic__logo_search',
      'mcp__magic__21st_magic_component_inspiration',
      'mcp__magic__21st_magic_component_refiner',
      // playwright
      'mcp__playwright__browser_navigate',
      'mcp__playwright__browser_click',
      'mcp__playwright__browser_snapshot',
      'mcp__playwright__browser_close',
      'mcp__playwright__browser_resize',
      'mcp__playwright__browser_console_messages',
      'mcp__playwright__browser_handle_dialog',
      'mcp__playwright__browser_evaluate',
      'mcp__playwright__browser_file_upload',
      'mcp__playwright__browser_fill_form',
      'mcp__playwright__browser_install',
      'mcp__playwright__browser_press_key',
      'mcp__playwright__browser_type',
      'mcp__playwright__browser_navigate_back',
      'mcp__playwright__browser_network_requests',
      'mcp__playwright__browser_take_screenshot',
      'mcp__playwright__browser_drag',
      'mcp__playwright__browser_hover',
      'mcp__playwright__browser_select_option',
      'mcp__playwright__browser_tabs',
      'mcp__playwright__browser_wait_for',
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

/**
 * Get all available tools (excluding '*')
 */
export function getAllTools(): string[] {
  const tools = new Set<string>();

  TOOL_GROUPS.forEach((group) => {
    if (group.id === 'all') return; // Skip 'all' group
    group.tools.forEach((tool) => tools.add(tool));
  });

  return Array.from(tools).sort();
}

/**
 * Get tools by group IDs
 */
export function getToolsByGroups(groupIds: string[]): string[] {
  if (groupIds.includes('all')) {
    return ['*']; // 모든 도구
  }

  const tools = new Set<string>();
  groupIds.forEach((groupId) => {
    const group = TOOL_GROUPS.find((g) => g.id === groupId);
    if (group) {
      group.tools.forEach((tool) => tools.add(tool));
    }
  });

  return Array.from(tools);
}

/**
 * Get group IDs by tools
 */
export function getGroupsByTools(tools: string[]): string[] {
  if (tools.includes('*')) {
    return ['all'];
  }

  const selectedGroups: string[] = [];
  TOOL_GROUPS.forEach((group) => {
    if (group.id === 'all') return;

    const allToolsInGroup = group.tools.every((tool) => tools.includes(tool));
    if (allToolsInGroup && group.tools.length > 0) {
      selectedGroups.push(group.id);
    }
  });

  return selectedGroups;
}
