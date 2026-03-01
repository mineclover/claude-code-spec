/**
 * CLI Tool type definitions
 * Defines the schema for registering CLI tools and their options
 */

export type CLIOptionType = 'string' | 'number' | 'boolean' | 'select' | 'multiselect';

export interface CLIOptionSchema {
  key: string;
  label: string;
  type: CLIOptionType;
  description?: string;
  defaultValue?: unknown;
  required?: boolean;
  placeholder?: string;
  choices?: Array<{ label: string; value: string }>;
  cliFlag?: string; // e.g., '--model', '-p'
  group?: string; // grouping for UI
}

export type CLICommandCondition =
  | { op: 'exists'; key: string }
  | { op: 'truthy'; key: string }
  | { op: 'nonEmpty'; key: string }
  | { op: 'equals'; key: string; value: unknown }
  | { op: 'notEquals'; key: string; value: unknown }
  | { op: 'in'; key: string; values: unknown[] }
  | { op: 'all'; conditions: CLICommandCondition[] }
  | { op: 'any'; conditions: CLICommandCondition[] };

export interface CLICommandStaticSegment {
  type: 'static';
  args: string[];
  when?: CLICommandCondition;
}

export interface CLICommandOptionSegment {
  type: 'option';
  key: string;
  flag?: string;
  valueType?: 'string' | 'number' | 'boolean';
  trim?: boolean;
  includeIfEmpty?: boolean;
  when?: CLICommandCondition;
}

export interface CLICommandMappedSegment {
  type: 'mapped';
  key: string;
  map: Record<string, string[]>;
  when?: CLICommandCondition;
}

export interface CLICommandMcpLaunchPathConfig {
  key?: string;
  flag?: string;
}

export interface CLICommandMcpLaunchStrictConfig {
  key?: string;
  flag?: string;
  includeWhenConfigPresent?: boolean;
  allowWithoutConfig?: boolean;
}

export interface CLICommandMcpLaunchSegment {
  type: 'mcpLaunch';
  config?: CLICommandMcpLaunchPathConfig;
  strict?: CLICommandMcpLaunchStrictConfig;
  when?: CLICommandCondition;
}

export interface CLICommandConditionalSegment {
  type: 'conditional';
  when: CLICommandCondition;
  segments: CLICommandSegment[];
}

export interface CLICommandFallbackSegment {
  type: 'fallback';
  when?: CLICommandCondition;
  segments: CLICommandSegment[];
}

export type CLICommandSegment =
  | CLICommandStaticSegment
  | CLICommandOptionSegment
  | CLICommandMappedSegment
  | CLICommandMcpLaunchSegment
  | CLICommandConditionalSegment
  | CLICommandFallbackSegment;

export interface CLICommandSpec {
  executable: string;
  segments: CLICommandSegment[];
}

export interface CLIToolDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  options: CLIOptionSchema[];
  interpreterType: string; // maps to interpreter registry
  commandSpec: CLICommandSpec;
  stdinOptionKey?: string;
}

export interface CLIToolInterpreter {
  toolId: string;
  parseStreamLine(line: string): unknown | null;
}
