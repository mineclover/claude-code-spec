import type React from 'react';
import type { SystemInitEvent as SystemInitEventType } from '../../../lib/types';
import { EventBox } from '../common/EventBox';
import styles from './SystemInitEvent.module.css';

interface SystemInitEventProps {
  event: SystemInitEventType;
}

export const SystemInitEvent: React.FC<SystemInitEventProps> = ({ event }) => {
  return (
    <EventBox type="system" icon="🔧" title="System Initialized">
      <div className={styles.grid}>
        <div className={styles.item}>
          <span className={styles.label}>Session:</span>
          <span className={styles.value}>{event.session_id}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>Model:</span>
          <span className={styles.value}>{event.model}</span>
        </div>
        <div className={styles.item}>
          <span className={styles.label}>CWD:</span>
          <span className={styles.valueMono}>{event.cwd}</span>
        </div>
        {event.tools.length > 0 && (
          <div className={styles.item}>
            <span className={styles.label}>Tools:</span>
            <span className={styles.value}>{event.tools.join(', ')}</span>
          </div>
        )}
        {event.mcp_servers.length > 0 && (
          <div className={styles.item}>
            <span className={styles.label}>MCP Servers:</span>
            <div className={styles.mcpServers}>
              {event.mcp_servers.map((server) => (
                <span key={`${server.name}-${server.status}`} className={styles.mcpServer}>
                  {server.name} ({server.status})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </EventBox>
  );
};
