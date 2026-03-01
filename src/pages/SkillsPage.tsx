/**
 * Skills Page
 * CLI version checks/updates + installed skills inventory + registry config
 */

import { SkillsCliMaintenanceSection } from '../components/skills/SkillsCliMaintenanceSection';
import { SkillsInstalledSection } from '../components/skills/SkillsInstalledSection';
import { SkillsRegistrySection } from '../components/skills/SkillsRegistrySection';
import { useCliMaintenance } from '../hooks/useCliMaintenance';
import { useInstalledSkills } from '../hooks/useInstalledSkills';
import { useMaintenanceRegistryEditor } from '../hooks/useMaintenanceRegistryEditor';
import styles from './SkillsPage.module.css';

export function SkillsPage() {
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
    installedSkills,
    skillInstallPaths,
    activationEvents,
    isSkillsLoading,
    togglingSkillKey,
    skillsMessage,
    loadInstalledSkills,
    toggleSkillActivation,
  } = useInstalledSkills();
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
      await Promise.all([loadMaintenanceTools(), loadInstalledSkills()]);
      await checkToolVersions();
    },
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Skills &amp; CLI Maintenance</h2>
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

        <SkillsInstalledSection
          skillInstallPaths={skillInstallPaths}
          installedSkills={installedSkills}
          activationEvents={activationEvents}
          isSkillsLoading={isSkillsLoading}
          togglingSkillKey={togglingSkillKey}
          message={skillsMessage}
          onRefresh={loadInstalledSkills}
          onToggleSkillActivation={toggleSkillActivation}
        />
      </div>
    </div>
  );
}
