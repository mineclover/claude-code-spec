/**
 * Preload API for CentralDatabase
 */

import { contextBridge, ipcRenderer } from 'electron';
import type {
  ExecutionRecord,
  ProjectRegistration,
  Report,
  ReportFilter,
  SystemMetrics,
  TimeRange,
} from '../../types/report';

export interface CentralDatabaseAPI {
  // Project management
  saveProjectState: (registration: ProjectRegistration) => Promise<{ success: boolean }>;
  getProjectState: (projectPath: string) => Promise<ProjectRegistration | null>;
  listProjects: () => Promise<ProjectRegistration[]>;

  // Report management
  saveReport: (report: Report) => Promise<{ success: boolean }>;
  getReports: (filter?: ReportFilter) => Promise<Report[]>;
  archiveOldReports: (beforeDate: Date) => Promise<{ success: boolean }>;

  // Execution history
  saveExecution: (execution: ExecutionRecord) => Promise<{ success: boolean }>;
  getExecutionHistory: (projectPath: string, limit?: number) => Promise<ExecutionRecord[]>;

  // Metrics
  aggregateMetrics: (timeRange: TimeRange) => Promise<SystemMetrics>;

  // Utility
  initialize: () => Promise<{ success: boolean }>;
}

export function exposeCentralDatabaseAPI(): void {
  const api: CentralDatabaseAPI = {
    // Project management
    saveProjectState: (registration: ProjectRegistration) =>
      ipcRenderer.invoke('central-database:saveProjectState', registration),

    getProjectState: (projectPath: string) =>
      ipcRenderer.invoke('central-database:getProjectState', projectPath),

    listProjects: () => ipcRenderer.invoke('central-database:listProjects'),

    // Report management
    saveReport: (report: Report) => ipcRenderer.invoke('central-database:saveReport', report),

    getReports: (filter: ReportFilter = {}) =>
      ipcRenderer.invoke('central-database:getReports', filter),

    archiveOldReports: (beforeDate: Date) =>
      ipcRenderer.invoke('central-database:archiveOldReports', beforeDate),

    // Execution history
    saveExecution: (execution: ExecutionRecord) =>
      ipcRenderer.invoke('central-database:saveExecution', execution),

    getExecutionHistory: (projectPath: string, limit?: number) =>
      ipcRenderer.invoke('central-database:getExecutionHistory', { projectPath, limit }),

    // Metrics
    aggregateMetrics: (timeRange: TimeRange) =>
      ipcRenderer.invoke('central-database:aggregateMetrics', timeRange),

    // Utility
    initialize: () => ipcRenderer.invoke('central-database:initializeCentralDatabase'),
  };

  contextBridge.exposeInMainWorld('centralDatabaseAPI', api);
}
