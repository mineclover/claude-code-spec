import type React from 'react';
import type { SystemInitEvent as SystemInitEventType } from '@context-action/code-api';
import { EventBox } from '../common/EventBox';
import styles from './SystemInitEvent.module.css';

interface SystemInitEventProps {
  event: SystemInitEventType;
}

export const SystemInitEvent: React.FC<SystemInitEventProps> = ({ event }) => {
  // Separate MCP and built-in tools
  const mcpTools = event.tools.filter((tool) => tool.startsWith('mcp__'));
  const builtInTools = event.tools.filter((tool) => !tool.startsWith('mcp__'));

  // Group MCP tools by server
  const mcpToolsByServer = mcpTools.reduce(
    (acc, tool) => {
      const match = tool.match(/^mcp__([^_]+)__(.+)$/);
      if (match) {
        const [, serverName, toolName] = match;
        if (!acc[serverName]) acc[serverName] = [];
        acc[serverName].push(toolName);
      }
      return acc;
    },
    {} as Record<string, string[]>,
  );

  return (
    <EventBox
      type="system"
      icon="🔧"
      title="System Initialized"
      rawData={event}
      isSidechain={event.isSidechain}
    >
      <div className={styles.grid}>
        <div className={styles.item}>
          <span className={styles.label}>Session ID:</span>
          <span className={styles.valueMono}>{event.session_id}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Model:</span>
          <span className={styles.value}>{event.model}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Working Directory:</span>
          <span className={styles.valueMono}>{event.cwd}</span>
        </div>

        {/* Built-in Tools */}
        {builtInTools.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>Built-in Tools ({builtInTools.length})</div>
            <div className={styles.toolsList}>
              {builtInTools.map((tool) => (
                <span key={tool} className={styles.tool}>
                  {tool}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* MCP Servers */}
        {event.mcp_servers.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>MCP Servers ({event.mcp_servers.length})</div>
            <div className={styles.mcpServers}>
              {event.mcp_servers.map((server) => {
                const serverTools = mcpToolsByServer[server.name] || [];
                return (
                  <details key={`${server.name}-${server.status}`} className={styles.mcpServer}>
                    <summary className={styles.mcpServerSummary}>
                      <span className={styles.mcpServerName}>{server.name}</span>
                      <span
                        className={`${styles.mcpStatus} ${server.status === 'connected' ? styles.connected : styles.disconnected}`}
                      >
                        {server.status}
                      </span>
                      <span className={styles.mcpToolCount}>
                        {serverTools.length} {serverTools.length === 1 ? 'tool' : 'tools'}
                      </span>
                    </summary>
                    {serverTools.length > 0 && (
                      <div className={styles.toolsList}>
                        {serverTools.map((tool) => (
                          <span key={tool} className={styles.tool}>
                            {tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {/* Slash Commands */}
        {'slash_commands' in event && event.slash_commands && event.slash_commands.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionTitle}>
              Slash Commands ({event.slash_commands.length})
            </div>
            <div className={styles.toolsList}>
              {event.slash_commands.map((cmd) => (
                <span key={cmd} className={styles.tool}>
                  /{cmd}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Additional Info */}
        <div className={styles.metaInfo}>
          <span>Permission Mode: {event.permissionMode}</span>
          {'apiKeySource' in event && <span>API Key: {event.apiKeySource}</span>}
          {'output_style' in event && <span>Output Style: {event.output_style}</span>}
        </div>
      </div>
    </EventBox>
  );
};
