/**
 * Shared adapter SDK contracts for maintenance service integrations.
 * These contracts are used by built-in registrations and custom registry adapters.
 */

import type { CapabilityMatrix, CapabilityMatrixDeclaration } from './capability-matrix';
import type { ManagedCliTool, SkillProvider } from './tool-maintenance';

export const MCP_CONFIG_TARGETS = ['project', 'claude', 'codex', 'gemini'] as const;
export type McpConfigTarget = (typeof MCP_CONFIG_TARGETS)[number];

export type ToolAdapter = ManagedCliTool;

export interface SkillStoreAdapter {
  provider: SkillProvider;
  installRoot: string;
  disabledRoot: string;
  reference?: string;
}

export interface ExecutionAdapter {
  toolId: string;
  defaultOptions?: Record<string, unknown>;
}

export interface McpAdapter {
  defaultTargets: McpConfigTarget[];
  strictByDefault: boolean;
}

export interface MaintenanceServiceAdapter {
  id: string;
  displayName: string;
  capability: CapabilityMatrix;
  getManagedTools?(): ToolAdapter[];
  getSkillStore?(): SkillStoreAdapter | null;
  getExecution?(): ExecutionAdapter | null;
  getMcp?(): McpAdapter | null;
}

interface AdapterContracts {
  tools?: ToolAdapter[];
  skillStore?: SkillStoreAdapter;
  execution?: ExecutionAdapter;
  mcp?: McpAdapter;
}

type AtLeastOneContract =
  | Required<Pick<AdapterContracts, 'tools'>>
  | Required<Pick<AdapterContracts, 'skillStore'>>
  | Required<Pick<AdapterContracts, 'execution'>>
  | Required<Pick<AdapterContracts, 'mcp'>>;

type CapabilityArea = keyof CapabilityMatrixDeclaration;
type ContractKey = keyof AdapterContracts;

type IsAreaEnabled<
  Capability extends CapabilityMatrixDeclaration | undefined,
  Area extends CapabilityArea,
> = Area extends keyof NonNullable<Capability>
  ? NonNullable<Capability>[Area] extends { enabled: true }
    ? true
    : false
  : false;

type RequireContractWhenEnabled<
  Capability extends CapabilityMatrixDeclaration | undefined,
  Area extends CapabilityArea,
  Key extends ContractKey,
> = IsAreaEnabled<Capability, Area> extends true ? Required<Pick<AdapterContracts, Key>> : unknown;

export type MaintenanceServiceAdapterRegistration<
  Capability extends CapabilityMatrixDeclaration | undefined =
    | CapabilityMatrixDeclaration
    | undefined,
> = {
  id: string;
  displayName: string;
  capability?: Capability;
} & AdapterContracts &
  AtLeastOneContract &
  RequireContractWhenEnabled<Capability, 'maintenance', 'tools'> &
  RequireContractWhenEnabled<Capability, 'skills', 'skillStore'> &
  RequireContractWhenEnabled<Capability, 'execution', 'execution'> &
  RequireContractWhenEnabled<Capability, 'mcp', 'mcp'>;

export function defineMaintenanceServiceAdapter<
  const Capability extends CapabilityMatrixDeclaration | undefined,
>(adapter: MaintenanceServiceAdapterRegistration<Capability>) {
  return adapter;
}

export function defineMaintenanceServiceAdapters<
  const Adapters extends readonly MaintenanceServiceAdapterRegistration[],
>(adapters: Adapters) {
  return adapters;
}
