/**
 * Gemini CLI tool definition with option schemas
 */

import type { CLIToolDefinition } from '../../types/cli-tool';

export const geminiToolDefinition: CLIToolDefinition = {
  id: 'gemini',
  name: 'Gemini CLI',
  description: 'Google Gemini CLI for AI-assisted coding',
  version: '1.0.0',
  interpreterType: 'gemini',
  stdinOptionKey: 'query',
  commandSpec: {
    executable: 'gemini',
    segments: [
      { type: 'static', args: ['--output-format', 'stream-json'] },
      { type: 'option', key: 'model', flag: '-m' },
      { type: 'static', args: ['--yolo'], when: { op: 'equals', key: 'yoloMode', value: true } },
    ],
  },
  options: [
    {
      key: 'model',
      label: 'Model',
      type: 'select',
      description: 'Gemini model to use',
      choices: [
        { label: 'Default', value: '' },
        { label: 'Gemini 2.5 Pro', value: 'gemini-2.5-pro' },
        { label: 'Gemini 2.5 Flash', value: 'gemini-2.5-flash' },
      ],
      cliFlag: '-m',
      group: 'Model',
    },
    {
      key: 'yoloMode',
      label: 'YOLO Mode',
      type: 'boolean',
      description: 'Auto-approve tool calls (--yolo)',
      defaultValue: true,
      group: 'Execution',
    },
  ],
};
