import type React from 'react';
import { useEffect, useState } from 'react';
import type { SessionBookmark } from '../../preload';
import styles from './BookmarksPanel.module.css';

interface BookmarksPanelProps {
  projectPath: string;
  onResumeSession?: (sessionId: string, query: string) => void;
}

export const BookmarksPanel: React.FC<BookmarksPanelProps> = ({ projectPath, onResumeSession }) => {
  const [bookmarks, setBookmarks] = useState<SessionBookmark[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBookmarks();
  }, [projectPath]);

  const loadBookmarks = async () => {
    setLoading(true);
    try {
      const allBookmarks = await window.bookmarksAPI.getByProject(projectPath);
      setBookmarks(allBookmarks);
    } catch (error) {
      console.error('Failed to load bookmarks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadBookmarks();
      return;
    }

    try {
      const results = await window.bookmarksAPI.search(searchQuery);
      // Filter by current project
      setBookmarks(results.filter((b) => b.projectPath === projectPath));
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this bookmark?')) {
      return;
    }

    try {
      await window.bookmarksAPI.delete(id);
      loadBookmarks();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handleResume = (bookmark: SessionBookmark) => {
    if (onResumeSession && bookmark.query) {
      onResumeSession(bookmark.sessionId, bookmark.query);
    }
  };

  if (loading) {
    return <div className={styles.container}>Loading bookmarks...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Session Bookmarks</h3>
        <div className={styles.searchBox}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search bookmarks..."
            className={styles.searchInput}
          />
          <button type="button" onClick={handleSearch} className={styles.searchButton}>
            Search
          </button>
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                loadBookmarks();
              }}
              className={styles.clearButton}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {bookmarks.length === 0 ? (
        <div className={styles.empty}>No bookmarks found for this project</div>
      ) : (
        <div className={styles.list}>
          {bookmarks.map((bookmark) => (
            <div key={bookmark.id} className={styles.bookmarkItem}>
              <div className={styles.bookmarkHeader}>
                <span className={styles.description}>{bookmark.description}</span>
                <span className={styles.timestamp}>
                  {new Date(bookmark.timestamp).toLocaleString()}
                </span>
              </div>

              <div className={styles.bookmarkBody}>
                <div className={styles.sessionId}>
                  Session: <code>{bookmark.sessionId}</code>
                </div>
                {bookmark.query && (
                  <div className={styles.query}>
                    Query: <code>{bookmark.query}</code>
                  </div>
                )}
                {bookmark.tags && bookmark.tags.length > 0 && (
                  <div className={styles.tags}>
                    {bookmark.tags.map((tag) => (
                      <span key={tag} className={styles.tag}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.bookmarkActions}>
                {bookmark.query && (
                  <button
                    type="button"
                    onClick={() => handleResume(bookmark)}
                    className={styles.resumeButton}
                  >
                    Resume
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDelete(bookmark.id)}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
