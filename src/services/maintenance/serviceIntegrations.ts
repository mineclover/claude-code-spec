/**
 * Maintenance service integrations
 * - Each integration can contribute CLI maintenance tools and/or skill store roots.
 * - New services can be added via app settings registry.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { resolveCapabilityMatrix } from '../../lib/capabilityMatrix';
import { dedupeByLast } from '../../lib/collectionUtils';
import type { CapabilityMatrixDeclaration } from '../../types/capability-matrix';
import {
  defineMaintenanceServiceAdapter,
  defineMaintenanceServiceAdapters,
  type ExecutionAdapter,
  type MaintenanceServiceAdapter,
  type MaintenanceServiceAdapterRegistration,
  MCP_CONFIG_TARGETS,
  type McpAdapter,
  type McpConfigTarget,
  type SkillStoreAdapter,
  type ToolAdapter,
} from '../../types/maintenance-adapter-sdk';
import type { MaintenanceRegistryService } from '../../types/maintenance-registry';
import type { CommandSpec, SkillInstallPathInfo } from '../../types/tool-maintenance';

export type {
  ExecutionAdapter,
  MaintenanceServiceAdapter,
  McpAdapter,
  SkillStoreAdapter,
  ToolAdapter,
} from '../../types/maintenance-adapter-sdk';

const SKILLS_REFERENCE = 'references/vercel-labs-skills/src/agents.ts';

interface CustomCommandSpecLike {
  command?: unknown;
  args?: unknown;
}

interface CustomManagedToolLike {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  versionCommand?: unknown;
  updateCommand?: unknown;
  docsUrl?: unknown;
}

interface CustomSkillStoreLike {
  provider?: unknown;
  installRoot?: unknown;
  disabledRoot?: unknown;
  reference?: unknown;
}

interface CustomExecutionLike {
  toolId?: unknown;
  defaultOptions?: unknown;
}

interface CustomMcpLike {
  defaultTargets?: unknown;
  strictByDefault?: unknown;
}

interface CustomServiceLike {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  capability?: unknown;
  tools?: unknown;
  skillStore?: unknown;
  execution?: unknown;
  mcp?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolvePathTemplate(input: string, env: NodeJS.ProcessEnv): string {
  let resolved = input;
  resolved = resolved.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_token, variableName) => {
    const value = env[variableName];
    return typeof value === 'string' ? value : '';
  });

  if (resolved === '~') {
    return os.homedir();
  }
  if (resolved.startsWith('~/')) {
    return path.join(os.homedir(), resolved.slice(2));
  }
  return resolved;
}

function normalizeDir(input: string, env: NodeJS.ProcessEnv): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  return resolvePathTemplate(trimmed, env);
}

function normalizeCommandSpec(raw: unknown, env: NodeJS.ProcessEnv): CommandSpec | null {
  if (!isRecord(raw)) {
    return null;
  }

  const source = raw as CustomCommandSpecLike;
  const command = readString(source.command);
  if (!command) {
    return null;
  }

  const args =
    Array.isArray(source.args) && source.args.every((item) => typeof item === 'string')
      ? source.args.map((item) => resolvePathTemplate(item, env))
      : [];

  return {
    command: resolvePathTemplate(command, env),
    args,
  };
}

function defaultDisabledRoot(installRoot: string): string {
  const base = path.basename(installRoot);
  if (base.endsWith('skills')) {
    return path.join(path.dirname(installRoot), `${base}-disabled`);
  }
  return `${installRoot}-disabled`;
}

function createRuntimeAdapter({
  id,
  displayName,
  capability,
  tools,
  skillStore,
  execution,
  mcp,
}: {
  id: string;
  displayName: string;
  capability: ReturnType<typeof resolveCapabilityMatrix>;
  tools?: ToolAdapter[];
  skillStore?: SkillStoreAdapter;
  execution?: ExecutionAdapter;
  mcp?: McpAdapter;
}): MaintenanceServiceAdapter {
  return {
    id,
    displayName,
    capability,
    getManagedTools: tools && tools.length > 0 ? () => [...tools] : undefined,
    getSkillStore: skillStore ? () => skillStore : undefined,
    getExecution: execution ? () => ({ ...execution }) : undefined,
    getMcp: mcp ? () => ({ ...mcp, defaultTargets: [...mcp.defaultTargets] }) : undefined,
  };
}

function createAdapterFromRegistration(
  registration: MaintenanceServiceAdapterRegistration,
): MaintenanceServiceAdapter {
  const capability = resolveCapabilityMatrix(registration.capability, {
    maintenance: Boolean(registration.tools?.length),
    skills: Boolean(registration.skillStore),
    execution: Boolean(registration.execution),
    mcp: Boolean(registration.mcp),
  });

  const tools = capability.maintenance.enabled ? (registration.tools ?? []) : [];
  const skillStore = capability.skills.enabled ? (registration.skillStore ?? undefined) : undefined;
  const execution = capability.execution.enabled
    ? (registration.execution ?? undefined)
    : undefined;
  const mcp = capability.mcp.enabled ? (registration.mcp ?? undefined) : undefined;

  return createRuntimeAdapter({
    id: registration.id,
    displayName: registration.displayName,
    capability,
    tools,
    skillStore,
    execution,
    mcp,
  });
}

function normalizeCustomTool(
  raw: unknown,
  serviceName: string,
  env: NodeJS.ProcessEnv,
): ToolAdapter | null {
  if (!isRecord(raw)) {
    return null;
  }
  const source = raw as CustomManagedToolLike;
  const id = readString(source.id);
  const name = readString(source.name);
  const versionCommand = normalizeCommandSpec(source.versionCommand, env);
  const updateCommand = normalizeCommandSpec(source.updateCommand, env);

  if (!id || !name || !versionCommand || !updateCommand) {
    return null;
  }

  return {
    id,
    name,
    description: readString(source.description) ?? `${serviceName} CLI`,
    versionCommand,
    updateCommand,
    docsUrl: readString(source.docsUrl) ?? undefined,
  };
}

function normalizeCustomSkillStore(
  serviceId: string,
  raw: unknown,
  env: NodeJS.ProcessEnv,
): SkillStoreAdapter | null {
  if (!isRecord(raw)) {
    return null;
  }
  const source = raw as CustomSkillStoreLike;
  const installRootRaw = readString(source.installRoot);
  if (!installRootRaw) {
    return null;
  }

  const installRoot = normalizeDir(installRootRaw, env);
  const disabledRoot = normalizeDir(
    readString(source.disabledRoot) ?? defaultDisabledRoot(installRoot),
    env,
  );
  const provider = readString(source.provider) ?? serviceId;

  return {
    provider,
    installRoot,
    disabledRoot,
    reference: readString(source.reference) ?? undefined,
  };
}

function normalizeExecutionDeclaration(raw: unknown): Partial<ExecutionAdapter> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const source = raw as CustomExecutionLike;
  const toolId = readString(source.toolId) ?? undefined;
  const defaultOptions = isRecord(source.defaultOptions)
    ? ({ ...source.defaultOptions } as Record<string, unknown>)
    : undefined;

  if (!toolId && !defaultOptions) {
    return null;
  }

  return {
    toolId,
    defaultOptions,
  };
}

function isMcpConfigTarget(value: string): value is McpConfigTarget {
  return (MCP_CONFIG_TARGETS as readonly string[]).includes(value);
}

function normalizeMcpTargets(raw: unknown): McpConfigTarget[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  const targets = raw
    .map((item) => readString(item))
    .filter((item): item is string => item !== null)
    .filter((item): item is McpConfigTarget => isMcpConfigTarget(item));

  if (targets.length === 0) {
    return undefined;
  }

  return Array.from(new Set(targets));
}

function normalizeMcpDeclaration(raw: unknown): Partial<McpAdapter> | null {
  if (!isRecord(raw)) {
    return null;
  }

  const source = raw as CustomMcpLike;
  const defaultTargets = normalizeMcpTargets(source.defaultTargets);
  const strictByDefault =
    typeof source.strictByDefault === 'boolean' ? source.strictByDefault : undefined;

  if (!defaultTargets && strictByDefault === undefined) {
    return null;
  }

  return {
    defaultTargets,
    strictByDefault,
  };
}

function inferMcpTargets(serviceId: string): McpConfigTarget[] {
  switch (serviceId) {
    case 'claude':
      return ['claude', 'project'];
    case 'codex':
      return ['codex', 'project'];
    case 'gemini':
      return ['gemini', 'project'];
    default:
      return ['project'];
  }
}

function resolveExecutionAdapter({
  declared,
  serviceId,
  tools,
  enabled,
}: {
  declared: Partial<ExecutionAdapter> | null;
  serviceId: string;
  tools: ToolAdapter[];
  enabled: boolean;
}): ExecutionAdapter | null {
  if (!enabled) {
    return null;
  }

  return {
    // Progressive rollout: explicit > inferred(first managed tool) > safe default(service id)
    toolId: declared?.toolId ?? tools[0]?.id ?? serviceId,
    defaultOptions: declared?.defaultOptions,
  };
}

function resolveMcpAdapter({
  declared,
  serviceId,
  enabled,
}: {
  declared: Partial<McpAdapter> | null;
  serviceId: string;
  enabled: boolean;
}): McpAdapter | null {
  if (!enabled) {
    return null;
  }

  const inferredTargets = inferMcpTargets(serviceId);
  return {
    // Progressive rollout: explicit > inferred(service target) > safe default(project)
    defaultTargets: declared?.defaultTargets ?? inferredTargets,
    strictByDefault: declared?.strictByDefault ?? false,
  };
}

function normalizeCustomService(
  raw: unknown,
  env: NodeJS.ProcessEnv,
): MaintenanceServiceAdapter | null {
  if (!isRecord(raw)) {
    return null;
  }
  const source = raw as CustomServiceLike;
  if (source.enabled === false) {
    return null;
  }

  const id = readString(source.id);
  if (!id) {
    return null;
  }

  const displayName = readString(source.name) ?? id;
  const tools = Array.isArray(source.tools)
    ? source.tools
        .map((item) => normalizeCustomTool(item, displayName, env))
        .filter((item): item is ToolAdapter => item !== null)
    : [];
  const skillStore = normalizeCustomSkillStore(id, source.skillStore, env);
  const declaredExecution = normalizeExecutionDeclaration(source.execution);
  const declaredMcp = normalizeMcpDeclaration(source.mcp);

  const capability = resolveCapabilityMatrix(
    isRecord(source.capability) ? (source.capability as CapabilityMatrixDeclaration) : undefined,
    {
      maintenance: tools.length > 0,
      skills: Boolean(skillStore),
      execution: Boolean(declaredExecution),
      mcp: Boolean(declaredMcp),
    },
  );

  const enabledTools = capability.maintenance.enabled ? tools : [];
  const enabledSkillStore = capability.skills.enabled ? (skillStore ?? undefined) : undefined;
  const enabledExecution = resolveExecutionAdapter({
    declared: declaredExecution,
    serviceId: id,
    tools,
    enabled: capability.execution.enabled,
  });
  const enabledMcp = resolveMcpAdapter({
    declared: declaredMcp,
    serviceId: id,
    enabled: capability.mcp.enabled,
  });

  if (!enabledTools.length && !enabledSkillStore && !enabledExecution && !enabledMcp) {
    return null;
  }

  return createRuntimeAdapter({
    id,
    displayName,
    capability,
    tools: enabledTools.length > 0 ? enabledTools : undefined,
    skillStore: enabledSkillStore,
    execution: enabledExecution ?? undefined,
    mcp: enabledMcp ?? undefined,
  });
}

function dedupeAdapters(adapters: MaintenanceServiceAdapter[]): MaintenanceServiceAdapter[] {
  return dedupeByLast(adapters, (adapter) => adapter.id);
}

export function createCustomMaintenanceAdapters(
  customServices: unknown,
  env: NodeJS.ProcessEnv = process.env,
): MaintenanceServiceAdapter[] {
  if (!Array.isArray(customServices)) {
    return [];
  }
  return customServices
    .map((item) => normalizeCustomService(item, env))
    .filter((item): item is MaintenanceServiceAdapter => item !== null);
}

export function toSkillInstallPathInfo(store: SkillStoreAdapter): SkillInstallPathInfo {
  return {
    provider: store.provider,
    installRoot: store.installRoot,
    disabledRoot: store.disabledRoot,
    reference: store.reference ?? SKILLS_REFERENCE,
  };
}

export function createDefaultMaintenanceAdapters(
  env: NodeJS.ProcessEnv = process.env,
): MaintenanceServiceAdapter[] {
  const home = os.homedir();
  const codexHome = normalizeDir(env.CODEX_HOME?.trim() || path.join(home, '.codex'), env);
  const claudeHome = normalizeDir(env.CLAUDE_CONFIG_DIR?.trim() || path.join(home, '.claude'), env);

  const builtins = defineMaintenanceServiceAdapters([
    defineMaintenanceServiceAdapter({
      id: 'claude',
      displayName: 'Claude Code',
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      },
      tools: [
        {
          id: 'claude',
          name: 'Claude Code',
          description: 'Anthropic Claude Code CLI',
          versionCommand: { command: 'claude', args: ['--version'] },
          updateCommand: {
            command: 'npm',
            args: ['install', '-g', '@anthropic-ai/claude-code@latest'],
          },
          docsUrl: 'https://docs.anthropic.com/en/docs/claude-code',
        },
      ],
      skillStore: {
        provider: 'claude',
        installRoot: path.join(claudeHome, 'skills'),
        disabledRoot: path.join(claudeHome, 'skills-disabled'),
      },
      execution: {
        toolId: 'claude',
      },
      mcp: {
        defaultTargets: ['claude', 'project'],
        strictByDefault: false,
      },
    }),
    defineMaintenanceServiceAdapter({
      id: 'codex',
      displayName: 'OpenAI Codex',
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      },
      tools: [
        {
          id: 'codex',
          name: 'OpenAI Codex',
          description: 'OpenAI Codex CLI',
          versionCommand: { command: 'codex', args: ['--version'] },
          updateCommand: { command: 'npm', args: ['install', '-g', '@openai/codex@latest'] },
          docsUrl: 'https://github.com/openai/codex',
        },
      ],
      skillStore: {
        provider: 'codex',
        installRoot: path.join(codexHome, 'skills'),
        disabledRoot: path.join(codexHome, 'skills-disabled'),
      },
      execution: {
        toolId: 'codex',
      },
      mcp: {
        defaultTargets: ['codex', 'project'],
        strictByDefault: false,
      },
    }),
    defineMaintenanceServiceAdapter({
      id: 'gemini',
      displayName: 'Gemini CLI',
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      },
      tools: [
        {
          id: 'gemini',
          name: 'Gemini CLI',
          description: 'Google Gemini CLI',
          versionCommand: { command: 'gemini', args: ['--version'] },
          updateCommand: {
            command: 'npm',
            args: ['install', '-g', '@google/gemini-cli@latest'],
          },
          docsUrl: 'https://github.com/google-gemini/gemini-cli',
        },
      ],
      skillStore: {
        provider: 'gemini',
        installRoot: path.join(home, '.gemini', 'skills'),
        disabledRoot: path.join(home, '.gemini', 'skills-disabled'),
      },
      execution: {
        toolId: 'gemini',
      },
      mcp: {
        defaultTargets: ['gemini', 'project'],
        strictByDefault: false,
      },
    }),
    defineMaintenanceServiceAdapter({
      id: 'agents',
      displayName: 'Agents',
      capability: {
        skills: { enabled: true },
      },
      skillStore: {
        provider: 'agents',
        installRoot: path.join(home, '.agents', 'skills'),
        disabledRoot: path.join(home, '.agents', 'skills-disabled'),
      },
    }),
    defineMaintenanceServiceAdapter({
      id: 'ralph',
      displayName: 'ralph-tui',
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
      tools: [
        {
          id: 'ralph-tui',
          name: 'ralph-tui',
          description: 'ralph-tui CLI',
          versionCommand: { command: 'ralph-tui', args: ['--version'] },
          updateCommand: { command: 'bun', args: ['update', '-g', 'ralph-tui', '--latest'] },
        },
      ],
      execution: {
        toolId: 'ralph-tui',
      },
    }),
    defineMaintenanceServiceAdapter({
      id: 'skills',
      displayName: 'skills CLI',
      capability: {
        maintenance: { enabled: true },
      },
      tools: [
        {
          id: 'skills',
          name: 'skills CLI',
          description: 'skills.sh CLI',
          versionCommand: { command: 'npx', args: ['--yes', 'skills', '--version'] },
          updateCommand: { command: 'npx', args: ['--yes', 'skills', 'update'] },
          docsUrl: 'https://skills.sh',
        },
      ],
    }),
    defineMaintenanceServiceAdapter({
      id: 'moai',
      displayName: 'MoAI-ADK',
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
      tools: [
        {
          id: 'moai',
          name: 'MoAI-ADK',
          description: 'modu-ai MoAI-ADK CLI',
          versionCommand: { command: 'moai', args: ['version'] },
          updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
          docsUrl: 'https://github.com/modu-ai/moai-adk',
        },
      ],
      execution: {
        toolId: 'moai',
      },
    }),
  ]);

  return builtins.map((registration) => createAdapterFromRegistration(registration));
}

export function createMaintenanceAdapters({
  env = process.env,
  customServices = [],
}: {
  env?: NodeJS.ProcessEnv;
  customServices?: MaintenanceRegistryService[] | unknown;
} = {}): MaintenanceServiceAdapter[] {
  const builtins = createDefaultMaintenanceAdapters(env);
  const custom = createCustomMaintenanceAdapters(customServices, env);
  return dedupeAdapters([...builtins, ...custom]);
}
