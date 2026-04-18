// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { McpPolicyFile, ResolvedRegistry } from '../types/mcp-policy';
import { McpPolicyPage } from './McpPolicyPage';

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

vi.mock('react-hot-toast', () => {
  const fn = Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  });
  return { default: fn, __esModule: true };
});

interface MockMcpApi {
  getRegistry: ReturnType<typeof vi.fn>;
  saveRegistryEntry: ReturnType<typeof vi.fn>;
  deleteRegistryEntry: ReturnType<typeof vi.fn>;
  getPolicy: ReturnType<typeof vi.fn>;
  savePolicy: ReturnType<typeof vi.fn>;
  resolve: ReturnType<typeof vi.fn>;
  listPresets: ReturnType<typeof vi.fn>;
  savePreset: ReturnType<typeof vi.fn>;
  deletePreset: ReturnType<typeof vi.fn>;
}

function makeRegistry(): ResolvedRegistry {
  return {
    entries: [
      {
        id: 'serena',
        name: 'Serena',
        command: 'serena',
        args: [],
        category: 'analysis',
        scope: 'user',
      },
      {
        id: 'context7',
        name: 'Context7',
        command: 'npx',
        args: ['-y', '@context7/mcp'],
        category: 'docs',
        scope: 'user',
      },
    ],
    sources: { userPath: '/home/.claude/mcp-registry.json', projectPath: null },
  };
}

function makePolicy(overrides: Partial<McpPolicyFile> = {}): McpPolicyFile {
  return {
    schemaVersion: 1,
    defaultEnabled: ['serena'],
    allowed: [],
    forbidden: [],
    ...overrides,
  };
}

function setupMcpApi(opts: {
  registry?: ResolvedRegistry;
  policy?: McpPolicyFile;
} = {}): MockMcpApi {
  const reg = opts.registry ?? makeRegistry();
  const pol = opts.policy ?? makePolicy();
  const api: MockMcpApi = {
    getRegistry: vi.fn().mockResolvedValue(reg),
    saveRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    deleteRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    getPolicy: vi.fn().mockResolvedValue(pol),
    savePolicy: vi.fn().mockResolvedValue({ success: true }),
    resolve: vi.fn().mockResolvedValue({
      resolved: {
        enabledServerIds: pol.defaultEnabled,
        hash: 'preview-hash',
        baselineServerIds: pol.defaultEnabled,
        overrideAdd: [],
        overrideRemove: [],
        canonicalJson: '{}',
        disallowed: [],
      },
      registry: reg,
      policy: pol,
    }),
    listPresets: vi.fn().mockResolvedValue({ presets: [] }),
    savePreset: vi.fn().mockResolvedValue({ success: true }),
    deletePreset: vi.fn().mockResolvedValue({ success: true }),
  };
  Object.assign(window, { mcpAPI: api as unknown });
  return api;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <McpPolicyPage />
    </MemoryRouter>,
  );
}

/** The matrix section. The "Baseline preview" panel above can also surface
 * server ids, so all queries that target a matrix row should scope through
 * this. */
function matrixSection(): HTMLElement {
  const heading = screen.getByText(/^id$/);
  const matrix = heading.closest('section');
  if (!matrix) throw new Error('matrix section not found');
  return matrix as HTMLElement;
}

function rowFor(id: string): HTMLElement {
  const code = within(matrixSection()).getByText(id);
  const row = code.closest('div');
  if (!row) throw new Error(`row for ${id} not found`);
  return row as HTMLElement;
}

describe('McpPolicyPage', () => {
  let api: MockMcpApi;

  beforeEach(() => {
    vi.clearAllMocks();
    api = setupMcpApi();
  });

  it('loads policy and registry on mount and renders the matrix', async () => {
    renderPage();
    await waitFor(() => {
      expect(within(matrixSection()).getByText('serena')).toBeTruthy();
    });
    expect(within(matrixSection()).getByText('context7')).toBeTruthy();
    expect(api.getRegistry).toHaveBeenCalled();
    expect(api.getPolicy).toHaveBeenCalled();
  });

  it('keeps Save and Revert disabled while pristine', async () => {
    renderPage();
    await waitFor(() => {
      expect(within(matrixSection()).getByText('serena')).toBeTruthy();
    });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole('button', { name: 'Revert' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('toggles a default-enabled checkbox and enables Save (dirty)', async () => {
    renderPage();
    await screen.findByText('context7');

    const ctxRow = rowFor('context7');
    const checkboxes = within(ctxRow).getAllByRole('checkbox');
    // Order in the matrix: defaultEnabled, allowed, forbidden.
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(false);
    fireEvent.click(checkboxes[0]);
    expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);

    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
        false,
      );
    });
  });

  it('saves the policy and resets the dirty state', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('context7');

    const ctxRow = rowFor('context7');
    const ctxBoxes = within(ctxRow).getAllByRole('checkbox');
    fireEvent.click(ctxBoxes[0]);

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(api.savePolicy).toHaveBeenCalledTimes(1);
    });
    const [projectPath, policy] = api.savePolicy.mock.calls[0];
    expect(projectPath).toBe('/proj/sample');
    expect(policy.defaultEnabled).toEqual(expect.arrayContaining(['serena', 'context7']));
    // Save button returns to disabled (saved === policy now).
    await waitFor(() => {
      expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(
        true,
      );
    });
  });

  it('reverts an unsaved change back to the saved policy', async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByText('context7');

    const ctxRow = rowFor('context7');
    const ctxBoxes = within(ctxRow).getAllByRole('checkbox');
    fireEvent.click(ctxBoxes[0]);
    expect((ctxBoxes[0] as HTMLInputElement).checked).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Revert' }));

    expect((ctxBoxes[0] as HTMLInputElement).checked).toBe(false);
    expect(api.savePolicy).not.toHaveBeenCalled();
  });

  it('filters the matrix by query', async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(within(matrixSection()).getByText('context7')).toBeTruthy();
    });

    const filterInput = screen.getByLabelText(/Filter MCP entries/i);
    await user.type(filterInput, 'docs');

    await waitFor(() => {
      expect(within(matrixSection()).queryByText('serena')).toBeNull();
    });
    expect(within(matrixSection()).getByText('context7')).toBeTruthy();
  });
});
