/**
 * Project Context
 * Manages the currently selected project path across the application
 */

import React, { createContext, type ReactNode, useCallback, useContext, useState } from 'react';

interface ProjectContextValue {
  // Current project path
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;

  // Project directory name (for navigation)
  projectDirName: string | null;
  setProjectDirName: (name: string | null) => void;

  // Update both at once (async - saves to main process)
  updateProject: (path: string | null, dirName: string | null) => Promise<void>;

  // Clear project selection
  clearProject: () => void;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

interface ProjectProviderProps {
  children: ReactNode;
}

export function ProjectProvider({ children }: ProjectProviderProps) {
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
      console.log('[ProjectContext] updateProject:', { path, dirName });
      setProjectPath(path);
      setProjectDirName(dirName);

      // Save to main process settings
      if (path && dirName) {
        await window.appSettingsAPI.setCurrentProject(path, dirName);
      }
    },
    [setProjectPath, setProjectDirName],
  );

  const clearProject = useCallback(() => {
    setProjectPath(null);
    setProjectDirName(null);
  }, [setProjectPath, setProjectDirName]);

  // Restore from main process settings on mount
  React.useEffect(() => {
    const loadFromSettings = async () => {
      try {
        const savedPath = await window.appSettingsAPI.getCurrentProjectPath();
        const savedDirName = await window.appSettingsAPI.getCurrentProjectDirName();
        console.log('[ProjectContext] Restoring from main process:', { savedPath, savedDirName });

        if (savedPath) {
          setProjectPathState(savedPath);
        }
        if (savedDirName) {
          setProjectDirNameState(savedDirName);
        }
      } catch (error) {
        console.error('[ProjectContext] Failed to restore from settings:', error);
      }
    };

    loadFromSettings();
  }, []);

  const value: ProjectContextValue = {
    projectPath,
    setProjectPath,
    projectDirName,
    setProjectDirName,
    updateProject,
    clearProject,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
