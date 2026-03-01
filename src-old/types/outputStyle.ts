export interface OutputStyle {
  name: string;
  description: string;
  type: 'builtin' | 'user' | 'project';
  instructions?: string; // Only for custom styles
  filePath?: string; // Path to .md file for custom styles
}

export interface OutputStyleListItem {
  name: string;
  description: string;
  type: 'builtin' | 'user' | 'project';
}
