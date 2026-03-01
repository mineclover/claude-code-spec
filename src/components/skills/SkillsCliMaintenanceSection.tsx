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

function buildStatusLine(info?: CliToolVersionInfo): { label: string; ok: boolean } {
  if (!info) return { label: 'Not checked', ok: false };
  if (info.status === 'ok') {
    const parts: string[] = [];
    if (info.version) parts.push(info.version);
    if (info.latestVersion && info.latestVersion !== info.version)
      parts.push(`→ ${info.latestVersion} available`);
    return { label: parts.length > 0 ? parts.join('  ') : 'Installed', ok: true };
  }
  if (info.status === 'missing') return { label: 'Not installed', ok: false };
  return { label: `Error${info.error ? `: ${info.error}` : ''}`, ok: false };
}

function buildUpdateBadge(info?: CliToolVersionInfo): {
  label: string;
  needsUpdate: boolean;
} {
  if (!info) return { label: 'Check required', needsUpdate: false };
  if (!info.updateRequired) return { label: 'Up to date', needsUpdate: false };
  if (info.status === 'missing') return { label: 'Install required', needsUpdate: true };
  if (info.updateReason === 'outdated' && info.latestVersion)
    return { label: `Update to ${info.latestVersion}`, needsUpdate: true };
  if (info.updateReason === 'version-check-error')
    return { label: 'Check failed — update recommended', needsUpdate: true };
  return { label: 'Update required', needsUpdate: true };
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
        Check versions, select tools that need updates, and run batch updates.
      </div>

      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={onCheckVersions}
          className={styles.browseButton}
          disabled={isCheckingVersions || isBatchUpdating}
        >
          {isCheckingVersions ? 'Checking…' : 'Check Versions'}
        </button>
        <button
          type="button"
          onClick={onSelectToolsNeedingUpdate}
          className={styles.browseButton}
          disabled={isCheckingVersions || isBatchUpdating}
        >
          Select Needs Update
        </button>
        <button
          type="button"
          onClick={onClearToolSelection}
          className={styles.browseButton}
          disabled={selectedToolCount === 0 || isBatchUpdating}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onRunSelectedUpdates}
          className={styles.saveButton}
          disabled={selectedToolCount === 0 || isBatchUpdating || updatingToolId !== null}
        >
          {isBatchUpdating
            ? 'Updating…'
            : selectedToolCount > 0
              ? `Update Selected (${selectedToolCount})`
              : 'Update Selected'}
        </button>
      </div>

      <div className={styles.toolGrid}>
        {maintenanceTools.map((tool) => {
          const info = toolVersions[tool.id];
          const { label: statusLabel, ok: statusOk } = buildStatusLine(info);
          const { label: badgeLabel, needsUpdate } = buildUpdateBadge(info);
          const selected = selectedToolIds.includes(tool.id);
          const isUpdatingThis = updatingToolId === tool.id;
          const disabled = isBatchUpdating || updatingToolId !== null;

          return (
            <div
              key={tool.id}
              className={`${styles.toolCard} ${selected ? styles.toolCardSelected : ''}`}
              onClick={() => !disabled && onToggleToolSelection(tool.id)}
              tabIndex={disabled ? -1 : 0}
              onKeyDown={(e) => {
                if (!disabled && (e.key === ' ' || e.key === 'Enter')) {
                  e.preventDefault();
                  onToggleToolSelection(tool.id);
                }
              }}
            >
              {/* Header row: checkbox + name + update button */}
              <div className={styles.toolCardHeader}>
                <div className={styles.toolCardMeta}>
                  <input
                    type="checkbox"
                    className={styles.toolCheckbox}
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggleToolSelection(tool.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select ${tool.name}`}
                  />
                  <div>
                    <div className={styles.toolName}>{tool.name}</div>
                    <div className={styles.toolId}>{tool.id}</div>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.toggleButton}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRunToolUpdate(tool.id);
                  }}
                  disabled={disabled}
                  title="Run update for this tool only"
                >
                  {isUpdatingThis ? 'Updating…' : 'Update'}
                </button>
              </div>

              {/* Status line */}
              <div className={statusOk ? styles.toolStatusOk : styles.toolStatusError}>
                {statusLabel}
              </div>

              {/* Update badge */}
              <div
                className={needsUpdate ? styles.updateRequiredBadge : styles.updateNotRequiredBadge}
              >
                {badgeLabel}
              </div>

              {/* Commands — collapsed by default */}
              <details className={styles.toolCommandsDetails}>
                <summary className={styles.toolCommandsSummary}>Commands</summary>
                <div className={styles.toolCommands}>
                  <div>
                    <strong>Version:</strong>{' '}
                    {[tool.versionCommand.command, ...tool.versionCommand.args].join(' ')}
                  </div>
                  <div>
                    <strong>Update:</strong>{' '}
                    {[tool.updateCommand.command, ...tool.updateCommand.args].join(' ')}
                  </div>
                  {info?.rawOutput && (
                    <div>
                      <strong>Output:</strong> {info.rawOutput}
                    </div>
                  )}
                </div>
              </details>
            </div>
          );
        })}
      </div>

      {lastBatchSummary && (
        <div className={styles.updateSummary}>
          <strong>Last batch:</strong> {lastBatchSummary.succeeded}/{lastBatchSummary.total}{' '}
          succeeded, {lastBatchSummary.failed} failed.
        </div>
      )}

      {/* Update logs */}
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
