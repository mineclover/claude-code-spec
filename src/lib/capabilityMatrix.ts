import type {
  CapabilityAreaSwitch,
  CapabilityMatrix,
  CapabilityMatrixDeclaration,
} from '../types/capability-matrix';

export const SAFE_CAPABILITY_MATRIX: CapabilityMatrix = {
  maintenance: { enabled: false },
  execution: { enabled: false },
  skills: { enabled: false },
  mcp: { enabled: false },
};

interface CapabilityMatrixFallbacks {
  maintenance?: boolean;
  execution?: boolean;
  skills?: boolean;
  mcp?: boolean;
}

function toAreaSwitch(
  declared: Partial<CapabilityAreaSwitch> | undefined,
  fallbackEnabled: boolean,
): CapabilityAreaSwitch {
  return {
    enabled: typeof declared?.enabled === 'boolean' ? declared.enabled : fallbackEnabled,
  };
}

export function resolveCapabilityMatrix(
  declared: CapabilityMatrixDeclaration | undefined,
  fallbacks: CapabilityMatrixFallbacks = {},
): CapabilityMatrix {
  return {
    maintenance: toAreaSwitch(
      declared?.maintenance,
      fallbacks.maintenance ?? SAFE_CAPABILITY_MATRIX.maintenance.enabled,
    ),
    execution: toAreaSwitch(
      declared?.execution,
      fallbacks.execution ?? SAFE_CAPABILITY_MATRIX.execution.enabled,
    ),
    skills: toAreaSwitch(
      declared?.skills,
      fallbacks.skills ?? SAFE_CAPABILITY_MATRIX.skills.enabled,
    ),
    mcp: toAreaSwitch(declared?.mcp, fallbacks.mcp ?? SAFE_CAPABILITY_MATRIX.mcp.enabled),
  };
}
