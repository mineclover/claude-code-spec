/**
 * OpenAI Codex CLI tool definition with option schemas
 */

import type { CLIToolDefinition } from '../../types/cli-tool';

export const codexToolDefinition: CLIToolDefinition = {
  id: 'codex',
  name: 'OpenAI Codex',
  description: 'OpenAI Codex CLI for AI-assisted coding',
  version: '1.0.0',
  interpreterType: 'codex',
  stdinOptionKey: 'query',
  commandSpec: {
    executable: 'codex',
    segments: [
      {
        type: 'static',
        args: ['-a', 'on-request'],
        when: {
          op: 'all',
          conditions: [
            { op: 'equals', key: 'fullAuto', value: true },
            { op: 'notEquals', key: 'sandbox', value: 'workspace-write' },
          ],
        },
      },
      { type: 'static', args: ['exec'] },
      {
        type: 'static',
        args: ['--full-auto'],
        when: {
          op: 'all',
          conditions: [
            { op: 'equals', key: 'fullAuto', value: true },
            { op: 'equals', key: 'sandbox', value: 'workspace-write' },
          ],
        },
      },
      { type: 'static', args: ['--json'] },
      { type: 'option', key: 'model', flag: '--model' },
      { type: 'option', key: 'sandbox', flag: '--sandbox' },
      { type: 'static', args: ['-'] },
    ],
  },
  options: [
    {
      key: 'model',
      label: 'Model',
      type: 'string',
      description: 'Model identifier (optional)',
      placeholder: 'gpt-5, gpt-5-codex, ...',
      cliFlag: '--model',
      group: 'Model',
    },
    {
      key: 'sandbox',
      label: 'Sandbox',
      type: 'select',
      description: 'Codex sandbox mode',
      defaultValue: 'workspace-write',
      choices: [
        { label: 'Workspace Write', value: 'workspace-write' },
        { label: 'Read Only', value: 'read-only' },
        { label: 'Danger Full Access', value: 'danger-full-access' },
      ],
      cliFlag: '--sandbox',
      group: 'Execution',
    },
    {
      key: 'fullAuto',
      label: 'Full Auto',
      type: 'boolean',
      description: 'Auto-approve actions when sandbox is workspace-write',
      defaultValue: true,
      group: 'Execution',
    },
  ],
};
