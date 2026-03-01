/**
 * CLI Maintenance Page
 * Registry config + version checks + batch updates
 */

import { SkillsCliMaintenanceSection } from '../components/skills/SkillsCliMaintenanceSection';
import { SkillsRegistrySection } from '../components/skills/SkillsRegistrySection';
import { useCliMaintenance } from '../hooks/useCliMaintenance';
import { useMaintenanceRegistryEditor } from '../hooks/useMaintenanceRegistryEditor';
import styles from './SkillsPage.module.css';

export function CliMaintenancePage() {
  const {
    maintenanceTools,
    toolVersions,
    toolUpdateLogs,
    selectedToolIds,
    selectedToolCount,
    isCheckingVersions,
    updatingToolId,
    isBatchUpdating,
    lastBatchSummary,
    toolMessage,
    loadMaintenanceTools,
    checkToolVersions,
    loadToolUpdateLogs,
    toggleToolSelection,
    clearToolSelection,
    selectToolsNeedingUpdate,
    runToolUpdate,
    runSelectedToolUpdates,
  } = useCliMaintenance();

  const {
    maintenanceRegistryJson,
    setMaintenanceRegistryJson,
    isSaving: isMaintenanceRegistrySaving,
    message: maintenanceRegistryMessage,
    draft: registryDraft,
    formDocument: registryFormDocument,
    formErrors: registryFormErrors,
    canEditForm: canEditRegistryForm,
    visibleErrors: visibleRegistryErrors,
    templateActions,
    loadRegistry: loadMaintenanceRegistry,
    appendTemplate,
    addServiceViaForm,
    updateServiceViaForm,
    removeServiceViaForm,
    ensureServiceToolViaForm,
    formatRegistry: formatMaintenanceRegistry,
    useExampleRegistry,
    clearRegistry,
    saveRegistry: saveMaintenanceRegistry,
  } = useMaintenanceRegistryEditor({
    onRegistrySaved: async () => {
      await loadMaintenanceTools();
      await checkToolVersions();
    },
  });

  const showCliMaintenanceSection =
    maintenanceTools.length > 0 || isCheckingVersions || isBatchUpdating || updatingToolId !== null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>CLI Maintenance</h2>
      </div>

      <div className={styles.settingsSection}>
        <SkillsRegistrySection
          maintenanceRegistryJson={maintenanceRegistryJson}
          setMaintenanceRegistryJson={setMaintenanceRegistryJson}
          draft={registryDraft}
          formDocument={registryFormDocument}
          formErrors={registryFormErrors}
          canEditForm={canEditRegistryForm}
          visibleErrors={visibleRegistryErrors}
          isSaving={isMaintenanceRegistrySaving}
          message={maintenanceRegistryMessage}
          templateActions={templateActions}
          onSave={saveMaintenanceRegistry}
          onReload={loadMaintenanceRegistry}
          onFormat={formatMaintenanceRegistry}
          onUseExample={useExampleRegistry}
          onClear={clearRegistry}
          onAppendTemplate={appendTemplate}
          onAddService={addServiceViaForm}
          onUpdateService={updateServiceViaForm}
          onDeleteService={removeServiceViaForm}
          onEnsureServiceTool={ensureServiceToolViaForm}
        />

        {showCliMaintenanceSection ? (
          <SkillsCliMaintenanceSection
            maintenanceTools={maintenanceTools}
            toolVersions={toolVersions}
            updateLogs={toolUpdateLogs}
            selectedToolIds={selectedToolIds}
            selectedToolCount={selectedToolCount}
            isCheckingVersions={isCheckingVersions}
            updatingToolId={updatingToolId}
            isBatchUpdating={isBatchUpdating}
            lastBatchSummary={lastBatchSummary}
            message={toolMessage}
            onCheckVersions={checkToolVersions}
            onRunToolUpdate={runToolUpdate}
            onToggleToolSelection={toggleToolSelection}
            onSelectToolsNeedingUpdate={selectToolsNeedingUpdate}
            onClearToolSelection={clearToolSelection}
            onRunSelectedUpdates={runSelectedToolUpdates}
            onRefreshLogs={loadToolUpdateLogs}
          />
        ) : (
          <div className={styles.settingDescription}>
            No services expose maintenance capability, so CLI maintenance cards are hidden.
          </div>
        )}
      </div>
    </div>
  );
}
