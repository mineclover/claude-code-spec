import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ClaudeProjectsList } from '../components/sessions/ClaudeProjectsList';
import type { ClaudeProjectInfo } from '../preload';
import {
  clearAllCache,
  getCachedProjectsPage,
  getCachedTotalCount,
  setCachedProjectsPage,
  setCachedTotalCount,
} from '../services/cache';
import styles from './ClaudeProjectsPage.module.css';

export const ClaudeProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [_hasMore, setHasMore] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const PAGE_SIZE = 10;

  const loadTotalCount = useCallback(async () => {
    try {
      // Try to get from cache first
      const cachedCount = await getCachedTotalCount();
      if (cachedCount !== null) {
        setTotalProjects(cachedCount);
        return;
      }

      // If cache miss, fetch from backend
      const total = await window.claudeSessionsAPI.getTotalCount();
      setTotalProjects(total);

      // Cache the result
      await setCachedTotalCount(total);
    } catch (error) {
      console.error('Failed to load total count:', error);
    }
  }, []);

  const loadClaudeProjects = useCallback(async (page: number) => {
    setLoading(true);
    try {
      // Try to get from cache first
      const cachedPage = await getCachedProjectsPage(page, PAGE_SIZE);
      if (cachedPage !== null) {
        setProjects(cachedPage.projects);
        setTotalProjects(cachedPage.total);
        setHasMore(cachedPage.hasMore);
        setLoading(false);
        setInitialLoading(false);
        return;
      }

      // If cache miss, fetch from backend
      const result = await window.claudeSessionsAPI.getAllProjectsPaginated(page, PAGE_SIZE);
      setProjects(result.projects);
      setTotalProjects(result.total);
      setHasMore(result.hasMore);
      setLastUpdated(Date.now());

      // Cache the result
      await setCachedProjectsPage(page, PAGE_SIZE, result.projects, result.total, result.hasMore);
    } catch (error) {
      console.error('Failed to load Claude projects:', error);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, []);

  // Load total count first (fast, cached)
  useEffect(() => {
    loadTotalCount();
  }, [loadTotalCount]);

  // Load projects when page changes
  useEffect(() => {
    loadClaudeProjects(currentPage);
  }, [currentPage, loadClaudeProjects]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleRefresh = async () => {
    // Clear all cache and reload current page
    await clearAllCache();
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
        lastUpdated={lastUpdated}
      />
    </div>
  );
};
