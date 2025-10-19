/**
 * Skill Repository API exposure
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { SkillRepositoryAPI } from '../../types/api/skillRepository';

export function exposeSkillRepositoryAPI(): void {
  const skillRepositoryAPI: SkillRepositoryAPI = {
    getRepositoryConfig: () => ipcRenderer.invoke('skill-repo:getRepositoryConfig'),

    setRepositoryConfig: (config) =>
      ipcRenderer.invoke('skill-repo:setRepositoryConfig', config),

    getRepositoryStatus: () => ipcRenderer.invoke('skill-repo:getRepositoryStatus'),

    cloneRepository: () => ipcRenderer.invoke('skill-repo:cloneRepository'),

    updateRepository: () => ipcRenderer.invoke('skill-repo:updateRepository'),

    listOfficialSkills: () => ipcRenderer.invoke('skill-repo:listOfficialSkills'),

    getOfficialSkill: (skillId) => ipcRenderer.invoke('skill-repo:getOfficialSkill', skillId),

    searchOfficialSkills: (query) => ipcRenderer.invoke('skill-repo:searchOfficialSkills', query),

    importSkill: (options) => ipcRenderer.invoke('skill-repo:importSkill', options),

    checkSkillUpdates: (skillId, scope, projectPath) =>
      ipcRenderer.invoke('skill-repo:checkSkillUpdates', { skillId, scope, projectPath }),

    syncSkill: (options) => ipcRenderer.invoke('skill-repo:syncSkill', options),

    checkAllUpdates: (scope, projectPath) =>
      ipcRenderer.invoke('skill-repo:checkAllUpdates', { scope, projectPath }),

    onRepositoryUpdated: (callback) => {
      const listener = () => callback();
      ipcRenderer.on('skill-repo:updated', listener);
      return () => {
        ipcRenderer.removeListener('skill-repo:updated', listener);
      };
    },
  };

  contextBridge.exposeInMainWorld('skillRepositoryAPI', skillRepositoryAPI);
}
