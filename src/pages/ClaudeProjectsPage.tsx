import type React from 'react';
import { useEffect, useState } from 'react';
import { ClaudeProjectsList } from '../components/sessions/ClaudeProjectsList';
import type { ClaudeProjectInfo } from '../preload';
import styles from './ClaudeProjectsPage.module.css';

export const ClaudeProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 10;

  // Load total count first (fast, cached)
  useEffect(() => {
    loadTotalCount();
  }, []);

  // Load projects when page changes
  useEffect(() => {
    loadClaudeProjects(currentPage);
  }, [currentPage]);

  const loadTotalCount = async () => {
    try {
      const total = await window.claudeSessionsAPI.getTotalCount();
      setTotalProjects(total);
    } catch (error) {
      console.error('Failed to load total count:', error);
    }
  };

  const loadClaudeProjects = async (page: number) => {
    setLoading(true);
    try {
      const result = await window.claudeSessionsAPI.getAllProjectsPaginated(page, PAGE_SIZE);
      setProjects(result.projects);
      setTotalProjects(result.total);
      setHasMore(result.hasMore);
    } catch (error) {
      console.error('Failed to load Claude projects:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRefresh = async () => {
    // Clear cache and reload current page
    await window.claudeSessionsAPI.clearCountCache();
    await loadTotalCount();
    await loadClaudeProjects(currentPage);
  };

  return (
    <div className={styles.container}>
      <ClaudeProjectsList
        projects={projects}
        onRefresh={handleRefresh}
        currentPage={currentPage}
        totalProjects={totalProjects}
        pageSize={PAGE_SIZE}
        onPageChange={handlePageChange}
        loading={loading}
        initialLoading={initialLoading}
      />
    </div>
  );
};
