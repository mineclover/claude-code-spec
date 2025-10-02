import { contextBridge, ipcRenderer } from 'electron';

export function exposeFileAPI() {
  contextBridge.exposeInMainWorld('fileAPI', {
    readFile: (filePath: string): Promise<string> => {
      return ipcRenderer.invoke('file:read', filePath);
    },
    writeFile: (filePath: string, content: string): Promise<void> => {
      return ipcRenderer.invoke('file:write', filePath, content);
    },
  });
}
