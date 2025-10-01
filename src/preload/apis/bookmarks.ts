import { contextBridge, ipcRenderer } from 'electron';
import type { BookmarksAPI, SessionBookmark } from '../../types/api';

export function exposeBookmarksAPI(): void {
  contextBridge.exposeInMainWorld('bookmarksAPI', {
    getAll: () => ipcRenderer.invoke('bookmarks:get-all'),

    get: (id: string) => ipcRenderer.invoke('bookmarks:get', id),

    add: (bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>) =>
      ipcRenderer.invoke('bookmarks:add', bookmark),

    update: (id: string, updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>) =>
      ipcRenderer.invoke('bookmarks:update', id, updates),

    delete: (id: string) => ipcRenderer.invoke('bookmarks:delete', id),

    search: (query: string) => ipcRenderer.invoke('bookmarks:search', query),

    getByProject: (projectPath: string) =>
      ipcRenderer.invoke('bookmarks:get-by-project', projectPath),

    getByTag: (tag: string) => ipcRenderer.invoke('bookmarks:get-by-tag', tag),

    clearAll: () => ipcRenderer.invoke('bookmarks:clear-all'),

    export: (outputPath: string) => ipcRenderer.invoke('bookmarks:export', outputPath),

    import: (inputPath: string, merge?: boolean) =>
      ipcRenderer.invoke('bookmarks:import', inputPath, merge),
  } as BookmarksAPI);
}
