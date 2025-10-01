/**
 * Bookmarks IPC Handlers
 * Handles session bookmark operations
 */

import type { SessionBookmark } from '../../services/bookmarks';
import {
  addBookmark,
  clearAllBookmarks,
  deleteBookmark,
  exportBookmarks,
  getAllBookmarks,
  getBookmark,
  getBookmarksByProject,
  getBookmarksByTag,
  importBookmarks,
  searchBookmarks,
  updateBookmark,
} from '../../services/bookmarks';
import type { IPCRouter } from '../IPCRouter';

export function registerBookmarksHandlers(router: IPCRouter): void {
  // Get all bookmarks
  router.handle('get-all', async () => {
    return getAllBookmarks();
  });

  // Get single bookmark
  router.handle('get', async (_event, id: string) => {
    return getBookmark(id);
  });

  // Add bookmark
  router.handle('add', async (_event, bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>) => {
    return addBookmark(bookmark);
  });

  // Update bookmark
  router.handle(
    'update',
    async (_event, id: string, updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>) => {
      return updateBookmark(id, updates);
    },
  );

  // Delete bookmark
  router.handle('delete', async (_event, id: string) => {
    return deleteBookmark(id);
  });

  // Search bookmarks
  router.handle('search', async (_event, query: string) => {
    return searchBookmarks(query);
  });

  // Get bookmarks by project
  router.handle('get-by-project', async (_event, projectPath: string) => {
    return getBookmarksByProject(projectPath);
  });

  // Get bookmarks by tag
  router.handle('get-by-tag', async (_event, tag: string) => {
    return getBookmarksByTag(tag);
  });

  // Clear all bookmarks
  router.handle('clear-all', async () => {
    return clearAllBookmarks();
  });

  // Export bookmarks
  router.handle('export', async (_event, outputPath: string) => {
    return exportBookmarks(outputPath);
  });

  // Import bookmarks
  router.handle('import', async (_event, inputPath: string, merge: boolean = true) => {
    return importBookmarks(inputPath, merge);
  });
}
