import styles from '../../pages/SkillsPage.module.css';
import type { CliToolVersionInfo, ManagedCliTool } from '../../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

interface SkillsCliMaintenanceSectionProps {
  maintenanceTools: ManagedCliTool[];
  toolVersions: Record<string, CliToolVersionInfo>;
  isCheckingVersions: boolean;
  updatingToolId: string | null;
  message: Message;
  onCheckVersions: () => void | Promise<void>;
  onRunToolUpdate: (toolId: string) => void | Promise<void>;
}

function buildToolStatusLabel(info?: CliToolVersionInfo): string {
  if (!info) {
    return 'Not checked';
  }
  if (info.status === 'ok') {
    return info.version || 'Detected';
  }
  if (info.status === 'missing') {
    return 'Not installed';
  }
  return `Error${info.error ? `: ${info.error}` : ''}`;
}

export function SkillsCliMaintenanceSection({
  maintenanceTools,
  toolVersions,
  isCheckingVersions,
  updatingToolId,
  message,
  onCheckVersions,
  onRunToolUpdate,
}: SkillsCliMaintenanceSectionProps) {
  return (
    <div className={styles.settingItem}>
      <div className={styles.settingLabel}>CLI Version &amp; Update</div>
      <div className={styles.settingDescription}>
        Check versions and run update commands for managed CLIs.
      </div>
      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={onCheckVersions}
          className={styles.browseButton}
          disabled={isCheckingVersions}
        >
          {isCheckingVersions ? 'Checking...' : 'Check Versions'}
        </button>
      </div>

      <div className={styles.toolGrid}>
        {maintenanceTools.map((tool) => {
          const info = toolVersions[tool.id];
          const statusLabel = buildToolStatusLabel(info);

          return (
            <div key={tool.id} className={styles.toolCard}>
              <div className={styles.toolCardHeader}>
                <div>
                  <div className={styles.toolName}>{tool.name}</div>
                  <div className={styles.toolId}>{tool.id}</div>
                </div>
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => onRunToolUpdate(tool.id)}
                  disabled={updatingToolId !== null}
                >
                  {updatingToolId === tool.id ? 'Updating...' : 'Update'}
                </button>
              </div>
              <div className={styles.toolStatus}>{statusLabel}</div>
              <div className={styles.toolCommands}>
                <div>
                  <strong>Version:</strong>{' '}
                  {[tool.versionCommand.command, ...tool.versionCommand.args].join(' ')}
                </div>
                <div>
                  <strong>Update:</strong>{' '}
                  {[tool.updateCommand.command, ...tool.updateCommand.args].join(' ')}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}
    </div>
  );
}
