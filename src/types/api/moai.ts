/**
 * MoAI API type contract
 */

export type MoaiStatuslinePreset = 'full' | 'compact' | 'minimal' | 'custom';

export interface MoaiSegmentsConfig {
  model: boolean;
  context: boolean;
  output_style: boolean;
  directory: boolean;
  git_status: boolean;
  claude_version: boolean;
  moai_version: boolean;
  git_branch: boolean;
}

export interface MoaiStatuslineConfig {
  preset: MoaiStatuslinePreset;
  segments: MoaiSegmentsConfig;
}

export interface MoaiStatuslineState {
  config: MoaiStatuslineConfig | null;
  configPath: string | null;
  scriptPath: string | null;
  claudeSettingsStatusLine: string | null;
  projectPath: string | null;
}

export interface MoaiAPI {
  getStatusline: () => Promise<MoaiStatuslineState>;
  saveStatuslineConfig: (
    config: MoaiStatuslineConfig,
  ) => Promise<{ success: boolean; error?: string }>;
  setClaudeStatusLine: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
  runPreview: () => Promise<{ output: string | null; error?: string }>;
}
