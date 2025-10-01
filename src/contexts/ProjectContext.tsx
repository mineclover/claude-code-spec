/**
 * Project Context
 * Manages the currently selected project path across the application
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ProjectContextValue {
  // Current project path
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;

  // Project directory name (for navigation)
  projectDirName: string | null;
  setProjectDirName: (name: string | null) => void;

  // Update both at once
  updateProject: (path: string | null, dirName: string | null) => void;

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
    // Store in localStorage for persistence
    if (path) {
      localStorage.setItem('currentProjectPath', path);
    } else {
      localStorage.removeItem('currentProjectPath');
    }
  }, []);

  const setProjectDirName = useCallback((name: string | null) => {
    setProjectDirNameState(name);
    if (name) {
      localStorage.setItem('currentProjectDirName', name);
    } else {
      localStorage.removeItem('currentProjectDirName');
    }
  }, []);

  const updateProject = useCallback(
    (path: string | null, dirName: string | null) => {
      console.log('[ProjectContext] updateProject:', { path, dirName });
      setProjectPath(path);
      setProjectDirName(dirName);
    },
    [setProjectPath, setProjectDirName]
  );

  const clearProject = useCallback(() => {
    setProjectPath(null);
    setProjectDirName(null);
  }, [setProjectPath, setProjectDirName]);

  // Restore from localStorage on mount
  React.useEffect(() => {
    const savedPath = localStorage.getItem('currentProjectPath');
    const savedDirName = localStorage.getItem('currentProjectDirName');
    console.log('[ProjectContext] Restoring from localStorage:', { savedPath, savedDirName });
    if (savedPath) {
      setProjectPathState(savedPath);
    }
    if (savedDirName) {
      setProjectDirNameState(savedDirName);
    }
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
