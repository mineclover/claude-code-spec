import type React from 'react';
import { useEffect, useState } from 'react';
import { ClaudeProjectsList } from '../components/sessions/ClaudeProjectsList';
import type { ClaudeProjectInfo } from '../preload';
import styles from './ClaudeProjectsPage.module.css';

export const ClaudeProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClaudeProjects();
  }, []);

  const loadClaudeProjects = async () => {
    setLoading(true);
    try {
      const allProjects = await window.claudeSessionsAPI.getAllProjects();
      setProjects(allProjects);
    } catch (error) {
      console.error('Failed to load Claude projects:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading Claude projects...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <ClaudeProjectsList projects={projects} onRefresh={loadClaudeProjects} />
    </div>
  );
};
