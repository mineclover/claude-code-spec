/**
 * Skills Page
 * Installed skills inventory
 */

import { SkillsInstalledSection } from '../components/skills/SkillsInstalledSection';
import { useInstalledSkills } from '../hooks/useInstalledSkills';
import styles from './SkillsPage.module.css';

export function SkillsPage() {
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

  const showInstalledSkillsSection =
    skillInstallPaths.length > 0 ||
    installedSkills.length > 0 ||
    isSkillsLoading ||
    togglingSkillKey !== null;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Skills</h2>
      </div>

      <div className={styles.settingsSection}>
        {showInstalledSkillsSection ? (
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
        ) : (
          <div className={styles.settingDescription}>
            No services expose skill-store capability, so skills cards are hidden.
          </div>
        )}
      </div>
    </div>
  );
}
