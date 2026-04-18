/**
 * MoAI IPC Handlers
 * Reads/writes .moai/config/sections/statusline.yaml and .claude/settings.json statusLine (project-level)
 */

import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { runBuffered } from '../../lib/cliRunner';
import { settingsService } from '../../services/appSettings';
import type {
  MoaiSegmentsConfig,
  MoaiStatuslineConfig,
  MoaiStatuslinePreset,
  MoaiStatuslineState,
} from '../../types/api/moai';
import type { IPCRouter } from '../IPCRouter';

const STATUSLINE_RELATIVE = '.moai/config/sections/statusline.yaml';
const SCRIPT_RELATIVE = '.moai/status_line.sh';

const MOAI_CANDIDATE_PATHS = [
  path.join(os.homedir(), 'go', 'bin', 'moai'),
  path.join(os.homedir(), '.local', 'bin', 'moai'),
  '/opt/homebrew/bin/moai',
  '/usr/local/bin/moai',
];

// Sample input matching the Claude Code statusLine hook contract
const PREVIEW_SAMPLE_INPUT = JSON.stringify({
  hook_event_name: 'PreToolUse',
  session_id: 'preview-session',
  cwd: process.cwd(),
  model: 'claude-sonnet-4-6',
  cost_usd: 0.05,
  context_window: { used: 15000, available: 185000, total: 200000 },
});

function stripAnsi(str: string): string {
  // biome-ignore lint/suspicious/noControlCharactersInRegex: ESC(0x1b) is the ANSI control prefix we want to strip.
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

async function resolveMoaiBinary(): Promise<string | null> {
  // Check PATH first
  for (const candidate of MOAI_CANDIDATE_PATHS) {
    try {
      await fs.access(candidate, fs.constants?.X_OK ?? 0o100);
      return candidate;
    } catch {
      // not found
    }
  }
  return null;
}

async function runMoaiStatusline(
  binaryPath: string,
  cwd: string,
): Promise<{ output: string | null; error?: string }> {
  const { exitCode, stdout, stderr, error } = await runBuffered(binaryPath, ['statusline'], {
    cwd,
    input: PREVIEW_SAMPLE_INPUT,
    timeoutMs: 5000,
  });
  if (error) {
    return { output: null, error };
  }
  const raw = stdout.trim();
  if (exitCode !== 0 && !raw) {
    return { output: null, error: stderr.trim() || `exit code ${String(exitCode)}` };
  }
  return { output: stripAnsi(raw) || null };
}
const PROJECT_CLAUDE_SETTINGS_RELATIVE = '.claude/settings.json';

const DEFAULT_SEGMENTS: MoaiSegmentsConfig = {
  model: true,
  context: true,
  output_style: true,
  directory: true,
  git_status: true,
  claude_version: true,
  moai_version: true,
  git_branch: true,
};

const SEGMENT_KEYS = Object.keys(DEFAULT_SEGMENTS) as (keyof MoaiSegmentsConfig)[];
const VALID_PRESETS: MoaiStatuslinePreset[] = ['full', 'compact', 'minimal', 'custom'];

function normalizePreset(value: unknown): MoaiStatuslinePreset {
  if (typeof value === 'string' && VALID_PRESETS.includes(value as MoaiStatuslinePreset)) {
    return value as MoaiStatuslinePreset;
  }
  return 'full';
}

function normalizeSegments(raw: unknown): MoaiSegmentsConfig {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SEGMENTS };
  const src = raw as Record<string, unknown>;
  const result: MoaiSegmentsConfig = { ...DEFAULT_SEGMENTS };
  for (const key of SEGMENT_KEYS) {
    if (typeof src[key] === 'boolean') {
      result[key] = src[key] as boolean;
    }
  }
  return result;
}

function parseStatuslineYaml(content: string): MoaiStatuslineConfig | null {
  try {
    const doc = yaml.load(content) as Record<string, unknown>;
    if (typeof doc !== 'object' || doc === null || typeof doc.statusline !== 'object') return null;
    const sl = doc.statusline as Record<string, unknown>;
    return {
      preset: normalizePreset(sl.preset),
      segments: normalizeSegments(sl.segments),
    };
  } catch {
    return null;
  }
}

