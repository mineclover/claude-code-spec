/**
 * Minimal onboarding template for adding a new maintenance adapter in code.
 * Copy this into serviceIntegrations and adjust command/package identifiers.
 */

import { defineMaintenanceServiceAdapter } from '../../types/maintenance-adapter-sdk';

export function createNpmMaintenanceAdapterTemplate(serviceId = 'new-cli') {
  const packageName = `${serviceId}@latest`;

  return defineMaintenanceServiceAdapter({
    id: serviceId,
    displayName: 'New CLI',
    capability: {
      maintenance: { enabled: true },
      execution: { enabled: true },
      mcp: { enabled: true },
    },
    tools: [
      {
        id: serviceId,
        name: 'New CLI',
        description: 'Template for npm-managed CLI',
        versionCommand: { command: serviceId, args: ['--version'] },
        updateCommand: { command: 'npm', args: ['install', '-g', packageName] },
      },
    ],
    execution: {
      toolId: serviceId,
    },
    mcp: {
      defaultTargets: ['project'],
      strictByDefault: false,
    },
  });
}
