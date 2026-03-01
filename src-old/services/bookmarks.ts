/**
 * Session Bookmark Manager
 * Manages bookmarked sessions for quick access
 */

import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// ============================================================================
// Types
// ============================================================================

export interface SessionBookmark {
  id: string; // unique bookmark ID
  sessionId: string; // Claude session ID
  projectPath: string;
  description: string;
  timestamp: number;
  query?: string;
  tags?: string[];
}

export interface BookmarkStore {
  bookmarks: SessionBookmark[];
  lastModified: number;
}

// ============================================================================
// Storage
// ============================================================================

const getBookmarkFilePath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'session-bookmarks.json');
};

const loadBookmarks = (): BookmarkStore => {
  const filePath = getBookmarkFilePath();

  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as BookmarkStore;
    }
  } catch (error) {
    console.error('[Bookmarks] Failed to load bookmarks:', error);
  }

  return {
    bookmarks: [],
    lastModified: Date.now(),
  };
};

const saveBookmarks = (store: BookmarkStore): boolean => {
  const filePath = getBookmarkFilePath();

  try {
    store.lastModified = Date.now();
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf-8');
    console.log(`[Bookmarks] Saved ${store.bookmarks.length} bookmarks`);
    return true;
  } catch (error) {
    console.error('[Bookmarks] Failed to save bookmarks:', error);
    return false;
  }
};

// ============================================================================
// CRUD Operations
// ============================================================================

export const getAllBookmarks = (): SessionBookmark[] => {
  const store = loadBookmarks();
  return store.bookmarks.sort((a, b) => b.timestamp - a.timestamp);
};

export const getBookmark = (id: string): SessionBookmark | null => {
  const store = loadBookmarks();
  return store.bookmarks.find((b) => b.id === id) || null;
};

export const addBookmark = (
  bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>,
): SessionBookmark => {
  const store = loadBookmarks();

  const newBookmark: SessionBookmark = {
    ...bookmark,
    id: `bookmark-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
  };

  store.bookmarks.push(newBookmark);
  saveBookmarks(store);

  console.log(`[Bookmarks] Added bookmark: ${newBookmark.description}`);
  return newBookmark;
};

export const updateBookmark = (
  id: string,
  updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>,
): SessionBookmark | null => {
  const store = loadBookmarks();
  const index = store.bookmarks.findIndex((b) => b.id === id);

  if (index === -1) {
    console.error(`[Bookmarks] Bookmark not found: ${id}`);
    return null;
  }

  store.bookmarks[index] = {
    ...store.bookmarks[index],
    ...updates,
  };

  saveBookmarks(store);
  console.log(`[Bookmarks] Updated bookmark: ${id}`);
  return store.bookmarks[index];
};

export const deleteBookmark = (id: string): boolean => {
  const store = loadBookmarks();
  const initialLength = store.bookmarks.length;

  store.bookmarks = store.bookmarks.filter((b) => b.id !== id);

  if (store.bookmarks.length < initialLength) {
    saveBookmarks(store);
    console.log(`[Bookmarks] Deleted bookmark: ${id}`);
    return true;
  }

  return false;
};

// ============================================================================
// Query Operations
// ============================================================================

export const searchBookmarks = (query: string): SessionBookmark[] => {
  const store = loadBookmarks();
  const lowerQuery = query.toLowerCase();

  return store.bookmarks.filter(
    (b) =>
      b.description.toLowerCase().includes(lowerQuery) ||
      b.sessionId.toLowerCase().includes(lowerQuery) ||
      b.projectPath.toLowerCase().includes(lowerQuery) ||
      b.query?.toLowerCase().includes(lowerQuery) ||
      b.tags?.some((tag) => tag.toLowerCase().includes(lowerQuery)),
  );
};

export const getBookmarksByProject = (projectPath: string): SessionBookmark[] => {
  const store = loadBookmarks();
  return store.bookmarks.filter((b) => b.projectPath === projectPath);
};

export const getBookmarksByTag = (tag: string): SessionBookmark[] => {
  const store = loadBookmarks();
  return store.bookmarks.filter((b) => b.tags?.includes(tag));
};

// ============================================================================
// Utility
// ============================================================================

export const clearAllBookmarks = (): boolean => {
  const store: BookmarkStore = {
    bookmarks: [],
    lastModified: Date.now(),
  };
  return saveBookmarks(store);
};

export const exportBookmarks = (outputPath: string): boolean => {
  const store = loadBookmarks();
  try {
    fs.writeFileSync(outputPath, JSON.stringify(store, null, 2), 'utf-8');
    console.log(`[Bookmarks] Exported to: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('[Bookmarks] Export failed:', error);
    return false;
  }
};

export const importBookmarks = (inputPath: string, merge = true): boolean => {
  try {
    const content = fs.readFileSync(inputPath, 'utf-8');
    const imported = JSON.parse(content) as BookmarkStore;

    if (merge) {
      const current = loadBookmarks();
      const merged: BookmarkStore = {
        bookmarks: [...current.bookmarks, ...imported.bookmarks],
        lastModified: Date.now(),
      };
      return saveBookmarks(merged);
    }

    return saveBookmarks(imported);
  } catch (error) {
    console.error('[Bookmarks] Import failed:', error);
    return false;
  }
};
