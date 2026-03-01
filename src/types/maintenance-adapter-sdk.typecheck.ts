import { defineMaintenanceServiceAdapter } from './maintenance-adapter-sdk';

const TOOL_TEMPLATE = {
  id: 'sample-cli',
  name: 'Sample CLI',
  description: 'Sample CLI',
  versionCommand: { command: 'sample', args: ['--version'] },
  updateCommand: { command: 'npm', args: ['install', '-g', 'sample@latest'] },
};

void defineMaintenanceServiceAdapter({
  id: 'sample',
  displayName: 'Sample',
  capability: {
    maintenance: { enabled: true },
    execution: { enabled: true },
    skills: { enabled: true },
    mcp: { enabled: true },
  },
  tools: [TOOL_TEMPLATE],
  skillStore: {
    provider: 'sample',
    installRoot: '~/.sample/skills',
    disabledRoot: '~/.sample/skills-disabled',
  },
  execution: {
    toolId: 'sample-cli',
  },
  mcp: {
    defaultTargets: ['project'],
    strictByDefault: false,
  },
});

// @ts-expect-error maintenance enabled requires tools contract
void defineMaintenanceServiceAdapter({
  id: 'missing-tools',
  displayName: 'Missing Tools',
  capability: {
    maintenance: { enabled: true },
  },
});

// @ts-expect-error skills enabled requires skillStore contract
void defineMaintenanceServiceAdapter({
  id: 'missing-skill-store',
  displayName: 'Missing Skill Store',
  capability: {
    skills: { enabled: true },
  },
  tools: [TOOL_TEMPLATE],
});

// @ts-expect-error execution enabled requires execution contract
void defineMaintenanceServiceAdapter({
  id: 'missing-execution',
  displayName: 'Missing Execution',
  capability: {
    execution: { enabled: true },
  },
  tools: [TOOL_TEMPLATE],
});

// @ts-expect-error mcp enabled requires mcp contract
void defineMaintenanceServiceAdapter({
  id: 'missing-mcp',
  displayName: 'Missing MCP',
  capability: {
    mcp: { enabled: true },
  },
  tools: [TOOL_TEMPLATE],
});
