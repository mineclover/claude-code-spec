/**
 * Skill API exposure
 */

import { contextBridge, ipcRenderer } from 'electron';
import type { SkillAPI } from '../../types/api/skill';

export function exposeSkillAPI(): void {
  const skillAPI: SkillAPI = {
    listSkills: (scope, projectPath) =>
      ipcRenderer.invoke('skill:listSkills', { scope, projectPath }),

    getSkill: (id, scope, projectPath) =>
      ipcRenderer.invoke('skill:getSkill', { id, scope, projectPath }),

    createSkill: (input) => ipcRenderer.invoke('skill:createSkill', input),

    updateSkill: (id, updates, scope, projectPath) =>
      ipcRenderer.invoke('skill:updateSkill', { id, updates, scope, projectPath }),

    deleteSkill: (id, scope, projectPath) =>
      ipcRenderer.invoke('skill:deleteSkill', { id, scope, projectPath }),

    scanSkills: (projectPath) => ipcRenderer.invoke('skill:scanSkills', { projectPath }),

    validateSkill: (input) => ipcRenderer.invoke('skill:validateSkill', input),

    exportSkill: (id, scope, options) =>
      ipcRenderer.invoke('skill:exportSkill', { id, scope, options }),

    importSkill: (options) => ipcRenderer.invoke('skill:importSkill', options),

    listSkillFiles: (id, scope, projectPath) =>
      ipcRenderer.invoke('skill:listSkillFiles', { id, scope, projectPath }),

    getSkillFile: (id, fileName, scope, projectPath) =>
      ipcRenderer.invoke('skill:getSkillFile', { id, fileName, scope, projectPath }),

    updateSkillFile: (id, fileName, content, scope, projectPath) =>
      ipcRenderer.invoke('skill:updateSkillFile', {
        id,
        fileName,
        content,
        scope,
        projectPath,
      }),

    deleteSkillFile: (id, fileName, scope, projectPath) =>
      ipcRenderer.invoke('skill:deleteSkillFile', { id, fileName, scope, projectPath }),

    onSkillChanged: (callback) => {
      const listener = (_event: unknown, skill: Parameters<typeof callback>[0]) => callback(skill);
      ipcRenderer.on('skill:changed', listener);
      return () => {
        ipcRenderer.removeListener('skill:changed', listener);
      };
    },

    onSkillDeleted: (callback) => {
      const listener = (
        _event: unknown,
        id: Parameters<typeof callback>[0],
        scope: Parameters<typeof callback>[1],
      ) => callback(id, scope);
      ipcRenderer.on('skill:deleted', listener);
      return () => {
        ipcRenderer.removeListener('skill:deleted', listener);
      };
    },
  };

  contextBridge.exposeInMainWorld('skillAPI', skillAPI);
}
