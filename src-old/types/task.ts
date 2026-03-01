// Phase 4: Conditional branching
export interface ConditionalBranch {
  condition: (result: any) => boolean; // Condition function (serialized as string)
  targetTaskId: string; // Task to execute if condition is true
}

// Phase 4: Human-in-the-loop
export interface ApprovalConfig {
  required: boolean; // Whether approval is required before execution
  message: string; // Message to show to approver
  approver?: string; // Optional specific approver (e.g., "human:john@example.com")
  timeout?: number; // Optional timeout in milliseconds
}

export interface TaskMetadata {
  id: string;
  title: string;
  area: string; // e.g., "Backend/Authentication", "Frontend/UI"
  assigned_agent: string; // e.g., "claude-sonnet-4"
  reviewer: string; // e.g., "claude-opus-4" or "human:john@example.com"
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'awaiting_approval';
  created: string; // ISO 8601 timestamp
  updated: string; // ISO 8601 timestamp
  dependencies?: string[]; // Task IDs that must be completed first

  // Phase 4: Advanced features
  conditionalBranches?: ConditionalBranch[]; // Conditional routing based on result
  approval?: ApprovalConfig; // Human-in-the-loop approval configuration
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
