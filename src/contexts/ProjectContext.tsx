/**
 * Project Context
 * Manages the currently selected project and the available project folder list.
 */

import React, {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useToolContext } from './ToolContext';
import type { ProjectFolder } from '../types/api/sessions';

interface ProjectContextValue {
  projectPath: string | null;
  setProjectPath: (path: string | null) => void;
  projectDirName: string | null;
  setProjectDirName: (name: string | null) => void;
  updateProject: (path: string | null, dirName: string | null) => Promise<void>;
  clearProject: () => void;
  // Project folder list (for the sidebar picker)
  projectFolders: ProjectFolder[];
  isLoadingFolders: boolean;
  refreshProjectFolders: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { selectedToolId } = useToolContext();

  const [projectPath, setProjectPathState] = useState<string | null>(null);
  const [projectDirName, setProjectDirNameState] = useState<string | null>(null);
  const [projectFolders, setProjectFolders] = useState<ProjectFolder[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

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

  const refreshProjectFolders = useCallback(async () => {
    setIsLoadingFolders(true);
    try {
      const folders = await window.sessionsAPI.listProjectFolders(selectedToolId);
      setProjectFolders(folders);
    } catch (error) {
      console.error('[ProjectContext] Failed to load project folders:', error);
    } finally {
      setIsLoadingFolders(false);
    }
  }, [selectedToolId]);

  // Restore saved project on mount
  useEffect(() => {
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

  // Load project folder list whenever the selected tool changes
  useEffect(() => {
    refreshProjectFolders();
  }, [refreshProjectFolders]);

  return (
    <ProjectContext.Provider
      value={{
        projectPath,
        setProjectPath,
        projectDirName,
        setProjectDirName,
        updateProject,
        clearProject,
        projectFolders,
        isLoadingFolders,
        refreshProjectFolders,
      }}
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
