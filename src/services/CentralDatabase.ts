/**
 * CentralDatabase - Unified data storage for all projects
 *
 * Responsibilities:
 * - Store and retrieve project states
 * - Archive reports
 * - Manage execution history
 * - Aggregate system metrics
 *
 * Storage location: ~/.claude/central-management/
 */

import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { appLogger } from '../main/app-context';
import type {
  ExecutionRecord,
  ProjectRegistration,
  Report,
  ReportFilter,
  SystemMetrics,
  TimeRange,
} from '../types/report';

export class CentralDatabase {
  private baseDir: string;
  private projectsDir: string;
  private reportsDir: string;
  private executionsDir: string;
  private metricsDir: string;

  constructor(baseDir?: string) {
    // Default to ~/.claude/central-management
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    this.baseDir = baseDir || path.join(homeDir, '.claude', 'central-management');

    this.projectsDir = path.join(this.baseDir, 'projects');
    this.reportsDir = path.join(this.baseDir, 'reports');
    this.executionsDir = path.join(this.baseDir, 'executions');
    this.metricsDir = path.join(this.baseDir, 'metrics');

    appLogger.info('CentralDatabase initialized', {
      module: 'CentralDatabase',
      baseDir: this.baseDir,
    });
  }

  /**
   * Initialize database directories
   */
  async initialize(): Promise<void> {
    appLogger.info('Initializing CentralDatabase directories', {
      module: 'CentralDatabase',
    });

    try {
      await fs.mkdir(this.projectsDir, { recursive: true });
      await fs.mkdir(this.reportsDir, { recursive: true });
      await fs.mkdir(path.join(this.reportsDir, 'archives'), { recursive: true });
      await fs.mkdir(this.executionsDir, { recursive: true });
      await fs.mkdir(this.metricsDir, { recursive: true });

      appLogger.info('CentralDatabase directories created', {
        module: 'CentralDatabase',
      });
    } catch (error) {
      appLogger.error('Failed to initialize directories', error as Error, {
        module: 'CentralDatabase',
      });
      throw error;
    }
  }

  // ========== Project Management ==========

  /**
   * Get hash for project path (for directory naming)
   */
  private getProjectHash(projectPath: string): string {
    return createHash('md5').update(projectPath).digest('hex').substring(0, 16);
  }

  /**
   * Register or update a project
   */
  async saveProjectState(registration: ProjectRegistration): Promise<void> {
    appLogger.info('Saving project state', {
      module: 'CentralDatabase',
      projectPath: registration.projectPath,
    });

    try {
      const projectHash = this.getProjectHash(registration.projectPath);
      const projectDir = path.join(this.projectsDir, projectHash);

      await fs.mkdir(projectDir, { recursive: true });

      const statePath = path.join(projectDir, 'state.json');
      await this.writeJsonAtomic(statePath, registration);

      appLogger.info('Project state saved', {
        module: 'CentralDatabase',
        projectPath: registration.projectPath,
        projectHash,
      });
    } catch (error) {
      appLogger.error('Failed to save project state', error as Error, {
        module: 'CentralDatabase',
        projectPath: registration.projectPath,
      });
      throw error;
    }
  }

