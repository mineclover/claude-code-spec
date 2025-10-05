import type { OutputStyle, OutputStyleListItem } from '../outputStyle';

export interface OutputStyleAPI {
  listOutputStyles: (args: { projectPath: string }) => Promise<OutputStyleListItem[]>;
  getOutputStyle: (args: { name: string; projectPath: string }) => Promise<OutputStyle | null>;
  createOutputStyle: (args: {
    name: string;
    description: string;
    instructions: string;
    type: 'user' | 'project';
    projectPath: string;
  }) => Promise<void>;
  updateOutputStyle: (args: {
    name: string;
    description: string;
    instructions: string;
    type: 'user' | 'project';
    projectPath: string;
  }) => Promise<void>;
  deleteOutputStyle: (args: {
    name: string;
    type: 'user' | 'project';
    projectPath: string;
  }) => Promise<void>;
}
