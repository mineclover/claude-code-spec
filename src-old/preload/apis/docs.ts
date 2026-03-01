import { contextBridge, ipcRenderer } from 'electron';
import type { DocsAPI } from '../../types/api';

export function exposeDocsAPI(): void {
  contextBridge.exposeInMainWorld('docsAPI', {
    readDocsStructure: (rootPath: string) => ipcRenderer.invoke('docs:read-structure', rootPath),
    readDocsFile: (filePath: string) => ipcRenderer.invoke('docs:read-file', filePath),
  } as DocsAPI);
}
