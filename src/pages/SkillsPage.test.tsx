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
    getMaintenanceServices: ReturnType<typeof vi.fn>;
    setMaintenanceServices: ReturnType<typeof vi.fn>;
  };
  toolsAPI: {
    getMaintenanceTools: ReturnType<typeof vi.fn>;
    checkToolVersions: ReturnType<typeof vi.fn>;
    runToolUpdate: ReturnType<typeof vi.fn>;
    getSkillInstallPaths: ReturnType<typeof vi.fn>;
    getInstalledSkills: ReturnType<typeof vi.fn>;
    setSkillActivation: ReturnType<typeof vi.fn>;
  };
}

function setupWindowApis(): MockApis {
  const settingsAPI = {
    getMaintenanceServices: vi.fn().mockResolvedValue([]),
    setMaintenanceServices: vi.fn().mockResolvedValue({ success: true }),
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
    getSkillInstallPaths: vi.fn().mockResolvedValue([]),
    getInstalledSkills: vi.fn().mockResolvedValue([]),
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
      expect(apis.settingsAPI.setMaintenanceServices).toHaveBeenCalledTimes(1);
    });
    const firstCallArg = apis.settingsAPI.setMaintenanceServices.mock.calls[0][0];
    expect(Array.isArray(firstCallArg)).toBe(true);
    expect(firstCallArg[0]?.id).toBe('new-cli');
  });

  it('shows schema validation error when service has no adapter contracts', async () => {
    const user = userEvent.setup();
    render(<SkillsPage />);

    const editor = await screen.findByTestId('json-editor');
    await user.clear(editor);
    fireEvent.change(editor, { target: { value: '[{"id":"broken"}]' } });

    await waitFor(() => {
      expect(screen.getByText(/Draft invalid/i)).toBeTruthy();
    });
    expect(
      screen.getByText(/At least one of `tools`, `skillStore`, `execution`, or `mcp` is required/i),
    ).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'Save Registry' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
