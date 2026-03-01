/**
 * User-configurable maintenance service registry schema
 */

import type { CapabilityMatrixDeclaration } from './capability-matrix';
import type { ExecutionAdapter, McpAdapter, McpConfigTarget } from './maintenance-adapter-sdk';
import type { SkillProvider } from './tool-maintenance';

export interface MaintenanceRegistryCommand {
  command: string;
  args?: string[];
}

export interface MaintenanceRegistryTool {
  id: string;
  name: string;
  description?: string;
  versionCommand: MaintenanceRegistryCommand;
  updateCommand: MaintenanceRegistryCommand;
  docsUrl?: string;
}

export interface MaintenanceRegistrySkillStore {
  provider?: SkillProvider;
  installRoot: string;
  disabledRoot?: string;
  reference?: string;
}

export interface MaintenanceRegistryExecution {
  toolId?: ExecutionAdapter['toolId'];
  defaultOptions?: ExecutionAdapter['defaultOptions'];
}

export interface MaintenanceRegistryMcp {
  defaultTargets?: McpConfigTarget[];
  strictByDefault?: McpAdapter['strictByDefault'];
}

export interface MaintenanceRegistryService {
  id: string;
  name?: string;
  enabled?: boolean;
  capability?: CapabilityMatrixDeclaration;
  tools?: MaintenanceRegistryTool[];
  skillStore?: MaintenanceRegistrySkillStore;
  execution?: MaintenanceRegistryExecution;
  mcp?: MaintenanceRegistryMcp;
}
