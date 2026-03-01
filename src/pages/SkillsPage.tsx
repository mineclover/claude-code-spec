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
    isCheckingVersions,
    updatingToolId,
    toolMessage,
    loadMaintenanceTools,
    checkToolVersions,
    runToolUpdate,
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
    visibleErrors: visibleRegistryErrors,
    templateActions,
    loadRegistry: loadMaintenanceRegistry,
    appendTemplate,
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
        />

        <SkillsCliMaintenanceSection
          maintenanceTools={maintenanceTools}
          toolVersions={toolVersions}
          isCheckingVersions={isCheckingVersions}
          updatingToolId={updatingToolId}
          message={toolMessage}
          onCheckVersions={checkToolVersions}
          onRunToolUpdate={runToolUpdate}
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
