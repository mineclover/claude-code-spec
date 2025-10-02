export interface ClaudeSessionEntry {
  type: string;
  summary?: string;
  leafUuid?: string;
  isSidechain?: boolean; // Indicates if this event is from a sub-agent
  [key: string]: unknown;
}

export interface ClaudeProjectInfo {
  projectPath: string; // Actual cwd from session data
  projectDirName: string; // Directory name format (-Users-junwoobang-...)
  claudeProjectDir: string;
  sessions: ClaudeSessionInfo[];
}

export interface ClaudeSessionInfo {
  sessionId: string;
  filePath: string;
  fileSize: number;
  lastModified: number;
  cwd?: string; // Actual project path from session data
  firstUserMessage?: string; // First user message content
  hasData: boolean; // Whether session has any data
}

export interface PaginatedSessionsResult {
  sessions: Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[];
  total: number;
  hasMore: boolean;
}

export interface PaginatedProjectsResult {
  projects: ClaudeProjectInfo[];
  total: number;
  hasMore: boolean;
}

export interface ClaudeSessionsAPI {
  // Get all projects with Claude sessions
  getAllProjects: () => Promise<ClaudeProjectInfo[]>;

  // Get total project count
  getTotalCount: () => Promise<number>;

  // Get paginated projects with Claude sessions
  getAllProjectsPaginated: (page: number, pageSize: number) => Promise<PaginatedProjectsResult>;

  // Get sessions for a specific project
  getProjectSessions: (projectPath: string) => Promise<ClaudeSessionInfo[]>;

  // Get basic session info (fast, without metadata)
  getProjectSessionsBasic: (
    projectPath: string,
  ) => Promise<Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[]>;

  // Get paginated sessions
  getProjectSessionsPaginated: (
    projectPath: string,
    page: number,
    pageSize: number,
  ) => Promise<PaginatedSessionsResult>;

  // Get total session count
  getProjectSessionCount: (projectPath: string) => Promise<number>;

  // Get metadata for a single session
  getSessionMetadata: (
    projectPath: string,
    sessionId: string,
  ) => Promise<Pick<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>>;

  // Read session log
  readLog: (projectPath: string, sessionId: string) => Promise<ClaudeSessionEntry[]>;

  // Get session summary
  getSummary: (projectPath: string, sessionId: string) => Promise<string | null>;

  // Get session preview (first user message)
  getPreview: (projectPath: string, sessionId: string) => Promise<string | null>;

  // Open logs folder in system file explorer
  openLogsFolder: () => Promise<void>;

  // Open project folder in system file explorer
  openProjectFolder: (projectPath: string) => Promise<void>;
}
