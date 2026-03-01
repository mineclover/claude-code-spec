export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export interface DocsAPI {
  readDocsStructure: (rootPath: string) => Promise<FileNode[]>;
  readDocsFile: (filePath: string) => Promise<string>;
}
