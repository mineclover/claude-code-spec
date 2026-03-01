/**
 * Standard capability matrix used across all CLI/service adapters.
 * Each area can be explicitly enabled/disabled per service.
 */

export const CAPABILITY_AREAS = ['maintenance', 'execution', 'skills', 'mcp'] as const;
export type CapabilityArea = (typeof CAPABILITY_AREAS)[number];

export interface CapabilityAreaSwitch {
  enabled: boolean;
}

export interface CapabilityMatrix {
  maintenance: CapabilityAreaSwitch;
  execution: CapabilityAreaSwitch;
  skills: CapabilityAreaSwitch;
  mcp: CapabilityAreaSwitch;
}

export interface CapabilityMatrixDeclaration {
  maintenance?: Partial<CapabilityAreaSwitch>;
  execution?: Partial<CapabilityAreaSwitch>;
  skills?: Partial<CapabilityAreaSwitch>;
  mcp?: Partial<CapabilityAreaSwitch>;
}
