import { useEffect, useState } from 'react';
import {
  getAllTools,
  getGroupsByTools,
  getToolsByGroups,
  TOOL_GROUPS,
  type ToolGroup,
} from '../../types/toolGroups';
import styles from './ToolSelector.module.css';

interface ToolSelectorProps {
  projectPath: string;
  selectedTools: string[];
  onToolsChange: (tools: string[]) => void;
}

export function ToolSelector({ projectPath, selectedTools, onToolsChange }: ToolSelectorProps) {
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [activeMcpServers, setActiveMcpServers] = useState<string[]>([]);

  useEffect(() => {
    // 선택된 도구로부터 그룹 계산
    setSelectedGroups(getGroupsByTools(selectedTools));
  }, [selectedTools]);

  useEffect(() => {
    // MCP 서버 목록 가져오기
    async function loadActiveMcpServers() {
      try {
        // TODO: mcpConfigHelper.getActiveMcpServers() 호출
        // 현재는 임시로 빈 배열 반환
        setActiveMcpServers([]);
      } catch (error) {
        console.error('Failed to load MCP servers:', error);
        setActiveMcpServers([]);
      }
    }

    loadActiveMcpServers();
  }, [projectPath]);

  const handleGroupToggle = (groupId: string) => {
    const group = TOOL_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    // MCP tools 그룹인데 활성화된 MCP 서버가 없으면 경고
    if (group.requiresMcp && activeMcpServers.length === 0) {
      alert(
        'MCP tools를 사용하려면 프로젝트에 MCP config가 필요합니다.\n.claude/.mcp-dev.json 파일을 확인하세요.',
      );
      return;
    }

    if (selectedGroups.includes(groupId)) {
      // 그룹 해제: 해당 그룹의 도구들 제거
      const toolsToRemove = new Set(group.tools);
      const newTools = selectedTools.filter((t) => !toolsToRemove.has(t));
      onToolsChange(newTools);
    } else {
      // 그룹 선택: 해당 그룹의 도구들 추가
      if (groupId === 'all') {
        // All tools 선택: 모든 도구 추가
        const allTools = getAllTools();
        onToolsChange(allTools);
      } else {
        // 특정 그룹 선택: 해당 그룹의 도구들 추가
        const newTools = [...new Set([...selectedTools, ...group.tools])];
        onToolsChange(newTools);
      }
    }
  };

  const handleIndividualToolToggle = (tool: string) => {
    // MCP 도구인데 서버가 활성화되지 않았으면 경고
    if (tool.startsWith('mcp__')) {
      const serverName = tool.split('__')[1];
      if (!activeMcpServers.includes(serverName)) {
        alert(`${serverName} MCP 서버가 활성화되지 않았습니다.\nMCP config를 확인하세요.`);
        return;
      }
    }

    if (selectedTools.includes(tool)) {
      onToolsChange(selectedTools.filter((t) => t !== tool));
    } else {
      onToolsChange([...selectedTools, tool]);
    }
  };

  // 모든 도구 목록 (MCP 도구 포함)
  const allTools = getAllTools();
  const regularTools = allTools.filter((t) => !t.startsWith('mcp__'));
  const mcpTools = allTools.filter((t) => t.startsWith('mcp__'));

  // 그룹별 체크 상태 계산
  const getGroupCheckState = (group: ToolGroup): 'checked' | 'indeterminate' | 'unchecked' => {
    if (group.id === 'all') {
      const allToolsCount = getAllTools().length;
      const selectedCount = selectedTools.length;
      if (selectedCount === 0) return 'unchecked';
      if (selectedCount === allToolsCount) return 'checked';
      return 'indeterminate';
    }

    const groupToolsCount = group.tools.length;
    const selectedInGroup = group.tools.filter((t) => selectedTools.includes(t)).length;

    if (selectedInGroup === 0) return 'unchecked';
    if (selectedInGroup === groupToolsCount) return 'checked';
    return 'indeterminate';
  };

  return (
    <div className={styles.toolSelector}>
      <h3>Allowed Tools</h3>

      {/* Quick Select: Tool Groups */}
      <div className={styles.section}>
        <h4>Quick Select:</h4>
        <div className={styles.groupList}>
          {TOOL_GROUPS.map((group) => {
            const checkState = getGroupCheckState(group);
            return (
              <label key={group.id} className={styles.groupItem}>
                <input
                  type="checkbox"
                  checked={checkState === 'checked'}
                  ref={(input) => {
                    if (input) {
                      input.indeterminate = checkState === 'indeterminate';
                    }
                  }}
                  onChange={() => handleGroupToggle(group.id)}
                />
                <span className={styles.groupName}>
                  {group.name}
                  {group.requiresMcp && <span className={styles.mcpWarning}> ⚠️ MCP 필요</span>}
                </span>
                <span className={styles.groupDescription}>{group.description}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className={styles.divider}></div>

      {/* Individual Tools: Non-MCP */}
      <div className={styles.section}>
        <h4>Individual Tools:</h4>
        <div className={styles.toolGrid}>
          {regularTools.map((tool) => (
            <label key={tool} className={styles.toolItem}>
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

      {/* MCP Tools */}
      <div className={styles.section}>
        <h4>MCP Tools (⚠️ MCP config 필요):</h4>
        <div className={styles.toolGrid}>
          {mcpTools.map((tool) => {
            const serverName = tool.split('__')[1];
            const isAvailable = activeMcpServers.includes(serverName);
            return (
              <label
                key={tool}
                className={`${styles.toolItem} ${!isAvailable ? styles.disabled : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedTools.includes(tool)}
                  onChange={() => handleIndividualToolToggle(tool)}
                  disabled={!isAvailable}
                />
                {tool}
                {!isAvailable && <span className={styles.unavailable}> (비활성화)</span>}
              </label>
            );
          })}
        </div>
      </div>

      {/* MCP Configuration Info */}
      <div className={styles.mcpInfo}>
        <h4>MCP Configuration</h4>
        {activeMcpServers.length > 0 ? (
          <>
            <p>활성화된 MCP 서버:</p>
            <ul>
              {activeMcpServers.map((server) => (
                <li key={server}>{server}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.warning}>
            ℹ️ MCP 서버가 활성화되지 않았습니다. MCP tools를 사용하려면 .claude/.mcp-*.json 파일을
            설정하세요.
          </p>
        )}
      </div>
    </div>
  );
}
