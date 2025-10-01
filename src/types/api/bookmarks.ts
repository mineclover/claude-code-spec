export interface SessionBookmark {
  id: string;
  sessionId: string;
  projectPath: string;
  description: string;
  timestamp: number;
  query?: string;
  tags?: string[];
}

export interface BookmarksAPI {
  // CRUD operations
  getAll: () => Promise<SessionBookmark[]>;
  get: (id: string) => Promise<SessionBookmark | null>;
  add: (bookmark: Omit<SessionBookmark, 'id' | 'timestamp'>) => Promise<SessionBookmark>;
  update: (
    id: string,
    updates: Partial<Omit<SessionBookmark, 'id' | 'timestamp'>>,
  ) => Promise<SessionBookmark | null>;
  delete: (id: string) => Promise<boolean>;

  // Query operations
  search: (query: string) => Promise<SessionBookmark[]>;
  getByProject: (projectPath: string) => Promise<SessionBookmark[]>;
  getByTag: (tag: string) => Promise<SessionBookmark[]>;

  // Utility
  clearAll: () => Promise<boolean>;
  export: (outputPath: string) => Promise<boolean>;
  import: (inputPath: string, merge?: boolean) => Promise<boolean>;
}
