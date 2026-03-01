/**
 * Maintenance service integrations
 * - Each integration can contribute CLI maintenance tools and/or skill store roots.
 * - New services can be added via app settings registry.
 */

import * as os from 'node:os';
import * as path from 'node:path';
import { resolveCapabilityMatrix } from '../../lib/capabilityMatrix';
import { dedupeByLast } from '../../lib/collectionUtils';
import type { CapabilityMatrix, CapabilityMatrixDeclaration } from '../../types/capability-matrix';
import type { MaintenanceRegistryService } from '../../types/maintenance-registry';
import type {
  CommandSpec,
  ManagedCliTool,
  SkillInstallPathInfo,
  SkillProvider,
} from '../../types/tool-maintenance';

const SKILLS_REFERENCE = 'references/vercel-labs-skills/src/agents.ts';

export interface SkillStoreAdapter {
  provider: SkillProvider;
  installRoot: string;
  disabledRoot: string;
  reference?: string;
}

export interface MaintenanceServiceAdapter {
  id: string;
  displayName: string;
  capability: CapabilityMatrix;
  getManagedTools?(): ManagedCliTool[];
  getSkillStore?(): SkillStoreAdapter | null;
}

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

interface CustomServiceLike {
  id?: unknown;
  name?: unknown;
  enabled?: unknown;
  capability?: unknown;
  tools?: unknown;
  skillStore?: unknown;
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

function createSkillStoreAdapter(
  id: string,
  displayName: string,
  store: SkillStoreAdapter,
  capability?: CapabilityMatrixDeclaration,
): MaintenanceServiceAdapter {
  const resolvedCapability = resolveCapabilityMatrix(capability, {
    skills: true,
  });

  return {
    id,
    displayName,
    capability: resolvedCapability,
    getSkillStore: resolvedCapability.skills.enabled ? () => store : undefined,
  };
}

function createCliToolAdapter(
  id: string,
  displayName: string,
  tools: ManagedCliTool[],
  capability?: CapabilityMatrixDeclaration,
): MaintenanceServiceAdapter {
  const resolvedCapability = resolveCapabilityMatrix(capability, {
    maintenance: true,
  });

  return {
    id,
    displayName,
    capability: resolvedCapability,
    getManagedTools: resolvedCapability.maintenance.enabled ? () => [...tools] : undefined,
  };
}

function defaultDisabledRoot(installRoot: string): string {
  const base = path.basename(installRoot);
  if (base.endsWith('skills')) {
    return path.join(path.dirname(installRoot), `${base}-disabled`);
  }
  return `${installRoot}-disabled`;
}

function normalizeCustomTool(
  raw: unknown,
  serviceName: string,
  env: NodeJS.ProcessEnv,
): ManagedCliTool | null {
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
        .filter((item): item is ManagedCliTool => item !== null)
    : [];
  const skillStore = normalizeCustomSkillStore(id, source.skillStore, env);
  const capability = resolveCapabilityMatrix(
    isRecord(source.capability) ? (source.capability as CapabilityMatrixDeclaration) : undefined,
    {
      maintenance: tools.length > 0,
      skills: Boolean(skillStore),
    },
  );
  const enabledTools = capability.maintenance.enabled ? tools : [];
  const enabledSkillStore = capability.skills.enabled ? skillStore : null;

  if (enabledTools.length === 0 && !enabledSkillStore) {
    return null;
  }

  return {
    id,
    displayName,
    capability,
    getManagedTools: enabledTools.length > 0 ? () => [...enabledTools] : undefined,
    getSkillStore: enabledSkillStore ? () => enabledSkillStore : undefined,
  };
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

  const builtins: MaintenanceServiceAdapter[] = [
    {
      id: 'claude',
      displayName: 'Claude Code',
      capability: resolveCapabilityMatrix({
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      }),
      getManagedTools: () => [
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
      getSkillStore: () => ({
        provider: 'claude',
        installRoot: path.join(claudeHome, 'skills'),
        disabledRoot: path.join(claudeHome, 'skills-disabled'),
      }),
    },
    {
      id: 'codex',
      displayName: 'OpenAI Codex',
      capability: resolveCapabilityMatrix({
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      }),
      getManagedTools: () => [
        {
          id: 'codex',
          name: 'OpenAI Codex',
          description: 'OpenAI Codex CLI',
          versionCommand: { command: 'codex', args: ['--version'] },
          updateCommand: { command: 'npm', args: ['install', '-g', '@openai/codex@latest'] },
          docsUrl: 'https://github.com/openai/codex',
        },
      ],
      getSkillStore: () => ({
        provider: 'codex',
        installRoot: path.join(codexHome, 'skills'),
        disabledRoot: path.join(codexHome, 'skills-disabled'),
      }),
    },
    {
      id: 'gemini',
      displayName: 'Gemini CLI',
      capability: resolveCapabilityMatrix({
        maintenance: { enabled: true },
        execution: { enabled: true },
        skills: { enabled: true },
        mcp: { enabled: true },
      }),
      getManagedTools: () => [
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
      getSkillStore: () => ({
        provider: 'gemini',
        installRoot: path.join(home, '.gemini', 'skills'),
        disabledRoot: path.join(home, '.gemini', 'skills-disabled'),
      }),
    },
    createSkillStoreAdapter(
      'agents',
      'Agents',
      {
        provider: 'agents',
        installRoot: path.join(home, '.agents', 'skills'),
        disabledRoot: path.join(home, '.agents', 'skills-disabled'),
      },
      {
        skills: { enabled: true },
      },
    ),
    createCliToolAdapter(
      'ralph',
      'ralph-tui',
      [
        {
          id: 'ralph-tui',
          name: 'ralph-tui',
          description: 'ralph-tui CLI',
          versionCommand: { command: 'ralph-tui', args: ['--version'] },
          updateCommand: { command: 'bun', args: ['update', '-g', 'ralph-tui', '--latest'] },
        },
      ],
      {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
    ),
    createCliToolAdapter(
      'skills',
      'skills CLI',
      [
        {
          id: 'skills',
          name: 'skills CLI',
          description: 'skills.sh CLI',
          versionCommand: { command: 'npx', args: ['--yes', 'skills', '--version'] },
          updateCommand: { command: 'npx', args: ['--yes', 'skills', 'update'] },
          docsUrl: 'https://skills.sh',
        },
      ],
      {
        maintenance: { enabled: true },
        skills: { enabled: true },
      },
    ),
    createCliToolAdapter(
      'moai',
      'MoAI-ADK',
      [
        {
          id: 'moai',
          name: 'MoAI-ADK',
          description: 'modu-ai MoAI-ADK CLI',
          versionCommand: { command: 'moai', args: ['version'] },
          updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
          docsUrl: 'https://github.com/modu-ai/moai-adk',
        },
      ],
      {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
    ),
  ];

  return builtins;
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
