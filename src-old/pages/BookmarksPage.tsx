import type React from 'react';
import { BookmarksPanel } from '../components/bookmarks/BookmarksPanel';
import styles from './BookmarksPage.module.css';

export const BookmarksPage: React.FC = () => {
  const handleResumeSession = (sessionId: string, query: string, projectPath: string) => {
    // TODO: Navigate to execute page with session resume
    console.log('Resume session:', sessionId, query, projectPath);
  };

  return (
    <div className={styles.container}>
      <BookmarksPanel onResumeSession={handleResumeSession} />
    </div>
  );
};
