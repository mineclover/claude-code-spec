import { useState } from 'react';
import type { MaintenanceRegistryDraft } from '../../hooks/useMaintenanceRegistryDraft';
import type { RegistryTemplateAction } from '../../hooks/useMaintenanceRegistryEditor';
import type { MaintenanceRegistryFormErrors } from '../../lib/maintenanceRegistryForm';
import styles from '../../pages/SkillsPage.module.css';
import type {
  MaintenanceRegistryCommand,
  MaintenanceRegistryDocument,
  MaintenanceRegistryService,
  MaintenanceRegistryTool,
} from '../../types/maintenance-registry';
import { JsonCodeEditor } from '../common/JsonCodeEditor';

type Message = { type: 'success' | 'error'; text: string } | null;
type EditorMode = 'form' | 'json';

interface SkillsRegistrySectionProps {
  maintenanceRegistryJson: string;
  setMaintenanceRegistryJson: (value: string) => void;
  draft: MaintenanceRegistryDraft;
  formDocument: MaintenanceRegistryDocument;
  formErrors: MaintenanceRegistryFormErrors;
  canEditForm: boolean;
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
  onAddService: () => void;
  onUpdateService: (serviceIndex: number, service: MaintenanceRegistryService) => void;
  onDeleteService: (serviceIndex: number) => void;
  onEnsureServiceTool: (serviceIndex: number) => void;
}

function parseCommandInput(input: string): MaintenanceRegistryCommand {
  const tokens = input
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length === 0) {
    return { command: '' };
  }
  if (tokens.length === 1) {
    return { command: tokens[0] };
  }
  return { command: tokens[0], args: tokens.slice(1) };
}

function commandToInput(command: MaintenanceRegistryCommand | undefined): string {
  if (!command) {
    return '';
  }
  const args = command.args ?? [];
  return [command.command, ...args].join(' ').trim();
}

function createDefaultTool(service: MaintenanceRegistryService): MaintenanceRegistryTool {
  const serviceId = service.id?.trim() || 'new-service';
  return {
    id: serviceId,
    name: service.name?.trim() || serviceId,
    versionCommand: { command: serviceId, args: ['--version'] },
    updateCommand: { command: 'npm', args: ['install', '-g', `${serviceId}@latest`] },
  };
}

function getServiceFieldErrors(
  formErrors: MaintenanceRegistryFormErrors,
  serviceIndex: number,
  fieldPath: string,
): string[] {
  const serviceErrors = formErrors.services[serviceIndex];
  if (!serviceErrors) {
    return [];
  }
  const messages: string[] = [];
  for (const [path, issues] of Object.entries(serviceErrors.fields)) {
    if (
      path === fieldPath ||
      path.startsWith(`${fieldPath}.`) ||
      path.startsWith(`${fieldPath}[`)
    ) {
      for (const issue of issues) {
        if (!messages.includes(issue)) {
          messages.push(issue);
        }
      }
    }
  }
  return messages;
}

