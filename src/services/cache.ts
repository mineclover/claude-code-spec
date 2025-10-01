/**
 * Dexie-based client-side caching service
 * Stores project counts, paginated project data, and session data in IndexedDB
 */

import Dexie, { type Table } from 'dexie';
import type { ClaudeProjectInfo, ClaudeSessionInfo } from '../preload';

// ============================================================================
// Types
// ============================================================================

interface CachedCount {
  id: string; // Always 'total_count' for singleton
  count: number;
  timestamp: number;
}

interface CachedProjectsPage {
  id: string; // Format: 'page_{pageNumber}_{pageSize}'
  page: number;
  pageSize: number;
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
  timestamp: number;
}

interface CachedSessionsPage {
  id: string; // Format: 'sessions_{projectPath}_{page}_{pageSize}'
  projectPath: string;
  page: number;
  pageSize: number;
  sessions: ClaudeSessionInfo[];
  total: number;
  hasMore: boolean;
  timestamp: number;
}

// ============================================================================
// Dexie Database
// ============================================================================

class ClaudeCacheDB extends Dexie {
  counts!: Table<CachedCount, string>;
  projectPages!: Table<CachedProjectsPage, string>;
  sessionPages!: Table<CachedSessionsPage, string>;

  constructor() {
    super('ClaudeCacheDB');
    this.version(2).stores({
      counts: 'id, timestamp',
      projectPages: 'id, page, timestamp',
      sessionPages: 'id, projectPath, page, timestamp',
    });
  }
}

const db = new ClaudeCacheDB();

// ============================================================================
// Cache Configuration
// ============================================================================

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_DURATION;
};

// ============================================================================
// Count Caching
// ============================================================================

export const getCachedTotalCount = async (): Promise<number | null> => {
  try {
    const cached = await db.counts.get('total_count');
    if (cached && isCacheValid(cached.timestamp)) {
      console.log('[Cache] Using cached total count:', cached.count);
      return cached.count;
    }
    console.log('[Cache] Total count cache expired or missing');
    return null;
  } catch (error) {
    console.error('[Cache] Failed to get cached count:', error);
    return null;
  }
};

export const setCachedTotalCount = async (count: number): Promise<void> => {
  try {
    await db.counts.put({
      id: 'total_count',
      count,
      timestamp: Date.now(),
    });
    console.log('[Cache] Stored total count:', count);
  } catch (error) {
    console.error('[Cache] Failed to cache count:', error);
  }
};

export const clearTotalCountCache = async (): Promise<void> => {
  try {
    await db.counts.delete('total_count');
    console.log('[Cache] Cleared total count cache');
  } catch (error) {
    console.error('[Cache] Failed to clear count cache:', error);
  }
};

// ============================================================================
// Projects Page Caching
// ============================================================================

const getPageId = (page: number, pageSize: number): string => {
  return `page_${page}_${pageSize}`;
};

export const getCachedProjectsPage = async (
  page: number,
  pageSize: number,
): Promise<{
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
} | null> => {
  try {
    const pageId = getPageId(page, pageSize);
    const cached = await db.projectPages.get(pageId);

    if (cached && isCacheValid(cached.timestamp)) {
      console.log('[Cache] Using cached projects page:', page);
      return {
        projects: cached.projects,
        total: cached.total,
        hasMore: cached.hasMore,
      };
    }
    console.log('[Cache] Projects page cache expired or missing:', page);
    return null;
  } catch (error) {
    console.error('[Cache] Failed to get cached projects page:', error);
    return null;
  }
};

export const setCachedProjectsPage = async (
  page: number,
  pageSize: number,
  projects: ClaudeProjectInfo[],
  total: number,
  hasMore: boolean,
): Promise<void> => {
  try {
    const pageId = getPageId(page, pageSize);
    await db.projectPages.put({
      id: pageId,
      page,
      pageSize,
      projects,
      total,
      hasMore,
      timestamp: Date.now(),
    });
    console.log('[Cache] Stored projects page:', page);
  } catch (error) {
    console.error('[Cache] Failed to cache projects page:', error);
  }
};

export const clearProjectsPagesCache = async (): Promise<void> => {
  try {
    await db.projectPages.clear();
    console.log('[Cache] Cleared all projects pages cache');
  } catch (error) {
    console.error('[Cache] Failed to clear projects pages cache:', error);
  }
};

// ============================================================================
// Sessions Page Caching
// ============================================================================

const getSessionsPageId = (projectPath: string, page: number, pageSize: number): string => {
  // URL-encode projectPath to avoid special characters in ID
  const encodedPath = encodeURIComponent(projectPath);
  return `sessions_${encodedPath}_${page}_${pageSize}`;
};

export const getCachedSessionsPage = async (
  projectPath: string,
  page: number,
  pageSize: number,
): Promise<{
  sessions: ClaudeSessionInfo[];
  total: number;
  hasMore: boolean;
} | null> => {
  try {
    const pageId = getSessionsPageId(projectPath, page, pageSize);
    const cached = await db.sessionPages.get(pageId);

    if (cached && isCacheValid(cached.timestamp)) {
      console.log('[Cache] Using cached sessions page:', projectPath, page);
      return {
        sessions: cached.sessions,
        total: cached.total,
        hasMore: cached.hasMore,
      };
    }
    console.log('[Cache] Sessions page cache expired or missing:', projectPath, page);
    return null;
  } catch (error) {
    console.error('[Cache] Failed to get cached sessions page:', error);
    return null;
  }
};

export const setCachedSessionsPage = async (
  projectPath: string,
  page: number,
  pageSize: number,
  sessions: ClaudeSessionInfo[],
  total: number,
  hasMore: boolean,
): Promise<void> => {
  try {
    const pageId = getSessionsPageId(projectPath, page, pageSize);
    await db.sessionPages.put({
      id: pageId,
      projectPath,
      page,
      pageSize,
      sessions,
      total,
      hasMore,
      timestamp: Date.now(),
    });
    console.log('[Cache] Stored sessions page:', projectPath, page);
  } catch (error) {
    console.error('[Cache] Failed to cache sessions page:', error);
  }
};

export const clearSessionsPagesCache = async (projectPath?: string): Promise<void> => {
  try {
    if (projectPath) {
      // Clear only sessions for specific project
      const sessions = await db.sessionPages.where('projectPath').equals(projectPath).toArray();
      await Promise.all(sessions.map((s) => db.sessionPages.delete(s.id)));
      console.log('[Cache] Cleared sessions cache for project:', projectPath);
    } else {
      // Clear all sessions
      await db.sessionPages.clear();
      console.log('[Cache] Cleared all sessions pages cache');
    }
  } catch (error) {
    console.error('[Cache] Failed to clear sessions pages cache:', error);
  }
};

// ============================================================================
// Full Cache Clear
// ============================================================================

export const clearAllCache = async (): Promise<void> => {
  try {
    await Promise.all([db.counts.clear(), db.projectPages.clear(), db.sessionPages.clear()]);
    console.log('[Cache] Cleared all cache');
  } catch (error) {
    console.error('[Cache] Failed to clear all cache:', error);
  }
};
