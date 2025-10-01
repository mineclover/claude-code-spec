import { contextBridge, ipcRenderer } from 'electron';
import type { DocumentImprovement, DocumentMetadata, DocumentReview, MetadataAPI } from '../../types/api';

export function exposeMetadataAPI(): void {
  contextBridge.exposeInMainWorld('metadataAPI', {
    get: (filePath: string) => ipcRenderer.invoke('metadata:get', filePath),
    save: (metadata: DocumentMetadata) => ipcRenderer.invoke('metadata:save', metadata),
    addReview: (filePath: string, review: Omit<DocumentReview, 'id' | 'timestamp'>) =>
      ipcRenderer.invoke('metadata:add-review', filePath, review),
    addImprovement: (
      filePath: string,
      improvement: Omit<DocumentImprovement, 'id' | 'timestamp'>,
    ) => ipcRenderer.invoke('metadata:add-improvement', filePath, improvement),
    updateTags: (filePath: string, tags: string[]) =>
      ipcRenderer.invoke('metadata:update-tags', filePath, tags),
    updateKeywords: (filePath: string, keywords: string[]) =>
      ipcRenderer.invoke('metadata:update-keywords', filePath, keywords),
    updateImprovementStatus: (
      filePath: string,
      improvementId: string,
      status: 'pending' | 'in-progress' | 'completed',
    ) => ipcRenderer.invoke('metadata:update-improvement-status', filePath, improvementId, status),
    search: (query: string) => ipcRenderer.invoke('metadata:search', query),
  } as MetadataAPI);
}
