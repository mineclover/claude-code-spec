import { formatSkillVersionHint } from '../../lib/skillVersionResolver';
import styles from '../../pages/SkillsPage.module.css';
import type {
  InstalledSkillInfo,
  SkillActivationAuditEvent,
  SkillInstallPathInfo,
} from '../../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

interface SkillsInstalledSectionProps {
  skillInstallPaths: SkillInstallPathInfo[];
  installedSkills: InstalledSkillInfo[];
  activationEvents: SkillActivationAuditEvent[];
  isSkillsLoading: boolean;
  togglingSkillKey: string | null;
  message: Message;
  onRefresh: () => void | Promise<void>;
  onToggleSkillActivation: (skill: InstalledSkillInfo) => void | Promise<void>;
}

export function SkillsInstalledSection({
  skillInstallPaths,
  installedSkills,
  activationEvents,
  isSkillsLoading,
  togglingSkillKey,
  message,
  onRefresh,
  onToggleSkillActivation,
}: SkillsInstalledSectionProps) {
  const formatActivationEventTime = (timestamp: number): string => {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return 'Unknown time';
    }
    return new Date(timestamp).toLocaleString();
  };

  const formatActivationState = (active: boolean): string => (active ? 'active' : 'inactive');

  return (
    <div className={styles.settingItem}>
      <div className={styles.settingLabel}>Installed Skills</div>
      <div className={styles.settingDescription}>
        Local skills inventory from configured service adapters (active + disabled roots).
      </div>
      {skillInstallPaths.length > 0 && (
        <div className={styles.pathReferenceList}>
          {skillInstallPaths.map((item) => (
            <div key={item.provider} className={styles.pathReferenceItem}>
              <div className={styles.skillMeta}>
                {item.provider} active: <code>{item.installRoot}</code>
              </div>
              <div className={styles.skillMeta}>
                {item.provider} disabled: <code>{item.disabledRoot}</code>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={onRefresh}
          className={styles.browseButton}
          disabled={isSkillsLoading}
        >
          {isSkillsLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {installedSkills.length > 0 ? (
        <div className={styles.skillList}>
          {installedSkills.map((skill) => (
            <div key={skill.path} className={styles.skillRow}>
              <div className={styles.skillMain}>
                <div className={styles.skillName}>{skill.name}</div>
                <div className={styles.skillMeta}>
                  {skill.provider} / {skill.id}
                </div>
                <div className={styles.skillPath}>{skill.path}</div>
              </div>
              <div className={styles.skillActions}>
                <div className={skill.active ? styles.statusActive : styles.statusInactive}>
                  {skill.active ? 'Active' : 'Inactive'}
                </div>
                <div className={styles.skillVersion}>
                  {`Version: ${formatSkillVersionHint(skill.versionHint)}`}
                </div>
                <button
                  type="button"
                  className={styles.toggleButton}
                  disabled={togglingSkillKey !== null || isSkillsLoading}
                  onClick={() => onToggleSkillActivation(skill)}
                >
                  {togglingSkillKey === `${skill.provider}:${skill.id}`
                    ? 'Updating...'
                    : skill.active
                      ? 'Deactivate'
                      : 'Activate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyPaths}>No installed skills found.</div>
      )}

      <div className={styles.activationEventsSection}>
        <div className={styles.settingLabel}>Recent Activation Events</div>
        <div className={styles.settingDescription}>
          Latest activation/deactivation transactions with before/after state snapshots.
        </div>
        {activationEvents.length > 0 ? (
          <div className={styles.activationEventList}>
            {activationEvents.map((event) => (
              <div
                key={`${event.provider}:${event.skillId}:${event.timestamp}`}
                className={styles.activationEventRow}
              >
                <div className={styles.skillMeta}>
                  {event.provider}/{event.skillId}
                </div>
                <div className={styles.skillMeta}>
                  {formatActivationState(event.before.active)} -&gt;{' '}
                  {formatActivationState(event.after.active)}
                </div>
                <div className={styles.skillPath}>{formatActivationEventTime(event.timestamp)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyPaths}>No activation events recorded.</div>
        )}
      </div>

      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}
    </div>
  );
}
