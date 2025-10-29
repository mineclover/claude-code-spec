/**
 * Output-Style API Types
 */

export interface OutputStyle {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export interface OutputStyleAPI {
  listStyles: (projectPath: string) => Promise<OutputStyle[]>;
  getStyle: (projectPath: string, name: string) => Promise<OutputStyle | null>;
  createStyle: (
    projectPath: string,
    style: Omit<OutputStyle, 'filePath'>
  ) => Promise<{ success: boolean; error?: string; style?: OutputStyle }>;
  updateStyle: (
    projectPath: string,
    name: string,
    style: Omit<OutputStyle, 'filePath'>
  ) => Promise<{ success: boolean; error?: string }>;
  deleteStyle: (projectPath: string, name: string) => Promise<{ success: boolean; error?: string }>;
  listNames: (projectPath: string) => Promise<string[]>;
}
