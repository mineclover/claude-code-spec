/**
 * Claude CLI tool definition with option schemas
 */

import type { CLIToolDefinition } from '../../types/cli-tool';

export const claudeToolDefinition: CLIToolDefinition = {
  id: 'claude',
  name: 'Claude Code',
  description: 'Anthropic Claude Code CLI - AI coding assistant',
  version: '1.0.0',
  interpreterType: 'claude',
  commandSpec: {
    executable: 'claude',
    segments: [
      { type: 'option', key: 'query', flag: '-p' },
      { type: 'static', args: ['--output-format', 'stream-json', '--verbose'] },
      { type: 'option', key: 'model', flag: '--model' },
      {
        type: 'mcpLaunch',
        config: {
          key: 'mcpConfig',
          flag: '--mcp-config',
        },
        strict: {
          key: 'strictMcpConfig',
          flag: '--strict-mcp-config',
          includeWhenConfigPresent: true,
          allowWithoutConfig: true,
        },
      },
      {
        type: 'fallback',
        segments: [
          {
            type: 'mapped',
            key: 'permissionMode',
            map: {
              '': [],
              plan: ['--permission-mode', 'plan'],
              'auto-edit': ['--permission-mode', 'auto-edit'],
              'full-auto': ['--permission-mode', 'full-auto'],
            },
          },
          {
            type: 'conditional',
            when: {
              op: 'in',
              key: 'permissionMode',
              values: ['bypass', 'bypassPermissions', 'dangerously-skip-permissions'],
            },
            segments: [{ type: 'static', args: ['--dangerously-skip-permissions'] }],
          },
        ],
      },
      { type: 'option', key: 'maxTurns', flag: '--max-turns', valueType: 'number' },
      { type: 'option', key: 'systemPrompt', flag: '--system-prompt' },
      { type: 'option', key: 'resume', flag: '--resume' },
    ],
  },
  options: [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      description: 'Claude model to use',
      defaultValue: 'claude-sonnet-4-6',
      choices: [
        { label: 'Claude Opus 4.7', value: 'claude-opus-4-7' },
        { label: 'Claude Opus 4.6', value: 'claude-opus-4-6' },
        { label: 'Claude Sonnet 4.6', value: 'claude-sonnet-4-6' },
        { label: 'Claude Sonnet 4.5', value: 'claude-sonnet-4-5-20250514' },
        { label: 'Claude Haiku 4.5', value: 'claude-haiku-4-5-20251001' },
      ],
      cliFlag: '--model',
      group: 'Model',
    },
    {
      key: 'mcpConfig',
      label: 'MCP Config',
      type: 'string',
      description: 'Path to MCP configuration file',
      placeholder: '.claude/.mcp-dev.json',
      cliFlag: '--mcp-config',
      group: 'Configuration',
    },
    {
      key: 'strictMcpConfig',
      label: 'Strict MCP Config',
      type: 'boolean',
      description: 'Apply --strict-mcp-config even when MCP config path is omitted',
      defaultValue: false,
      cliFlag: '--strict-mcp-config',
      group: 'Configuration',
    },
    {
      key: 'permissionMode',
      label: 'Permission Mode',
      type: 'select',
      description: 'Permission handling mode',
      choices: [
        { label: 'Default (settings.json)', value: '' },
        { label: 'Plan (read-only)', value: 'plan' },
        { label: 'Auto Edit', value: 'auto-edit' },
        { label: 'Full Auto', value: 'full-auto' },
        { label: 'Bypass Permissions', value: 'bypass' },
      ],
      cliFlag: '--permission-mode | --dangerously-skip-permissions',
      group: 'Configuration',
    },
    {
      key: 'maxTurns',
      label: 'Max Turns',
      type: 'number',
      description: 'Maximum number of agent turns',
      placeholder: '25',
      cliFlag: '--max-turns',
      group: 'Limits',
    },
    {
      key: 'systemPrompt',
      label: 'System Prompt',
      type: 'string',
      description: 'Custom system prompt to prepend',
      placeholder: 'You are a specialized assistant...',
      cliFlag: '--system-prompt',
      group: 'Prompt',
    },
    {
      key: 'resume',
      label: 'Resume Session',
      type: 'string',
      description: 'Session ID to resume',
      placeholder: 'Session ID',
      cliFlag: '--resume',
      group: 'Session',
    },
  ],
};
