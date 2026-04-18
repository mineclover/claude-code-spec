// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpExecutionOverride } from '../types/mcp-policy';
import { ExecutePage } from './ExecutePage';

vi.mock('../contexts/ProjectContext', () => ({
  useProject: () => ({
    projectPath: '/proj/sample',
    projectDirName: 'sample',
    setProjectPath: vi.fn(),
    setProjectDirName: vi.fn(),
    updateProject: vi.fn(),
    clearProject: vi.fn(),
    projectFolders: [],
    isLoadingFolders: false,
    refreshProjectFolders: vi.fn(),
  }),
}));

vi.mock('../contexts/ToolContext', () => ({
  useToolContext: () => ({
    selectedToolId: 'claude',
    setSelectedToolId: vi.fn(),
    availableToolIds: ['claude'],
  }),
}));

// Replace McpComposePanel with a stub that exposes a button to push a known
// override up to the parent. Lets us verify mcpOverride wiring without
// dragging the real MCP loading flow into the test.
vi.mock('../components/mcp/McpComposePanel', () => ({
  McpComposePanel: ({
    onOverrideChange,
  }: {
    projectPath: string;
    onOverrideChange: (override: McpExecutionOverride | null) => void;
  }) => (
    <div data-testid="mock-mcp-compose">
      <button
        type="button"
        onClick={() =>
          onOverrideChange({ add: ['extra-server'], remove: ['serena'] })
        }
      >
        push-override
      </button>
      <button type="button" onClick={() => onOverrideChange(null)}>
        clear-override
      </button>
    </div>
  ),
}));

vi.mock('../components/options/OptionPanel', () => ({
  OptionPanel: () => <div data-testid="mock-option-panel" />,
}));

vi.mock('../components/stream/StreamOutput', () => ({
  StreamOutput: () => <div data-testid="mock-stream-output" />,
}));

interface MockExecuteApi {
  execute: ReturnType<typeof vi.fn>;
  getExecution: ReturnType<typeof vi.fn>;
  getAllExecutions: ReturnType<typeof vi.fn>;
  killExecution: ReturnType<typeof vi.fn>;
  cleanupExecution: ReturnType<typeof vi.fn>;
  onStream: ReturnType<typeof vi.fn>;
  onComplete: ReturnType<typeof vi.fn>;
  onError: ReturnType<typeof vi.fn>;
}

interface MockToolsApi {
  getRegisteredTools: ReturnType<typeof vi.fn>;
  getInstalledSkills: ReturnType<typeof vi.fn>;
  readSkillContent: ReturnType<typeof vi.fn>;
}

interface MockSettingsApi {
  listMcpConfigs: ReturnType<typeof vi.fn>;
}

function setupApis(): {
  executeAPI: MockExecuteApi;
  toolsAPI: MockToolsApi;
  settingsAPI: MockSettingsApi;
} {
  const executeAPI: MockExecuteApi = {
    execute: vi.fn().mockResolvedValue('session-xyz'),
    getExecution: vi.fn(),
    getAllExecutions: vi.fn().mockResolvedValue([]),
    killExecution: vi.fn(),
    cleanupExecution: vi.fn(),
    onStream: vi.fn().mockReturnValue(() => {}),
    onComplete: vi.fn().mockReturnValue(() => {}),
    onError: vi.fn().mockReturnValue(() => {}),
  };
  const toolsAPI: MockToolsApi = {
    getRegisteredTools: vi.fn().mockResolvedValue([
      {
        id: 'claude',
        name: 'Claude',
        options: [],
      },
    ]),
    getInstalledSkills: vi.fn().mockResolvedValue([]),
    readSkillContent: vi.fn().mockResolvedValue(''),
  };
  const settingsAPI: MockSettingsApi = {
    listMcpConfigs: vi.fn().mockResolvedValue([]),
  };
  Object.assign(window, {
    executeAPI: executeAPI as unknown,
    toolsAPI: toolsAPI as unknown,
    settingsAPI: settingsAPI as unknown,
  });
  return { executeAPI, toolsAPI, settingsAPI };
}

describe('ExecutePage mcpOverride wiring', () => {
  let executeAPI: MockExecuteApi;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ executeAPI } = setupApis());
  });

  it('forwards a non-null override to executeAPI.execute', async () => {
    const user = userEvent.setup();
    render(<ExecutePage />);

    await screen.findByTestId('mock-mcp-compose');
    fireEvent.change(screen.getByPlaceholderText(/Enter your query/), {
      target: { value: 'hello' },
    });
    await user.click(screen.getByRole('button', { name: 'push-override' }));
    await user.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(executeAPI.execute).toHaveBeenCalledTimes(1);
    });
    const request = executeAPI.execute.mock.calls[0][0];
    expect(request.mcpOverride).toEqual({
      add: ['extra-server'],
      remove: ['serena'],
    });
    expect(request.projectPath).toBe('/proj/sample');
    expect(request.toolId).toBe('claude');
    expect(request.query).toBe('hello');
  });

  it('omits mcpOverride when the panel reports null', async () => {
    const user = userEvent.setup();
    render(<ExecutePage />);

    await screen.findByTestId('mock-mcp-compose');
    fireEvent.change(screen.getByPlaceholderText(/Enter your query/), {
      target: { value: 'plain' },
    });
    // Panel never pushes — mcpOverride state stays null.
    await user.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(executeAPI.execute).toHaveBeenCalledTimes(1);
    });
    const request = executeAPI.execute.mock.calls[0][0];
    expect(request.mcpOverride).toBeUndefined();
  });

  it('clears the override after the panel reports null again', async () => {
    const user = userEvent.setup();
    render(<ExecutePage />);

    await screen.findByTestId('mock-mcp-compose');
    fireEvent.change(screen.getByPlaceholderText(/Enter your query/), {
      target: { value: 'cycle' },
    });
    await user.click(screen.getByRole('button', { name: 'push-override' }));
    await user.click(screen.getByRole('button', { name: 'clear-override' }));
    await user.click(screen.getByRole('button', { name: 'Execute' }));

    await waitFor(() => {
      expect(executeAPI.execute).toHaveBeenCalledTimes(1);
    });
    expect(executeAPI.execute.mock.calls[0][0].mcpOverride).toBeUndefined();
  });
});
