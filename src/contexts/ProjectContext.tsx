/**
 * Project Context
 * Manages the currently selected project path via settingsAPI
 */

import React, { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface ProjectContextValue {
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;
  projectDirName: string | null;
  setProjectDirName: (name: string | null) => void;
  updateProject: (path: string | null, dirName: string | null) => Promise<void>;
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectPath, setProjectPathState] = useState<string | null>(null);
  const [projectDirName, setProjectDirNameState] = useState<string | null>(null);

  const setProjectPath = useCallback((path: string | null) => {
    setProjectPathState(path);
  }, []);

  const setProjectDirName = useCallback((name: string | null) => {
    setProjectDirNameState(name);
  }, []);

  const updateProject = useCallback(
    async (path: string | null, dirName: string | null) => {
      setProjectPath(path);
      setProjectDirName(dirName);
      if (path && dirName) {
        await window.settingsAPI.setCurrentProject(path, dirName);
      }
    },
    [setProjectPath, setProjectDirName],
  );

  const clearProject = useCallback(() => {
    setProjectPath(null);
    setProjectDirName(null);
  }, [setProjectPath, setProjectDirName]);

  React.useEffect(() => {
    const loadFromSettings = async () => {
      try {
        const savedPath = await window.settingsAPI.getCurrentProjectPath();
        const savedDirName = await window.settingsAPI.getCurrentProjectDirName();
        if (savedPath) setProjectPathState(savedPath);
        if (savedDirName) setProjectDirNameState(savedDirName);
      } catch (error) {
        console.error('[ProjectContext] Failed to restore:', error);
      }
    };
    loadFromSettings();
  }, []);

  return (
    <ProjectContext.Provider
      value={{ projectPath, setProjectPath, projectDirName, setProjectDirName, updateProject, clearProject }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error('useProject must be used within a ProjectProvider');
  return context;
}
