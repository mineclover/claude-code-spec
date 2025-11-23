/**
 * CentralDashboardPage - Multi-project monitoring dashboard
 *
 * Provides an overview of all registered projects with:
 * - Project cards with health status
 * - System-wide statistics
 * - Active executions monitoring
 * - Quick navigation to project-specific views
 */

import type React from 'react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { TrackedExecution } from '../services/AgentTracker';
import type { ProjectRegistration, SystemMetrics } from '../types/report';
import styles from './CentralDashboardPage.module.css';

interface ProjectHealth {
  status: 'healthy' | 'warning' | 'error' | 'unknown';
  issues: string[];
  recommendations: string[];
}

export const CentralDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRegistration[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<TrackedExecution[]>([]);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'healthy' | 'issues'>('all');

  // Load data
  useEffect(() => {
    loadData();

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadData]);

  const loadData = async () => {
    try {
      // Load projects
      const projectsList = await window.centralDatabaseAPI.listProjects();
      setProjects(projectsList);

      // Load active executions
      const active = await window.agentTrackerAPI.getActiveExecutions();
      setActiveExecutions(active);

      // Load system metrics (last 24 hours)
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const metrics = await window.centralDatabaseAPI.aggregateMetrics({
        start: yesterday,
        end: now,
      });
      setSystemMetrics(metrics);

      setLoading(false);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      setLoading(false);
    }
  };

  // Calculate project health
  const calculateProjectHealth = (project: ProjectRegistration): ProjectHealth => {
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check for zombie processes
    const projectExecutions = activeExecutions.filter((e) => e.projectPath === project.projectPath);
    const zombies = projectExecutions.filter((e) => e.status === 'zombie');
    if (zombies.length > 0) {
      issues.push(`${zombies.length} zombie process(es) detected`);
      recommendations.push('Review and cleanup zombie processes');
    }

    // Check for failed tasks ratio
    const { stats } = project;
    const totalTasks = stats.completedTasks + stats.cancelledTasks;
    if (totalTasks > 0) {
      const failureRate = stats.cancelledTasks / totalTasks;
      if (failureRate > 0.3) {
        issues.push(`High failure rate (${Math.round(failureRate * 100)}%)`);
        recommendations.push('Review task definitions and dependencies');
      }
    }

    // Check for stale projects (no activity in 7 days)
    const lastSeenTime = new Date(project.lastSeen).getTime();
    const daysSinceActivity = (Date.now() - lastSeenTime) / (1000 * 60 * 60 * 24);
    if (daysSinceActivity > 7) {
      issues.push(`No activity for ${Math.round(daysSinceActivity)} days`);
      recommendations.push('Consider archiving or reviewing project status');
    }

    // Determine status
    let status: ProjectHealth['status'] = 'healthy';
    if (issues.length > 0) {
      status = zombies.length > 0 || issues.length > 2 ? 'error' : 'warning';
    }

    return { status, issues, recommendations };
  };

  // Filter projects
  const filteredProjects = projects.filter((project) => {
    if (filter === 'all') return true;
    const health = calculateProjectHealth(project);
    if (filter === 'healthy') return health.status === 'healthy';
    if (filter === 'issues') return health.status === 'warning' || health.status === 'error';
    return true;
  });

  // Format duration
  const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  };

  // Get health icon
  const getHealthIcon = (status: ProjectHealth['status']): string => {
    switch (status) {
      case 'healthy':
        return '●';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      default:
        return '?';
    }
  };

  // Get health color class
  const getHealthClass = (status: ProjectHealth['status']): string => {
    switch (status) {
      case 'healthy':
        return styles.healthy;
      case 'warning':
        return styles.warning;
      case 'error':
        return styles.error;
      default:
        return styles.unknown;
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading dashboard...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1>Central Dashboard</h1>
        <div className={styles.filters}>
          <button
            className={filter === 'all' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('all')}
          >
            All Projects
          </button>
          <button
            className={filter === 'healthy' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('healthy')}
          >
            Healthy
          </button>
          <button
            className={filter === 'issues' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('issues')}
          >
            Issues
          </button>
        </div>
      </div>

      {/* System Stats */}
      {systemMetrics && (
        <div className={styles.statsBar}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Projects</span>
            <span className={styles.statValue}>{projects.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Tasks (24h)</span>
            <span className={styles.statValue}>{systemMetrics.tasks.total}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Completed</span>
            <span className={styles.statValue}>{systemMetrics.tasks.completed}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Active Executions</span>
            <span className={styles.statValue}>{activeExecutions.length}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Avg Time</span>
            <span className={styles.statValue}>
              {Math.round(systemMetrics.tasks.avgCompletionTime)}m
            </span>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      <div className={styles.content}>
        <section className={styles.projectsSection}>
          <h2>Projects</h2>
          {filteredProjects.length === 0 ? (
            <div className={styles.emptyState}>
              {filter === 'all' ? 'No projects registered yet' : `No ${filter} projects found`}
            </div>
          ) : (
            <div className={styles.projectsGrid}>
              {filteredProjects.map((project) => {
                const health = calculateProjectHealth(project);
                return (
                  <div
                    key={project.projectPath}
                    className={styles.projectCard}
                    onClick={() => {
                      // Navigate to project-specific workflow page
                      // For now, just log
                      console.log('Navigate to project:', project.projectPath);
                    }}
                  >
                    <div className={styles.projectHeader}>
                      <span className={`${styles.healthIcon} ${getHealthClass(health.status)}`}>
                        {getHealthIcon(health.status)}
                      </span>
                      <h3 className={styles.projectName}>{project.name}</h3>
                    </div>

                    <div className={styles.projectStats}>
                      <div className={styles.projectStat}>
                        <span className={styles.projectStatLabel}>Tasks</span>
                        <span className={styles.projectStatValue}>{project.stats.totalTasks}</span>
                      </div>
                      <div className={styles.projectStat}>
                        <span className={styles.projectStatLabel}>Pending</span>
                        <span className={styles.projectStatValue}>
                          {project.stats.pendingTasks}
                        </span>
                      </div>
                      <div className={styles.projectStat}>
                        <span className={styles.projectStatLabel}>In Progress</span>
                        <span className={styles.projectStatValue}>
                          {project.stats.inProgressTasks}
                        </span>
                      </div>
                      <div className={styles.projectStat}>
                        <span className={styles.projectStatLabel}>Completed</span>
                        <span className={styles.projectStatValue}>
                          {project.stats.completedTasks}
                        </span>
                      </div>
                    </div>

                    {health.issues.length > 0 && (
                      <div className={styles.projectIssues}>
                        {health.issues.map((issue, idx) => (
                          <div key={idx} className={styles.issue}>
                            {issue}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className={styles.projectFooter}>
                      <span className={styles.lastSeen}>
                        Last seen: {new Date(project.lastSeen).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Active Executions */}
        <section className={styles.executionsSection}>
          <h2>Active Executions</h2>
          {activeExecutions.length === 0 ? (
            <div className={styles.emptyState}>No active executions</div>
          ) : (
            <div className={styles.executionsList}>
              {activeExecutions.map((execution) => (
                <div key={execution.sessionId} className={styles.executionItem}>
                  <div className={styles.executionInfo}>
                    <div className={styles.executionProject}>
                      {projects.find((p) => p.projectPath === execution.projectPath)?.name ||
                        'Unknown Project'}
                    </div>
                    <div className={styles.executionAgent}>Agent: {execution.agentName}</div>
                    {execution.taskId && (
                      <div className={styles.executionTask}>Task: {execution.taskId}</div>
                    )}
                  </div>
                  <div className={styles.executionDuration}>
                    {formatDuration(Date.now() - execution.startTime)}
                  </div>
                  <button
                    className={styles.executionButton}
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/executions/${execution.sessionId}`);
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
