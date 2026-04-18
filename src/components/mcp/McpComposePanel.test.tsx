// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  McpExecutionOverride,
  McpPolicyFile,
  McpPreset,
  McpPresetsFile,
  McpRegistryEntry,
  ResolvedMcpConfig,
  ResolvedRegistry,
} from '../../types/mcp-policy';
import type { McpResolveRequest, McpResolveResult } from '../../types/api/mcp';
import { McpComposePanel } from './McpComposePanel';

// react-hot-toast touches the DOM on mount; stub it so tests don't care about
// toast rendering or container markup. We only need `toast.error` / `toast.success`
// to be callable.
vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

interface MockMcpAPI {
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

const PROJECT_PATH = '/tmp/project-a';

function makeEntry(id: string, category = 'analysis'): McpRegistryEntry {
  return {
    id,
    command: 'node',
    args: [`${id}.js`],
    category,
    scope: 'user',
  };
}

function makeRegistry(ids: readonly string[]): ResolvedRegistry {
  return {
    entries: ids.map((id) => makeEntry(id)),
    sources: { userPath: '/home/user/.claude/mcp-registry.json', projectPath: null },
  };
}

function makePolicy(defaultEnabled: readonly string[]): McpPolicyFile {
  return {
    schemaVersion: 1,
    defaultEnabled: [...defaultEnabled],
    allowed: [],
    forbidden: [],
  };
}

function makePresetsFile(presets: McpPreset[]): McpPresetsFile {
  return { schemaVersion: 1, presets };
}

function makeResolved(enabledIds: readonly string[]): ResolvedMcpConfig {
  return {
    enabledServerIds: [...enabledIds],
    hash: 'deadbeefcafebabe1234567890abcdef',
    canonicalJson: JSON.stringify({ mcpServers: {} }),
    cliConfig: { mcpServers: {} },
    baselineServerIds: [...enabledIds],
    addedByOverride: [],
    removedByOverride: [],
    disallowed: [],
  };
}

function setupMcpAPI(opts: {
  registryIds: readonly string[];
  baseline: readonly string[];
  presets?: McpPreset[];
}): MockMcpAPI {
  const api: MockMcpAPI = {
    getRegistry: vi.fn().mockResolvedValue(makeRegistry(opts.registryIds)),
    saveRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    deleteRegistryEntry: vi.fn().mockResolvedValue({ success: true }),
    getPolicy: vi.fn().mockResolvedValue(makePolicy(opts.baseline)),
    savePolicy: vi.fn().mockResolvedValue({ success: true }),
    resolve: vi.fn().mockImplementation(async (req: McpResolveRequest) => {
      // Reflect the requested override back so the hash looks reasonable.
      const override = req.override ?? { add: [], remove: [] };
      const baselineSet = new Set(opts.baseline);
      for (const id of override.add) baselineSet.add(id);
      for (const id of override.remove) baselineSet.delete(id);
      const result: McpResolveResult = {
        resolved: makeResolved(Array.from(baselineSet).sort()),
        registry: makeRegistry(opts.registryIds),
        policy: makePolicy(opts.baseline),
      };
      return result;
    }),
    listPresets: vi.fn().mockResolvedValue(makePresetsFile(opts.presets ?? [])),
    savePreset: vi.fn().mockResolvedValue({ success: true }),
    deletePreset: vi.fn().mockResolvedValue({ success: true }),
  };
  Object.assign(window, { mcpAPI: api as unknown });
  return api;
}

/**
 * Expand the panel body (checkboxes, preset bar, save row). The panel starts
 * collapsed; the summary row button toggles it.
 */
async function expandPanel(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  const summary = await screen.findByRole('button', { name: /MCP \(\d+ enabled\)/ });
  await user.click(summary);
}

describe('McpComposePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with baseline-checked boxes and emits null override', async () => {
    setupMcpAPI({
      registryIds: ['serena', 'context7', 'sequential-thinking'],
      baseline: ['serena', 'context7'],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );

    // Wait for reload() to settle so the summary reflects the baseline size.
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });

    await expandPanel(user);

    const serena = screen.getByRole('checkbox', { name: /serena/ });
    const context7 = screen.getByRole('checkbox', { name: /context7/ });
    const seq = screen.getByRole('checkbox', { name: /sequential-thinking/ });
    expect((serena as HTMLInputElement).checked).toBe(true);
    expect((context7 as HTMLInputElement).checked).toBe(true);
    expect((seq as HTMLInputElement).checked).toBe(false);

    // Selection matches baseline, so every emission has been null.
    await waitFor(() => {
      expect(onOverrideChange).toHaveBeenCalled();
    });
    for (const call of onOverrideChange.mock.calls) {
      expect(call[0]).toBeNull();
    }
  });

  it('emits { add: [], remove: ["serena"] } when a baseline server is toggled off', async () => {
    setupMcpAPI({
      registryIds: ['serena', 'context7'],
      baseline: ['serena', 'context7'],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });
    await expandPanel(user);

    const serena = screen.getByRole('checkbox', { name: /serena/ });
    await user.click(serena);

    await waitFor(() => {
      const last = onOverrideChange.mock.calls.at(-1);
      expect(last).toBeTruthy();
      expect(last?.[0]).toEqual({ add: [], remove: ['serena'] });
    });
  });

  it('emits { add: [id], remove: [] } when a non-baseline server is toggled on', async () => {
    setupMcpAPI({
      registryIds: ['serena', 'context7', 'sequential-thinking'],
      baseline: ['serena', 'context7'],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });
    await expandPanel(user);

    const seq = screen.getByRole('checkbox', { name: /sequential-thinking/ });
    await user.click(seq);

    await waitFor(() => {
      const last = onOverrideChange.mock.calls.at(-1);
      expect(last?.[0]).toEqual({ add: ['sequential-thinking'], remove: [] });
    });
  });

  it('resets to baseline and emits null after "Reset to baseline" is clicked', async () => {
    setupMcpAPI({
      registryIds: ['serena', 'context7', 'sequential-thinking'],
      baseline: ['serena', 'context7'],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });
    await expandPanel(user);

    // Drift the selection: turn serena off, sequential-thinking on.
    await user.click(screen.getByRole('checkbox', { name: /serena/ }));
    await user.click(screen.getByRole('checkbox', { name: /sequential-thinking/ }));

    await waitFor(() => {
      const last = onOverrideChange.mock.calls.at(-1);
      expect(last?.[0]).toEqual({
        add: ['sequential-thinking'],
        remove: ['serena'],
      });
    });

    const resetBtn = screen.getByRole('button', { name: /Reset to baseline/i });
    await user.click(resetBtn);

    await waitFor(() => {
      const last = onOverrideChange.mock.calls.at(-1);
      expect(last?.[0]).toBeNull();
    });

    expect(
      (screen.getByRole('checkbox', { name: /serena/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: /sequential-thinking/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('applies a preset and reflects baseline ∪ add \\ remove in checkboxes and override', async () => {
    const preset: McpPreset = {
      id: 'preset-1',
      name: 'ralph-no-serena',
      override: { add: ['sequential-thinking'], remove: ['serena'] },
      createdAt: 1,
    };

    setupMcpAPI({
      registryIds: ['serena', 'context7', 'sequential-thinking'],
      baseline: ['serena', 'context7'],
      presets: [preset],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });
    await expandPanel(user);

    const presetBtn = screen.getByRole('button', { name: 'ralph-no-serena' });
    await user.click(presetBtn);

    // serena off, context7 on (kept), sequential-thinking on (added).
    await waitFor(() => {
      expect(
        (screen.getByRole('checkbox', { name: /serena/ }) as HTMLInputElement).checked,
      ).toBe(false);
    });
    expect(
      (screen.getByRole('checkbox', { name: /context7/ }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: /sequential-thinking/,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);

    await waitFor(() => {
      const last = onOverrideChange.mock.calls.at(-1)?.[0] as
        | McpExecutionOverride
        | null;
      expect(last).toEqual({ add: ['sequential-thinking'], remove: ['serena'] });
    });
  });

  it('Save preset button is disabled at baseline, requires both override and non-empty name', async () => {
    setupMcpAPI({
      registryIds: ['serena', 'context7'],
      baseline: ['serena', 'context7'],
    });
    const onOverrideChange = vi.fn();

    const user = userEvent.setup();
    render(
      <McpComposePanel projectPath={PROJECT_PATH} onOverrideChange={onOverrideChange} />,
    );
    await screen.findByRole('button', { name: /MCP \(2 enabled\)/ });
    await expandPanel(user);

    const saveBtn = screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    const nameInput = screen.getByPlaceholderText(
      /Save current selection as preset/i,
    ) as HTMLInputElement;

    // Baseline + empty name → disabled.
    expect(saveBtn.disabled).toBe(true);

    // Baseline + name typed → still disabled (no override to save).
    fireEvent.change(nameInput, { target: { value: 'my-preset' } });
    expect(saveBtn.disabled).toBe(true);

    // Introduce an override by unchecking serena.
    await user.click(screen.getByRole('checkbox', { name: /serena/ }));
    await waitFor(() => {
      expect(saveBtn.disabled).toBe(false);
    });

    // Clear the name → disabled again even with override present.
    fireEvent.change(nameInput, { target: { value: '' } });
    expect(saveBtn.disabled).toBe(true);

    // Re-fill → enabled.
    fireEvent.change(nameInput, { target: { value: 'my-preset' } });
    expect(saveBtn.disabled).toBe(false);
  });
});
