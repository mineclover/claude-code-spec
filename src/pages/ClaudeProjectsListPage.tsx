import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Pagination } from '../components/common/Pagination';
import { useProject } from '../contexts/ProjectContext';
import type { ClaudeProjectInfo } from '../preload';
import {
  clearAllCache,
  getCachedProjectsPage,
  getCachedTotalCount,
  setCachedProjectsPage,
  setCachedTotalCount,
} from '../services/cache';
import styles from './ClaudeProjectsListPage.module.css';

type SortOption = 'recent' | 'oldest' | 'name';

export const ClaudeProjectsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { updateProject } = useProject();
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [_hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const PAGE_SIZE = 10;

  const loadTotalCount = useCallback(async () => {
    try {
      const cachedCount = await getCachedTotalCount();
      if (cachedCount !== null) {
        setTotalProjects(cachedCount);
        return;
      }

      const total = await window.claudeSessionsAPI.getTotalCount();
      setTotalProjects(total);
      await setCachedTotalCount(total);
    } catch (error) {
      console.error('Failed to load total count:', error);
    }
  }, []);

  const loadClaudeProjects = useCallback(async (page: number) => {
    setLoading(true);
    try {
      const cachedPage = await getCachedProjectsPage(page, PAGE_SIZE);
      if (cachedPage !== null) {
        setProjects(cachedPage.projects);
        setTotalProjects(cachedPage.total);
        setHasMore(cachedPage.hasMore);
        setLoading(false);
        setInitialLoading(false);
        return;
      }

      const result = await window.claudeSessionsAPI.getAllProjectsPaginated(page, PAGE_SIZE);
      setProjects(result.projects);
      setTotalProjects(result.total);
      setHasMore(result.hasMore);
      setLastUpdated(Date.now());

      await setCachedProjectsPage(page, PAGE_SIZE, result.projects, result.total, result.hasMore);
    } catch (error) {
      console.error('Failed to load Claude projects:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTotalCount();
  }, [loadTotalCount]);

  useEffect(() => {
    loadClaudeProjects(currentPage);
  }, [currentPage, loadClaudeProjects]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRefresh = async () => {
    await clearAllCache();
    await loadTotalCount();
    await loadClaudeProjects(currentPage);
  };

  const handleProjectClick = (project: ClaudeProjectInfo) => {
    navigate(`/claude-projects/${project.projectDirName}`);
  };

  const handleUseInExecute = async (projectPath: string, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('[ClaudeProjectsListPage] Execute button clicked for:', projectPath);

    const dirName = projectPath.split('/').filter(Boolean).pop() || projectPath;
    console.log('[ClaudeProjectsListPage] Project dirName:', dirName);

    await updateProject(projectPath, dirName);
    navigate(`/?projectPath=${encodeURIComponent(projectPath)}`);
    toast.success('Project loaded in Execute tab');
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Claude CLI Projects</h3>
        <div className={styles.headerControls}>
          <div className={styles.sortControls}>
            <label htmlFor="sort-select">Sort by:</label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest</option>
              <option value="name">Name</option>
            </select>
          </div>
          <div className={styles.refreshContainer}>
            <button type="button" onClick={handleRefresh} className={styles.button}>
              Refresh
            </button>
            {lastUpdated && (
              <span className={styles.lastUpdated}>
                Updated: {new Date(lastUpdated).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.projectsList}>
        {initialLoading ? (
          <div className={styles.empty}>Loading Claude projects...</div>
        ) : loading ? (
          <div className={styles.empty}>Loading...</div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>No Claude projects found</div>
        ) : (
          projects.map((project) => {
            const latestSession = project.sessions.length > 0 ? project.sessions[0] : null;
            return (
              <div key={project.projectPath} className={styles.projectCard}>
                <button
                  type="button"
                  onClick={() => handleProjectClick(project)}
                  className={styles.projectCardContent}
                >
                  <div className={styles.projectPath}>{project.projectPath}</div>
                  <div className={styles.projectInfo}>
                    <span>
                      {project.sessions.length} session{project.sessions.length !== 1 ? 's' : ''}
                    </span>
                    {latestSession && (
                      <span className={styles.lastModified}>
                        Last: {new Date(latestSession.lastModified).toLocaleString()}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  type="button"
                  className={styles.useInExecuteButton}
                  onClick={(e) => handleUseInExecute(project.projectPath, e)}
                  title="Use in Execute tab"
                >
                  ▶ Execute
                </button>
              </div>
            );
          })
        )}
      </div>

      <Pagination
        currentPage={currentPage}
        totalItems={totalProjects}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        itemName="projects"
      />
    </div>
  );
};
