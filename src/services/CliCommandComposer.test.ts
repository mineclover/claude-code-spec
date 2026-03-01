import { describe, expect, it } from 'vitest';
import { claudeToolDefinition } from '../data/cli-tools/claude';
import type { CLIToolDefinition } from '../types/cli-tool';
import { composeCliCommand, getCliStdinInput } from './CliCommandComposer';

const ruleCatalogTool: CLIToolDefinition = {
  id: 'rule-catalog-test',
  name: 'Rule Catalog Test',
  description: 'Test-only tool for command rule catalog composition',
  interpreterType: 'claude',
  stdinOptionKey: 'query',
  options: [
    { key: 'query', label: 'Query', type: 'string' },
    { key: 'primary', label: 'Primary', type: 'string' },
    { key: 'secondary', label: 'Secondary', type: 'string' },
    { key: 'audit', label: 'Audit', type: 'boolean' },
  ],
  commandSpec: {
    executable: 'demo-cli',
    segments: [
      {
        type: 'fallback',
        segments: [
          { type: 'option', key: 'primary', flag: '--primary' },
          { type: 'option', key: 'secondary', flag: '--secondary' },
          { type: 'static', args: ['--primary', 'default'] },
        ],
      },
      {
        type: 'conditional',
        when: { op: 'equals', key: 'audit', value: true },
        segments: [{ type: 'static', args: ['--audit', '--trace'] }],
      },
    ],
  },
};

describe('CliCommandComposer', () => {
  it('supports conditional-group and fallback catalog rules', () => {
    const snapshots = [
      composeCliCommand(ruleCatalogTool, { primary: 'alpha', audit: true }).join(' '),
      composeCliCommand(ruleCatalogTool, { secondary: 'beta' }).join(' '),
      composeCliCommand(ruleCatalogTool, {}).join(' '),
    ];

    expect(snapshots).toMatchInlineSnapshot(`
      [
        "demo-cli --primary alpha --audit --trace",
        "demo-cli --secondary beta",
        "demo-cli --primary default",
      ]
    `);
  });

  it('composes claude strictMcpConfig/mcpConfig/permission combinations', () => {
    const snapshots = [
      {
        name: 'default',
        command: composeCliCommand(claudeToolDefinition, { query: 'ping' }).join(' '),
      },
      {
        name: 'mcp-plan',
        command: composeCliCommand(claudeToolDefinition, {
          query: 'ping',
          mcpConfig: '.claude/.mcp-dev.json',
          permissionMode: 'plan',
        }).join(' '),
      },
      {
        name: 'strict-only-bypass',
        command: composeCliCommand(claudeToolDefinition, {
          query: 'ping',
          strictMcpConfig: true,
          permissionMode: 'bypass',
        }).join(' '),
      },
      {
        name: 'mcp-strict-full-auto',
        command: composeCliCommand(claudeToolDefinition, {
          query: 'ping',
          mcpConfig: '.claude/.mcp-dev.json',
          strictMcpConfig: true,
          permissionMode: 'full-auto',
        }).join(' '),
      },
    ];

    expect(snapshots).toMatchInlineSnapshot(`
      [
        {
          "command": "claude -p ping --output-format stream-json --verbose --model claude-sonnet-4-5-20250514",
          "name": "default",
        },
        {
          "command": "claude -p ping --output-format stream-json --verbose --model claude-sonnet-4-5-20250514 --mcp-config .claude/.mcp-dev.json --strict-mcp-config --permission-mode plan",
          "name": "mcp-plan",
        },
        {
          "command": "claude -p ping --output-format stream-json --verbose --model claude-sonnet-4-5-20250514 --strict-mcp-config --dangerously-skip-permissions",
          "name": "strict-only-bypass",
        },
        {
          "command": "claude -p ping --output-format stream-json --verbose --model claude-sonnet-4-5-20250514 --mcp-config .claude/.mcp-dev.json --strict-mcp-config --permission-mode full-auto",
          "name": "mcp-strict-full-auto",
        },
      ]
    `);
  });

  it('returns stdin only for non-empty string values', () => {
    expect(getCliStdinInput(ruleCatalogTool, { query: '  hello  ' })).toBe('hello');
    expect(getCliStdinInput(ruleCatalogTool, { query: '   ' })).toBeUndefined();
    expect(getCliStdinInput(ruleCatalogTool, { query: 123 })).toBeUndefined();
  });
});
