import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * 프로젝트의 MCP config 파일을 읽어 활성화된 MCP 서버 목록을 반환
 */
export async function getActiveMcpServers(projectPath: string): Promise<string[]> {
  // .claude/.mcp-dev.json, .mcp-analysis.json 등 읽기
  const mcpConfigFiles = ['.claude/.mcp-dev.json', '.claude/.mcp-analysis.json'];

  const activeServers = new Set<string>();

  for (const configFile of mcpConfigFiles) {
    try {
      const configPath = path.join(projectPath, configFile);
      const configContent = await fs.readFile(configPath, 'utf-8');
      const config = JSON.parse(configContent);

      // MCP config에서 활성화된 서버 이름 추출
      if (config.mcpServers) {
        Object.keys(config.mcpServers).forEach((server) => {
          activeServers.add(server);
        });
      }
    } catch (_error) {}
  }

  return Array.from(activeServers);
}

/**
 * MCP 도구가 사용 가능한지 확인 (해당 MCP 서버가 활성화되어 있는지)
 */
export function isMcpToolAvailable(tool: string, activeServers: string[]): boolean {
  if (!tool.startsWith('mcp__')) return true; // MCP 도구가 아니면 항상 사용 가능

  // 도구 이름에서 서버 이름 추출: mcp__serena__find_symbol -> serena
  const parts = tool.split('__');
  if (parts.length < 2) return false;

  const serverName = parts[1];
  return activeServers.includes(serverName);
}

/**
 * MCP 도구들을 서버별로 그룹화
 */
export function groupMcpToolsByServer(tools: string[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();

  tools.forEach((tool) => {
    if (!tool.startsWith('mcp__')) return;

    const parts = tool.split('__');
    if (parts.length < 2) return;

    const serverName = parts[1];

    if (!grouped.has(serverName)) {
      grouped.set(serverName, []);
    }

    grouped.get(serverName)?.push(tool);
  });

  return grouped;
}