export function SkillsRegistrySection({
  maintenanceRegistryJson,
  setMaintenanceRegistryJson,
  draft,
  formDocument,
  formErrors,
  canEditForm,
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
  onAddService,
  onUpdateService,
  onDeleteService,
  onEnsureServiceTool,
}: SkillsRegistrySectionProps) {
  const [editorMode, setEditorMode] = useState<EditorMode>('form');
  const draftStatus = draft.status;

  return (
    <div className={styles.settingItem}>
      <div className={styles.settingLabel}>Maintenance Service Registry</div>
      <div className={styles.settingDescription}>
        Configure additional CLI/skill providers inside app settings (versioned JSON document).
      </div>
      <div className={styles.settingDescription}>
        Standard templates and rules: <code>references/maintenance-services.md</code>
      </div>
      <div className={styles.inlineActions}>
        <button
          type="button"
          onClick={() => setEditorMode('form')}
          className={styles.toggleButton}
          aria-pressed={editorMode === 'form'}
        >
          Form Editor
        </button>
        <button
          type="button"
          onClick={() => setEditorMode('json')}
          className={styles.toggleButton}
          aria-pressed={editorMode === 'json'}
        >
          JSON Editor
        </button>
      </div>
      {editorMode === 'form' ? (
        <div className={styles.registryFormWrap}>
          {!canEditForm && (
            <div className={styles.registryFormHint}>
              Fix JSON parse errors first. Form mode is available after JSON becomes parseable.
            </div>
          )}
          {formErrors.global.length > 0 && (
            <div className={styles.registryErrorList}>
              {formErrors.global.map((error) => (
                <div key={error}>{error}</div>
              ))}
            </div>
          )}
          <div className={styles.inlineActions}>
            <button
              type="button"
              onClick={onAddService}
              className={styles.browseButton}
              disabled={!canEditForm}
            >
              Add Service
            </button>
          </div>
          {formDocument.services.length === 0 && (
            <div className={styles.registryFormHint}>No services yet. Add one from form mode.</div>
          )}
          <div className={styles.registryServiceList}>
            {formDocument.services.map((service, serviceIndex) => {
              const primaryTool = service.tools?.[0];
              const serviceRootErrors = formErrors.services[serviceIndex]?.root ?? [];
              const idErrors = getServiceFieldErrors(formErrors, serviceIndex, 'id');
              const nameErrors = getServiceFieldErrors(formErrors, serviceIndex, 'name');
              const toolIdErrors = getServiceFieldErrors(formErrors, serviceIndex, 'tools[0].id');
              const toolNameErrors = getServiceFieldErrors(
                formErrors,
                serviceIndex,
                'tools[0].name',
              );
              const versionCommandErrors = getServiceFieldErrors(
                formErrors,
                serviceIndex,
                'tools[0].versionCommand',
              );
              const updateCommandErrors = getServiceFieldErrors(
                formErrors,
                serviceIndex,
                'tools[0].updateCommand',
              );

              const patchService = (patch: Partial<MaintenanceRegistryService>) => {
                onUpdateService(serviceIndex, {
                  ...service,
                  ...patch,
                });
              };

              const patchPrimaryTool = (patch: Partial<MaintenanceRegistryTool>) => {
                const nextTools = [...(service.tools ?? [])];
                const currentTool = nextTools[0] ?? createDefaultTool(service);
                nextTools[0] = {
                  ...currentTool,
                  ...patch,
                };
                onUpdateService(serviceIndex, {
                  ...service,
                  tools: nextTools,
                });
              };

              const serviceKey = service.id || service.name || primaryTool?.id || 'service-unnamed';

              return (
                <div key={serviceKey} className={styles.registryServiceCard}>
                  <div className={styles.registryServiceHeader}>
                    <div className={styles.toolName}>Service #{serviceIndex + 1}</div>
                    <button
                      type="button"
                      onClick={() => onDeleteService(serviceIndex)}
                      className={styles.browseButton}
                      disabled={!canEditForm}
                    >
                      Delete
                    </button>
                  </div>
                  {serviceRootErrors.length > 0 && (
                    <div className={styles.registryInlineError}>
                      {serviceRootErrors.map((error) => (
                        <div key={`${serviceIndex}-${error}`}>{error}</div>
                      ))}
                    </div>
                  )}
                  <div className={styles.registryFieldGrid}>
                    <label className={styles.registryField}>
                      <span className={styles.registryFieldLabel}>Service ID</span>
                      <input
                        value={service.id ?? ''}
                        onChange={(event) => patchService({ id: event.target.value })}
                        disabled={!canEditForm}
                        className={styles.registryInput}
                      />
                      {idErrors.map((error) => (
                        <span
                          key={`service-${serviceIndex}-id-${error}`}
                          className={styles.registryFieldError}
                        >
                          {error}
                        </span>
                      ))}
                    </label>
                    <label className={styles.registryField}>
                      <span className={styles.registryFieldLabel}>Display Name</span>
                      <input
                        value={service.name ?? ''}
                        onChange={(event) => patchService({ name: event.target.value })}
                        disabled={!canEditForm}
                        className={styles.registryInput}
                      />
                      {nameErrors.map((error) => (
                        <span
                          key={`service-${serviceIndex}-name-${error}`}
                          className={styles.registryFieldError}
                        >
                          {error}
                        </span>
                      ))}
                    </label>
                  </div>
                  <label className={styles.registryCheckboxRow}>
                    <input
                      type="checkbox"
                      checked={service.enabled ?? true}
                      onChange={(event) => patchService({ enabled: event.target.checked })}
                      disabled={!canEditForm}
                    />
                    <span>Enabled</span>
                  </label>
                  {!primaryTool && (
                    <div className={styles.inlineActions}>
                      <button
                        type="button"
                        onClick={() => onEnsureServiceTool(serviceIndex)}
                        className={styles.browseButton}
                        disabled={!canEditForm}
                      >
                        Add Tool Contract
                      </button>
                    </div>
                  )}
                  {primaryTool && (
                    <div className={styles.registryToolBlock}>
                      <div className={styles.registryFieldGrid}>
                        <label className={styles.registryField}>
                          <span className={styles.registryFieldLabel}>Tool ID</span>
                          <input
                            value={primaryTool.id ?? ''}
                            onChange={(event) => patchPrimaryTool({ id: event.target.value })}
                            disabled={!canEditForm}
                            className={styles.registryInput}
                          />
                          {toolIdErrors.map((error) => (
                            <span
                              key={`service-${serviceIndex}-tool-id-${error}`}
                              className={styles.registryFieldError}
                            >
                              {error}
                            </span>
                          ))}
                        </label>
                        <label className={styles.registryField}>
                          <span className={styles.registryFieldLabel}>Tool Name</span>
                          <input
                            value={primaryTool.name ?? ''}
                            onChange={(event) => patchPrimaryTool({ name: event.target.value })}
                            disabled={!canEditForm}
                            className={styles.registryInput}
                          />
                          {toolNameErrors.map((error) => (
                            <span
                              key={`service-${serviceIndex}-tool-name-${error}`}
                              className={styles.registryFieldError}
                            >
                              {error}
                            </span>
                          ))}
                        </label>
                      </div>
                      <div className={styles.registryFieldGrid}>
                        <label className={styles.registryField}>
                          <span className={styles.registryFieldLabel}>Version Command</span>
                          <input
                            value={commandToInput(primaryTool.versionCommand)}
                            onChange={(event) =>
                              patchPrimaryTool({
                                versionCommand: parseCommandInput(event.target.value),
                              })
                            }
                            disabled={!canEditForm}
                            className={styles.registryInput}
                          />
                          {versionCommandErrors.map((error) => (
                            <span
                              key={`service-${serviceIndex}-version-command-${error}`}
                              className={styles.registryFieldError}
                            >
                              {error}
                            </span>
                          ))}
                        </label>
                        <label className={styles.registryField}>
                          <span className={styles.registryFieldLabel}>Update Command</span>
                          <input
                            value={commandToInput(primaryTool.updateCommand)}
                            onChange={(event) =>
                              patchPrimaryTool({
                                updateCommand: parseCommandInput(event.target.value),
                              })
                            }
                            disabled={!canEditForm}
                            className={styles.registryInput}
                          />
                          {updateCommandErrors.map((error) => (
                            <span
                              key={`service-${serviceIndex}-update-command-${error}`}
                              className={styles.registryFieldError}
                            >
                              {error}
                            </span>
                          ))}
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.codeEditorWrap}>
          <JsonCodeEditor
            value={maintenanceRegistryJson}
            onChange={setMaintenanceRegistryJson}
            diagnostics={draft.diagnostics}
            minHeight={280}
          />
        </div>
      )}
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