  /**
   * Get project registration
   */
  async getProjectState(projectPath: string): Promise<ProjectRegistration | null> {
    try {
      const projectHash = this.getProjectHash(projectPath);
      const statePath = path.join(this.projectsDir, projectHash, 'state.json');

      const content = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(content) as ProjectRegistration;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null;
      }
      appLogger.error('Failed to get project state', error as Error, {
        module: 'CentralDatabase',
        projectPath,
      });
      throw error;
    }
  }

  /**
   * List all registered projects
   */
  async listProjects(): Promise<ProjectRegistration[]> {
    appLogger.info('Listing all projects', {
      module: 'CentralDatabase',
    });

    try {
      const projects: ProjectRegistration[] = [];
      const entries = await fs.readdir(this.projectsDir);

      for (const entry of entries) {
        const statePath = path.join(this.projectsDir, entry, 'state.json');
        try {
          const content = await fs.readFile(statePath, 'utf-8');
          projects.push(JSON.parse(content));
        } catch (_error) {
          appLogger.warn('Failed to read project state', {
            module: 'CentralDatabase',
            projectHash: entry,
          });
        }
      }

      appLogger.info('Projects listed', {
        module: 'CentralDatabase',
        count: projects.length,
      });

      return projects;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      appLogger.error('Failed to list projects', error as Error, {
        module: 'CentralDatabase',
      });
      throw error;
    }
  }

  // ========== Report Management ==========

  /**
   * Save a report
   */
  async saveReport(report: Report): Promise<void> {
    appLogger.info('Saving report', {
      module: 'CentralDatabase',
      reportId: report.id,
      reportType: report.type,
    });

    try {
      // Reports are organized by date
      const date = new Date(report.timestamp);
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

      const reportFile = path.join(this.reportsDir, `${dateStr}.json`);

      // Read existing reports for this date
      let reports: Report[] = [];
      try {
        const content = await fs.readFile(reportFile, 'utf-8');
        reports = JSON.parse(content);
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      // Add new report
      reports.push(report);

      // Write back
      await this.writeJsonAtomic(reportFile, reports);

      appLogger.info('Report saved', {
        module: 'CentralDatabase',
        reportId: report.id,
        date: dateStr,
      });
    } catch (error) {
      appLogger.error('Failed to save report', error as Error, {
        module: 'CentralDatabase',
        reportId: report.id,
      });
      throw error;
    }
  }

  /**
   * Get reports matching filter
   */
  async getReports(filter: ReportFilter = {}): Promise<Report[]> {
    appLogger.info('Getting reports', {
      module: 'CentralDatabase',
      filter,
    });

    try {
      const allReports: Report[] = [];

      // Get date range to scan
      const startDate = filter.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      const endDate = filter.endDate || new Date();

      // Scan all report files in date range
      const files = await fs.readdir(this.reportsDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const dateStr = file.replace('.json', '');
        const fileDate = new Date(dateStr);

        if (fileDate >= startDate && fileDate <= endDate) {
          const filePath = path.join(this.reportsDir, file);
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const reports: Report[] = JSON.parse(content);
            allReports.push(...reports);
          } catch (_error) {
            appLogger.warn('Failed to read report file', {
              module: 'CentralDatabase',
              file,
            });
          }
        }
      }

      // Apply filters
      let filtered = allReports;

      if (filter.projectPath) {
        filtered = filtered.filter((r) => r.projectPath === filter.projectPath);
      }

      if (filter.type) {
        filtered = filtered.filter((r) => r.type === filter.type);
      }

      // Apply limit
      if (filter.limit && filter.limit > 0) {
        filtered = filtered.slice(0, filter.limit);
      }

      appLogger.info('Reports retrieved', {
        module: 'CentralDatabase',
        count: filtered.length,
      });

      return filtered;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      appLogger.error('Failed to get reports', error as Error, {
        module: 'CentralDatabase',
      });
      throw error;
    }
  }

  /**
   * Archive old reports (compress and move to archives/)
   */
  async archiveOldReports(beforeDate: Date): Promise<void> {
    appLogger.info('Archiving old reports', {
      module: 'CentralDatabase',
      beforeDate: beforeDate.toISOString(),
    });

    try {
      const files = await fs.readdir(this.reportsDir);
      let archivedCount = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const dateStr = file.replace('.json', '');
        const fileDate = new Date(dateStr);

        if (fileDate < beforeDate) {
          const filePath = path.join(this.reportsDir, file);
          const archivePath = path.join(this.reportsDir, 'archives', file);

          await fs.rename(filePath, archivePath);
          archivedCount++;
        }
      }

      appLogger.info('Reports archived', {
        module: 'CentralDatabase',
        count: archivedCount,
      });
    } catch (error) {
      appLogger.error('Failed to archive reports', error as Error, {
        module: 'CentralDatabase',
      });
      throw error;
    }
  }

  // ========== Execution History ==========

  /**
   * Save execution record
   */
  async saveExecution(execution: ExecutionRecord): Promise<void> {
    appLogger.info('Saving execution record', {
      module: 'CentralDatabase',
      executionId: execution.executionId,
      projectPath: execution.projectPath,
    });

    try {
      const projectHash = this.getProjectHash(execution.projectPath);
      const executionDir = path.join(this.executionsDir, projectHash);

      await fs.mkdir(executionDir, { recursive: true });

      const executionFile = path.join(executionDir, `${execution.sessionId}.json`);
      await this.writeJsonAtomic(executionFile, execution);

      appLogger.info('Execution record saved', {
        module: 'CentralDatabase',
        executionId: execution.executionId,
      });
    } catch (error) {
      appLogger.error('Failed to save execution record', error as Error, {
        module: 'CentralDatabase',
        executionId: execution.executionId,
      });
      throw error;
    }
  }

  /**
   * Get execution history for a project
   */
  async getExecutionHistory(projectPath: string, limit?: number): Promise<ExecutionRecord[]> {
    appLogger.info('Getting execution history', {
      module: 'CentralDatabase',
      projectPath,
      limit,
    });

    try {
      const projectHash = this.getProjectHash(projectPath);
      const executionDir = path.join(this.executionsDir, projectHash);

      const files = await fs.readdir(executionDir);
      const executions: ExecutionRecord[] = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(executionDir, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          executions.push(JSON.parse(content));
        } catch (_error) {
          appLogger.warn('Failed to read execution file', {
            module: 'CentralDatabase',
            file,
          });
        }
      }

      // Sort by start time (descending)
      executions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

      // Apply limit
      const result = limit ? executions.slice(0, limit) : executions;

      appLogger.info('Execution history retrieved', {
        module: 'CentralDatabase',
        projectPath,
        count: result.length,
      });

      return result;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return [];
      }
      appLogger.error('Failed to get execution history', error as Error, {
        module: 'CentralDatabase',
        projectPath,
      });
      throw error;
    }
  }

  // ========== Metrics Aggregation ==========

  /**
   * Aggregate system metrics
   */
  async aggregateMetrics(timeRange: TimeRange): Promise<SystemMetrics> {
    appLogger.info('Aggregating metrics', {
      module: 'CentralDatabase',
      timeRange,
    });

    try {
      const projects = await this.listProjects();
      const reports = await this.getReports({
        startDate: timeRange.start,
        endDate: timeRange.end,
      });

      // Project metrics
      const projectMetrics = {
        total: projects.length,
        healthy: projects.filter((p) => p.healthStatus === 'healthy').length,
        warnings: projects.filter((p) => p.healthStatus === 'warning').length,
        errors: projects.filter((p) => p.healthStatus === 'error').length,
      };

      // Task metrics
      const completionReports = reports.filter((r) => r.type === 'completion');
      const totalTasks = completionReports.length;
      const failedTasks = completionReports.filter(
        (r) => r.type === 'completion' && !r.success,
      ).length;
      const successfulTasks = totalTasks - failedTasks;

      const avgCompletionTime =
        completionReports.length > 0
          ? completionReports.reduce(
              (sum, r) => sum + (r.type === 'completion' ? r.duration : 0),
              0,
            ) / completionReports.length
          : 0;

      // Execution metrics
      const allExecutions: ExecutionRecord[] = [];
      for (const project of projects) {
        const executions = await this.getExecutionHistory(project.projectPath);
        allExecutions.push(...executions);
      }

      const executionMetrics = {
        total: allExecutions.length,
        successful: allExecutions.filter((e) => e.status === 'completed').length,
        failed: allExecutions.filter((e) => e.status === 'failed').length,
        zombies: allExecutions.filter((e) => e.status === 'zombie').length,
      };

      const metrics: SystemMetrics = {
        timeRange,
        projects: projectMetrics,
        tasks: {
          total: totalTasks,
          completed: successfulTasks,
          failed: failedTasks,
          avgCompletionTime,
        },
        executions: executionMetrics,
      };

      appLogger.info('Metrics aggregated', {
        module: 'CentralDatabase',
        metrics,
      });

      return metrics;
    } catch (error) {
      appLogger.error('Failed to aggregate metrics', error as Error, {
        module: 'CentralDatabase',
      });
      throw error;
    }
  }

  // ========== Utility Methods ==========

  /**
   * Write JSON atomically (write to temp file, then rename)
   */
  private async writeJsonAtomic(filePath: string, data: any): Promise<void> {
    const tempFile = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      await fs.rename(tempFile, filePath);
    } catch (error) {
      // Clean up temp file if it exists
      try {
        await fs.unlink(tempFile);
      } catch (_cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }
}
