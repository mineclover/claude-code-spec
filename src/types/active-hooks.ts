/**
 * Types for Claude Code hooks configured in settings.json
 * (user: ~/.claude/settings.json, project: <project>/.claude/settings.json)
 */

export type HookEvent = 'PreToolUse' | 'PostToolUse' | 'Stop' | 'Notification' | 'SubagentStop';

export type HookScope = 'user' | 'project';

export interface HookCommandDef {
  type: 'command';
  command: string;
  timeout?: number;
  background?: boolean;
}

export interface HookMatcherEntry {
  matcher?: string;
  hooks: HookCommandDef[];
}

export type RawHooksConfig = Partial<Record<HookEvent, HookMatcherEntry[]>>;

export interface ActiveHookItem {
  id: string;
  scope: HookScope;
  scopePath: string;
  event: HookEvent;
  matcher: string | undefined;
  command: string;
  timeout: number | undefined;
  background: boolean | undefined;
}

export interface ActiveHooksResult {
  items: ActiveHookItem[];
  userSettingsPath: string;
  projectSettingsPath: string | null;
  userSettingsExists: boolean;
  projectSettingsExists: boolean;
  userError?: string;
  projectError?: string;
}
