import { useEffect, useId, useState } from 'react';
import type { AgentListItem } from '../../types/agent';
import styles from './AgentSelector.module.css';

interface AgentSelectorProps {
  projectPath: string;
  selectedAgent: string;
  onAgentChange: (agentName: string) => void;
}

export function AgentSelector({ projectPath, selectedAgent, onAgentChange }: AgentSelectorProps) {
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadAgents() {
      if (!projectPath) return;

      setLoading(true);
      try {
        const agentsList = await window.agentAPI.listAgents(projectPath);
        setAgents(agentsList);
      } catch (error) {
        console.error('Failed to load agents:', error);
        setAgents([]);
      } finally {
        setLoading(false);
      }
    }

    loadAgents();
  }, [projectPath]);

  // Separate agents by source
  const projectAgents = agents.filter((a) => a.source === 'project');
  const userAgents = agents.filter((a) => a.source === 'user');

  const agentSelectId = useId();

  return (
    <div className={styles.agentSelector}>
      <label htmlFor={agentSelectId} className={styles.label}>
        Assigned Agent:
      </label>
      <select
        id={agentSelectId}
        className={styles.select}
        value={selectedAgent}
        onChange={(e) => onAgentChange(e.target.value)}
        disabled={loading}
      >
        {/* Default options */}
        <option value="claude-sonnet-4">claude-sonnet-4 (Default)</option>
        <option value="claude-opus-4">claude-opus-4</option>
        <option value="claude-haiku-4">claude-haiku-4</option>

        {/* Project agents */}
        {projectAgents.length > 0 && (
          <optgroup label="Project Agents">
            {projectAgents.map((agent) => (
              <option key={`project-${agent.name}`} value={agent.name}>
                {agent.name} - {agent.description}
              </option>
            ))}
          </optgroup>
        )}

        {/* User agents */}
        {userAgents.length > 0 && (
          <optgroup label="User Agents">
            {userAgents.map((agent) => (
              <option key={`user-${agent.name}`} value={agent.name}>
                {agent.name} - {agent.description}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      {loading && <span className={styles.loading}>Loading agents...</span>}

      {/* Agent info display */}
      {selectedAgent && agents.length > 0 && (
        <div className={styles.agentInfo}>
          {(() => {
            const agent = agents.find((a) => a.name === selectedAgent);
            if (!agent) return null;

            return (
              <div className={styles.infoContent}>
                <div className={styles.infoItem}>
                  <strong>Description:</strong> {agent.description}
                </div>
                {agent.allowedToolsCount !== undefined && (
                  <div className={styles.infoItem}>
                    <strong>Tools:</strong> {agent.allowedToolsCount} allowed
                  </div>
                )}
                {agent.hasPermissions && (
                  <div className={styles.infoItem}>
                    <strong>Permissions:</strong> Custom permissions configured
                  </div>
                )}
                <div className={styles.infoItem}>
                  <strong>Source:</strong> {agent.source === 'project' ? 'Project' : 'User'}
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
