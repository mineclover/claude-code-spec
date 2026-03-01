/**
 * User-configurable maintenance service registry schema
 */

import type { CapabilityMatrixDeclaration } from './capability-matrix';

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
  provider?: string;
  installRoot: string;
  disabledRoot?: string;
  reference?: string;
}

export interface MaintenanceRegistryService {
  id: string;
  name?: string;
  enabled?: boolean;
  capability?: CapabilityMatrixDeclaration;
  tools?: MaintenanceRegistryTool[];
  skillStore?: MaintenanceRegistrySkillStore;
}
