// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillsPage } from './SkillsPage';

vi.mock('../components/common/JsonCodeEditor', () => ({
  JsonCodeEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (nextValue: string) => void;
  }) => (
    <textarea
      data-testid="json-editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

interface MockApis {
  settingsAPI: {
    getMaintenanceRegistry: ReturnType<typeof vi.fn>;
    setMaintenanceRegistry: ReturnType<typeof vi.fn>;
  };
  toolsAPI: {
    getMaintenanceTools: ReturnType<typeof vi.fn>;
    checkToolVersions: ReturnType<typeof vi.fn>;
    runToolUpdate: ReturnType<typeof vi.fn>;
    runToolUpdates: ReturnType<typeof vi.fn>;
    getToolUpdateLogs: ReturnType<typeof vi.fn>;
    getSkillInstallPaths: ReturnType<typeof vi.fn>;
    getInstalledSkills: ReturnType<typeof vi.fn>;
    getSkillActivationEvents: ReturnType<typeof vi.fn>;
    setSkillActivation: ReturnType<typeof vi.fn>;
  };
}

function setupWindowApis(): MockApis {
  const settingsAPI = {
    getMaintenanceRegistry: vi.fn().mockResolvedValue({
      schemaVersion: 2,
      services: [],
    }),
    setMaintenanceRegistry: vi.fn().mockResolvedValue({ success: true }),
  };

  const toolsAPI = {
    getMaintenanceTools: vi.fn().mockResolvedValue([
      {
        id: 'moai',
        name: 'MoAI-ADK',
        description: 'Mock tool',
        versionCommand: { command: 'moai', args: ['version'] },
        updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
      },
    ]),
    checkToolVersions: vi.fn().mockResolvedValue([]),
    runToolUpdate: vi.fn().mockResolvedValue({
      toolId: 'moai',
      success: true,
      command: ['moai', 'update', '--binary', '--yes'],
      exitCode: 0,
      stdout: '',
      stderr: '',
      startedAt: Date.now(),
      completedAt: Date.now(),
    }),
    runToolUpdates: vi.fn().mockResolvedValue({
      batchId: 'batch-1',
      requestedToolIds: ['moai'],
      startedAt: Date.now(),
      completedAt: Date.now(),
      total: 1,
      succeeded: 1,
      failed: 0,
      results: [],
    }),
    getToolUpdateLogs: vi.fn().mockResolvedValue([]),
    getSkillInstallPaths: vi.fn().mockResolvedValue([]),
    getInstalledSkills: vi.fn().mockResolvedValue([]),
    getSkillActivationEvents: vi.fn().mockResolvedValue([]),
    setSkillActivation: vi.fn().mockResolvedValue({}),
  };

  Object.assign(window, {
    settingsAPI: settingsAPI as unknown,
    toolsAPI: toolsAPI as unknown,
  });

  return { settingsAPI, toolsAPI };
}

describe('SkillsPage registry flows', () => {
  let apis: MockApis;

  beforeEach(() => {
    vi.clearAllMocks();
    apis = setupWindowApis();
  });

  it('disables save and shows parse error for invalid JSON', async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    await user.click(await screen.findByRole('button', { name: 'JSON Editor' }));
    const editor = await screen.findByTestId('json-editor');
    await user.clear(editor);
    fireEvent.change(editor, { target: { value: '{' } });

    await waitFor(() => {
      expect(screen.getByText(/Draft invalid/i)).toBeTruthy();
    });
    expect(screen.getByText(/JSON parse error/i)).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'Save Registry' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('inserts npm template and saves valid registry payload', async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    await user.click(await screen.findByRole('button', { name: '+ npm CLI Template' }));

    await waitFor(() => {
      expect(screen.getByText(/Draft valid/i)).toBeTruthy();
    });

    await user.click(screen.getByRole('button', { name: 'Save Registry' }));

    await waitFor(() => {
      expect(apis.settingsAPI.setMaintenanceRegistry).toHaveBeenCalledTimes(1);
    });
    const firstCallArg = apis.settingsAPI.setMaintenanceRegistry.mock.calls[0][0];
    expect(firstCallArg?.schemaVersion).toBe(2);
    expect(Array.isArray(firstCallArg?.services)).toBe(true);
    expect(firstCallArg?.services?.[0]?.id).toBe('new-cli');
  });

  it('keeps form editor and json editor synchronized in both directions', async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    await user.click(await screen.findByRole('button', { name: 'Add Service' }));
    const idInput = await screen.findByLabelText('Service ID');
    fireEvent.change(idInput, { target: { value: 'from-form' } });

    await user.click(screen.getByRole('button', { name: 'JSON Editor' }));
    const editor = await screen.findByTestId('json-editor');
    expect((editor as HTMLTextAreaElement).value).toContain('"id": "from-form"');

    fireEvent.change(editor, {
      target: {
        value:
          '{"schemaVersion":2,"services":[{"id":"from-json","tools":[{"id":"from-json","name":"From Json","versionCommand":{"command":"from-json"},"updateCommand":{"command":"npm","args":["install","-g","from-json@latest"]}}]}]}',
      },
    });

    await user.click(screen.getByRole('button', { name: 'Form Editor' }));
    const syncedInput = await screen.findByLabelText('Service ID');
    expect((syncedInput as HTMLInputElement).value).toBe('from-json');
  });

  it('shows schema validation error when service has no adapter contracts', async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    await user.click(await screen.findByRole('button', { name: 'JSON Editor' }));
    const editor = await screen.findByTestId('json-editor');
    await user.clear(editor);
    fireEvent.change(editor, {
      target: { value: '{"schemaVersion":2,"services":[{"id":"broken"}]}' },
    });

    await user.click(screen.getByRole('button', { name: 'Form Editor' }));
    await waitFor(() => {
      expect(screen.getByText(/Draft invalid/i)).toBeTruthy();
    });
    expect(
      screen.getByText(
        /root\.services\[0\]: At least one of `tools`, `skillStore`, `execution`, or `mcp` is required/i,
      ),
    ).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'Save Registry' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
