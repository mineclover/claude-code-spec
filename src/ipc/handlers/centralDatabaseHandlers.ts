/**
 * IPC Handlers for CentralDatabase operations
 */

import { CentralDatabase } from '../../services/CentralDatabase';
import type {
  ExecutionRecord,
  ProjectRegistration,
  Report,
  ReportFilter,
  TimeRange,
} from '../../types/report';
import type { IpcRouter } from '../IpcRouter';

let centralDatabase: CentralDatabase | null = null;

/**
 * Get or create CentralDatabase instance
 */
export function getCentralDatabase(): CentralDatabase {
  if (!centralDatabase) {
    centralDatabase = new CentralDatabase();
    // Initialize on first use
    centralDatabase.initialize().catch((error) => {
      console.error('Failed to initialize CentralDatabase:', error);
    });
  }
  return centralDatabase;
}

/**
 * Register all central database handlers
 */
export function registerCentralDatabaseHandlers(router: IpcRouter): void {
  // Project management
  router.handle('saveProjectState', async (registration: ProjectRegistration) => {
    const db = getCentralDatabase();
    await db.saveProjectState(registration);
    return { success: true };
  });

  router.handle('getProjectState', async (projectPath: string) => {
    const db = getCentralDatabase();
    return await db.getProjectState(projectPath);
  });

  router.handle('listProjects', async () => {
    const db = getCentralDatabase();
    return await db.listProjects();
  });

  // Report management
  router.handle('saveReport', async (report: Report) => {
    const db = getCentralDatabase();
    await db.saveReport(report);
    return { success: true };
  });

  router.handle('getReports', async (filter: ReportFilter = {}) => {
    const db = getCentralDatabase();
    return await db.getReports(filter);
  });

  router.handle('archiveOldReports', async (beforeDate: Date) => {
    const db = getCentralDatabase();
    await db.archiveOldReports(new Date(beforeDate));
    return { success: true };
  });

  // Execution history
  router.handle('saveExecution', async (execution: ExecutionRecord) => {
    const db = getCentralDatabase();
    await db.saveExecution(execution);
    return { success: true };
  });

  router.handle(
    'getExecutionHistory',
    async ({ projectPath, limit }: { projectPath: string; limit?: number }) => {
      const db = getCentralDatabase();
      return await db.getExecutionHistory(projectPath, limit);
    },
  );

  // Metrics
  router.handle('aggregateMetrics', async (timeRange: TimeRange) => {
    const db = getCentralDatabase();
    return await db.aggregateMetrics({
      start: new Date(timeRange.start),
      end: new Date(timeRange.end),
    });
  });

  // Utility
  router.handle('initializeCentralDatabase', async () => {
    const db = getCentralDatabase();
    await db.initialize();
    return { success: true };
  });
}
