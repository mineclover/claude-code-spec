import type React from 'react';
import { SessionsPanel } from '../components/sessions/SessionsPanel';
import styles from './SessionsPage.module.css';

export const SessionsPage: React.FC = () => {
  const handleResumeSession = async (sessionId: string, query: string) => {
    // TODO: Navigate to execute page with session resume
    console.log('Resume session:', sessionId, query);
  };

  const handleBookmarkSession = async (sessionId: string, query: string) => {
    const description = prompt('Enter bookmark description:', query.substring(0, 50));
    if (!description) return;

    try {
      const projectPath = ''; // Need to get from session
      await window.bookmarksAPI.add({
        sessionId,
        projectPath,
        description,
        query,
      });
      alert('Bookmark added successfully!');
    } catch (error) {
      console.error('Failed to add bookmark:', error);
      alert('Failed to add bookmark');
    }
  };

  return (
    <div className={styles.container}>
      <SessionsPanel
        onResumeSession={handleResumeSession}
        onBookmarkSession={handleBookmarkSession}
      />
    </div>
  );
};
