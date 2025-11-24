export interface TaskMetadata {
  id: string;
  title: string;
  area: string; // e.g., "Backend/Authentication", "Frontend/UI"
  assigned_agent: string; // e.g., "claude-sonnet-4"
  reviewer: string; // e.g., "claude-opus-4" or "human:john@example.com"
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  dependencies?: string[]; // Task IDs that must be completed first
}

export interface Task extends TaskMetadata {
  references: string[]; // File paths or URLs
  successCriteria: string[]; // List of criteria
  description: string;
  reviewNotes?: string; // Optional review notes from reviewer
}

export interface TaskListItem {
  id: string;
  title: string;
  area: string;
  status: TaskMetadata['status'];
  assigned_agent: string;
  reviewer: string;
  created: string;
  updated: string;
  filePath: string; // Relative path to the markdown file
}