function buildStatuslineYaml(config: MoaiStatuslineConfig): string {
  const s = config.segments;
  return [
    'statusline:',
    '  # Preset name: full, compact, minimal, custom',
    `  preset: "${config.preset}"`,
    '',
    '  # Individual segment toggles',
    '  segments:',
    `    model: ${s.model}`,
    `    context: ${s.context}`,
    `    output_style: ${s.output_style}`,
    `    directory: ${s.directory}`,
    `    git_status: ${s.git_status}`,
    `    claude_version: ${s.claude_version}`,
    `    moai_version: ${s.moai_version}`,
    `    git_branch: ${s.git_branch}`,
  ].join('\n');
}

function extractStatusLineCommand(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).type === 'command' &&
    typeof (value as Record<string, unknown>).command === 'string'
  ) {
    return (value as Record<string, unknown>).command as string;
  }
  return null;
}

async function readProjectSettingsStatusLine(projectPath: string): Promise<string | null> {
  const settingsPath = path.join(projectPath, PROJECT_CLAUDE_SETTINGS_RELATIVE);
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    const doc = JSON.parse(raw) as Record<string, unknown>;
    return extractStatusLineCommand(doc.statusLine);
  } catch {
    return null;
  }
}

async function writeProjectSettingsStatusLine(
  projectPath: string,
  enabled: boolean,
): Promise<void> {
  const settingsPath = path.join(projectPath, PROJECT_CLAUDE_SETTINGS_RELATIVE);
  let doc: Record<string, unknown> = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf-8');
    doc = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    // file may not exist yet
  }

  if (enabled) {
    doc.statusLine = { type: 'command', command: SCRIPT_RELATIVE };
  } else {
    delete doc.statusLine;
  }

  await fs.mkdir(path.dirname(settingsPath), { recursive: true });
  const tempPath = `${settingsPath}.tmp-${process.pid}-${Date.now()}`;
  await fs.writeFile(tempPath, JSON.stringify(doc, null, 2), 'utf-8');
  await fs.rename(tempPath, settingsPath);
}

export function registerMoaiHandlers(router: IPCRouter): void {
  router.handle('get-statusline', async (): Promise<MoaiStatuslineState> => {
    const projectPath = settingsService.getCurrentProjectPath() ?? null;

    const configPath = projectPath ? path.join(projectPath, STATUSLINE_RELATIVE) : null;
    const scriptPath = projectPath ? path.join(projectPath, SCRIPT_RELATIVE) : null;

    let config: MoaiStatuslineConfig | null = null;
    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf-8');
        config = parseStatuslineYaml(content);
      } catch {
        // file may not exist
      }
    }

    const claudeSettingsStatusLine = projectPath
      ? await readProjectSettingsStatusLine(projectPath)
      : null;

    return { config, configPath, scriptPath, claudeSettingsStatusLine, projectPath };
  });

  router.handle(
    'save-statusline-config',
    async (_event, config: MoaiStatuslineConfig): Promise<{ success: boolean; error?: string }> => {
      const projectPath = settingsService.getCurrentProjectPath();
      if (!projectPath) {
        return { success: false, error: 'No project selected' };
      }

      const configPath = path.join(projectPath, STATUSLINE_RELATIVE);
      try {
        await fs.mkdir(path.dirname(configPath), { recursive: true });
        const content = buildStatuslineYaml(config);
        const tempPath = `${configPath}.tmp-${process.pid}-${Date.now()}`;
        await fs.writeFile(tempPath, content, 'utf-8');
        await fs.rename(tempPath, configPath);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        };
      }
    },
  );

  router.handle('run-preview', async (): Promise<{ output: string | null; error?: string }> => {
    const binaryPath = await resolveMoaiBinary();
    if (!binaryPath) {
      return { output: null, error: 'moai binary not found' };
    }
    const cwd = settingsService.getCurrentProjectPath() ?? process.cwd();
    return runMoaiStatusline(binaryPath, cwd);
  });

  router.handle(
    'set-claude-statusline',
    async (_event, enabled: boolean): Promise<{ success: boolean; error?: string }> => {
      const projectPath = settingsService.getCurrentProjectPath();
      if (!projectPath) {
        return { success: false, error: 'No project selected' };
      }
      try {
        await writeProjectSettingsStatusLine(projectPath, enabled);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Write failed',
        };
      }
    },
  );
}
