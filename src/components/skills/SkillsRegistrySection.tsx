import type { MaintenanceRegistryDraft } from '../../hooks/useMaintenanceRegistryDraft';
import type { RegistryTemplateAction } from '../../hooks/useMaintenanceRegistryEditor';
import styles from '../../pages/SkillsPage.module.css';
import type { MaintenanceRegistryService } from '../../types/maintenance-registry';
import { JsonCodeEditor } from '../common/JsonCodeEditor';

type Message = { type: 'success' | 'error'; text: string } | null;

interface SkillsRegistrySectionProps {
  maintenanceRegistryJson: string;
  setMaintenanceRegistryJson: (value: string) => void;
  draft: MaintenanceRegistryDraft;
  visibleErrors: string[];
  isSaving: boolean;
  message: Message;
  templateActions: RegistryTemplateAction[];
  onSave: () => void | Promise<void>;
  onReload: () => void | Promise<void>;
  onFormat: () => void;
  onUseExample: () => void;
  onClear: () => void;
  onAppendTemplate: (template: MaintenanceRegistryService) => void;
}

export function SkillsRegistrySection({
  maintenanceRegistryJson,
  setMaintenanceRegistryJson,
  draft,
  visibleErrors,
  isSaving,
  message,
  templateActions,
  onSave,
  onReload,
  onFormat,
  onUseExample,
  onClear,
  onAppendTemplate,
}: SkillsRegistrySectionProps) {
  const draftStatus = draft.status;

  return (
    <div className={styles.settingItem}>
      <div className={styles.settingLabel}>Maintenance Service Registry</div>
      <div className={styles.settingDescription}>
        Configure additional CLI/skill providers inside app settings (JSON array).
      </div>
      <div className={styles.settingDescription}>
        Standard templates and rules: <code>references/maintenance-services.md</code>
      </div>
      <div className={styles.codeEditorWrap}>
        <JsonCodeEditor
          value={maintenanceRegistryJson}
          onChange={setMaintenanceRegistryJson}
          diagnostics={draft.diagnostics}
          minHeight={280}
        />
      </div>
      <div className={styles.registryValidation}>
        <div className={draftStatus.valid ? styles.registryValidBadge : styles.registryErrorBadge}>
          {draftStatus.valid
            ? `Draft valid (${draftStatus.serviceCount} services)`
            : `Draft invalid (${draftStatus.errors.length} issues)`}
        </div>
        {!draftStatus.valid && (
          <div className={styles.registryErrorList}>
            {visibleErrors.map((error) => (
              <div key={error}>{error}</div>
            ))}
            {draftStatus.errors.length > 6 && <div>... {draftStatus.errors.length - 6} more</div>}
          </div>
        )}
      </div>
      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={onSave}
          className={styles.saveButton}
          disabled={isSaving || !draftStatus.valid}
        >
          {isSaving ? 'Saving...' : 'Save Registry'}
        </button>
        <button type="button" onClick={onReload} className={styles.browseButton}>
          Reload
        </button>
        <button type="button" onClick={onFormat} className={styles.browseButton}>
          Format JSON
        </button>
        <button type="button" onClick={onUseExample} className={styles.browseButton}>
          Use Example
        </button>
        <button type="button" onClick={onClear} className={styles.browseButton}>
          Clear
        </button>
      </div>
      <div className={styles.inlineActions}>
        {templateActions.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAppendTemplate(action.template)}
            className={styles.browseButton}
          >
            {action.label}
          </button>
        ))}
      </div>
      {message && (
        <div className={message.type === 'success' ? styles.successMessage : styles.errorMessage}>
          {message.text}
        </div>
      )}
    </div>
  );
}
