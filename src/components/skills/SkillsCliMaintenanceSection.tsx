import styles from '../../pages/SkillsPage.module.css';
import type {
  CliToolBatchUpdateSummary,
  CliToolUpdateLogEntry,
  CliToolVersionInfo,
  ManagedCliTool,
} from '../../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

interface SkillsCliMaintenanceSectionProps {
  maintenanceTools: ManagedCliTool[];
  toolVersions: Record<string, CliToolVersionInfo>;
  updateLogs: CliToolUpdateLogEntry[];
  selectedToolIds: string[];
  selectedToolCount: number;
  isCheckingVersions: boolean;
  updatingToolId: string | null;
  isBatchUpdating: boolean;
  lastBatchSummary: CliToolBatchUpdateSummary | null;
  message: Message;
  onCheckVersions: () => void | Promise<void>;
  onRunToolUpdate: (toolId: string) => void | Promise<void>;
  onToggleToolSelection: (toolId: string) => void;
  onSelectToolsNeedingUpdate: () => void;
  onClearToolSelection: () => void;
  onRunSelectedUpdates: () => void | Promise<void>;
  onRefreshLogs: () => void | Promise<void>;
}

function buildToolStatusLabel(info?: CliToolVersionInfo): string {
  if (!info) {
    return 'Not checked';
  }
  if (info.status === 'ok') {
    if (info.version && info.latestVersion) {
      return `Installed ${info.version} / Latest ${info.latestVersion}`;
    }
    return info.version ? `Installed ${info.version}` : 'Installed';
  }
  if (info.status === 'missing') {
    return 'Not installed';
  }
  return `Error${info.error ? `: ${info.error}` : ''}`;
}

function buildUpdateNeedLabel(info?: CliToolVersionInfo): string {
  if (!info) {
    return 'Need version check';
  }
  if (!info.updateRequired) {
    return 'Up to date';
  }
  if (info.status === 'missing') {
    return 'Install required';
  }
  if (info.updateReason === 'outdated' && info.latestVersion) {
    return `Update required to ${info.latestVersion}`;
  }
  if (info.updateReason === 'version-check-error') {
    return 'Update recommended (check failed)';
  }
  return 'Update required';
}

function formatUpdateLogStatus(log: CliToolUpdateLogEntry): string {
  const exitCodeLabel = log.exitCode === null ? 'null' : String(log.exitCode);
  return `${log.success ? 'SUCCESS' : 'FAILED'} (exit ${exitCodeLabel})`;
}

export function SkillsCliMaintenanceSection({
  maintenanceTools,
  toolVersions,
  updateLogs,
  selectedToolIds,
  selectedToolCount,
  isCheckingVersions,
  updatingToolId,
  isBatchUpdating,
  lastBatchSummary,
  message,
  onCheckVersions,
  onRunToolUpdate,
  onToggleToolSelection,
  onSelectToolsNeedingUpdate,
  onClearToolSelection,
  onRunSelectedUpdates,
  onRefreshLogs,
}: SkillsCliMaintenanceSectionProps) {
  return (
    <div className={styles.settingItem}>
      <div className={styles.settingLabel}>CLI Update Planner</div>
      <div className={styles.settingDescription}>
        Check versions, mark tools that need updates, run selected updates in batch, and inspect
        execution logs.
      </div>
      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={onCheckVersions}
          className={styles.browseButton}
          disabled={isCheckingVersions || isBatchUpdating}
        >
          {isCheckingVersions ? 'Checking...' : 'Check Versions'}
        </button>
        <button
          type="button"
          onClick={onSelectToolsNeedingUpdate}
          className={styles.browseButton}
          disabled={isBatchUpdating}
        >
          Select Needs Update
        </button>
        <button
          type="button"
          onClick={onClearToolSelection}
          className={styles.browseButton}
          disabled={selectedToolCount === 0 || isBatchUpdating}
        >
          Clear Selection
        </button>
        <button
          type="button"
          onClick={onRunSelectedUpdates}
          className={styles.saveButton}
          disabled={selectedToolCount === 0 || isBatchUpdating || updatingToolId !== null}
        >
          {isBatchUpdating ? 'Updating Selected...' : `Update Selected (${selectedToolCount})`}
        </button>
      </div>

      <div className={styles.toolGrid}>
        {maintenanceTools.map((tool) => {
          const info = toolVersions[tool.id];
          const statusLabel = buildToolStatusLabel(info);
          const updateNeedLabel = buildUpdateNeedLabel(info);
          const selected = selectedToolIds.includes(tool.id);

          return (
            <div key={tool.id} className={styles.toolCard}>
              <div className={styles.toolCardHeader}>
                <label className={styles.toolSelectionLabel}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={isBatchUpdating}
                    onChange={() => onToggleToolSelection(tool.id)}
                  />
                  <div>
                    <div className={styles.toolName}>{tool.name}</div>
                    <div className={styles.toolId}>{tool.id}</div>
                  </div>
                </label>
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={() => onRunToolUpdate(tool.id)}
                  disabled={updatingToolId !== null || isBatchUpdating}
                >
                  {updatingToolId === tool.id ? 'Updating...' : 'Update'}
                </button>
              </div>
              <div className={styles.toolStatus}>{statusLabel}</div>
              <div
                className={
                  info?.updateRequired ? styles.updateRequiredBadge : styles.updateNotRequiredBadge
                }
              >
                {updateNeedLabel}
              </div>
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

      {lastBatchSummary && (
        <div className={styles.updateSummary}>
          <strong>Last batch summary:</strong> {lastBatchSummary.succeeded}/{lastBatchSummary.total}{' '}
          succeeded, {lastBatchSummary.failed} failed.
        </div>
      )}

      <div className={styles.activationEventsSection}>
        <div className={styles.settingLabel}>Recent Update Logs</div>
        <div className={styles.inlineActions}>
          <button
            type="button"
            className={styles.browseButton}
            onClick={onRefreshLogs}
            disabled={isBatchUpdating}
          >
            Refresh Logs
          </button>
        </div>
        <div className={styles.activationEventList}>
          {updateLogs.length === 0 ? (
            <div className={styles.emptyPaths}>No update logs yet.</div>
          ) : (
            updateLogs.map((log) => (
              <details key={log.logId} className={styles.activationEventRow}>
                <summary>
                  <strong>{log.toolId}</strong> {formatUpdateLogStatus(log)}
                </summary>
                <div className={styles.toolCommands}>
                  <div>
                    <strong>Command:</strong> {log.command.join(' ')}
                  </div>
                  <div>
                    <strong>Batch:</strong> {log.batchId ?? 'single'}
                  </div>
                  {log.stdout ? (
                    <div>
                      <strong>stdout:</strong> {log.stdout}
                    </div>
                  ) : null}
                  {log.stderr ? (
                    <div>
                      <strong>stderr:</strong> {log.stderr}
                    </div>
                  ) : null}
                </div>
              </details>
            ))
          )}
        </div>
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}
    </div>
  );
}
