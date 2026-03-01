import { useCallback, useEffect, useState } from 'react';
import type { InstalledSkillInfo, SkillInstallPathInfo } from '../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

export function useInstalledSkills() {
  const [installedSkills, setInstalledSkills] = useState<InstalledSkillInfo[]>([]);
  const [skillInstallPaths, setSkillInstallPaths] = useState<SkillInstallPathInfo[]>([]);
  const [isSkillsLoading, setIsSkillsLoading] = useState(false);
  const [togglingSkillKey, setTogglingSkillKey] = useState<string | null>(null);
  const [skillsMessage, setSkillsMessage] = useState<Message>(null);

  const loadInstalledSkills = useCallback(async () => {
    setIsSkillsLoading(true);
    setSkillsMessage(null);
    try {
      const [paths, skills] = await Promise.all([
        window.toolsAPI.getSkillInstallPaths(),
        window.toolsAPI.getInstalledSkills(),
      ]);
      setSkillInstallPaths(paths);
      setInstalledSkills(skills);
    } catch (error) {
      console.error('Failed to load installed skills:', error);
      setSkillsMessage({ type: 'error', text: 'Failed to load installed skills.' });
    } finally {
      setIsSkillsLoading(false);
    }
  }, []);

  const toggleSkillActivation = useCallback(
    async (skill: InstalledSkillInfo) => {
      const key = `${skill.provider}:${skill.id}`;
      setTogglingSkillKey(key);
      setSkillsMessage(null);
      try {
        await window.toolsAPI.setSkillActivation(skill.provider, skill.id, !skill.active);
        setSkillsMessage({
          type: 'success',
          text: `${skill.provider}/${skill.id} ${skill.active ? 'deactivated' : 'activated'}.`,
        });
        await loadInstalledSkills();
      } catch (error) {
        console.error('Failed to toggle skill activation:', error);
        setSkillsMessage({
          type: 'error',
          text: `Failed to ${skill.active ? 'deactivate' : 'activate'} ${skill.provider}/${skill.id}.`,
        });
      } finally {
        setTogglingSkillKey(null);
      }
    },
    [loadInstalledSkills],
  );

  useEffect(() => {
    loadInstalledSkills();
  }, [loadInstalledSkills]);

  return {
    installedSkills,
    skillInstallPaths,
    isSkillsLoading,
    togglingSkillKey,
    skillsMessage,
    loadInstalledSkills,
    toggleSkillActivation,
  };
}
