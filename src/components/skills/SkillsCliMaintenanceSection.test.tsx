// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { CliToolVersionInfo, ManagedCliTool } from '../../types/tool-maintenance';
import { SkillsCliMaintenanceSection } from './SkillsCliMaintenanceSection';

function createTool(): ManagedCliTool {
  return {
    id: 'moai',
    name: 'MoAI-ADK',
    description: 'Mock tool',
    versionCommand: { command: 'moai', args: ['version'] },
    updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
  };
}

function createVersionInfo(partial?: Partial<CliToolVersionInfo>): CliToolVersionInfo {
  return {
    toolId: 'moai',
    status: 'ok',
    version: '1.2.3',
    latestVersion: '1.2.3',
    updateRequired: false,
    updateReason: 'up-to-date',
    command: ['moai', 'version'],
    rawOutput: '1.2.3',
    checkedAt: Date.now(),
    ...partial,
  };
}

describe('SkillsCliMaintenanceSection', () => {
  it('renders planner controls and triggers callbacks', async () => {
    const user = userEvent.setup();
    const onCheckVersions = vi.fn();
    const onRunToolUpdate = vi.fn();
    const onToggleToolSelection = vi.fn();
    const onSelectToolsNeedingUpdate = vi.fn();
    const onClearToolSelection = vi.fn();
    const onRunSelectedUpdates = vi.fn();
    const onRefreshLogs = vi.fn();

    render(
      <SkillsCliMaintenanceSection
        maintenanceTools={[createTool()]}
        toolVersions={{
          moai: createVersionInfo({ updateRequired: true, updateReason: 'outdated' }),
        }}
        updateLogs={[]}
        selectedToolIds={['moai']}
        selectedToolCount={1}
        isCheckingVersions={false}
        updatingToolId={null}
        isBatchUpdating={false}
        lastBatchSummary={null}
        message={{ type: 'success', text: 'Updated' }}
        onCheckVersions={onCheckVersions}
        onRunToolUpdate={onRunToolUpdate}
        onToggleToolSelection={onToggleToolSelection}
        onSelectToolsNeedingUpdate={onSelectToolsNeedingUpdate}
        onClearToolSelection={onClearToolSelection}
        onRunSelectedUpdates={onRunSelectedUpdates}
        onRefreshLogs={onRefreshLogs}
      />,
    );

    expect(screen.getByText('MoAI-ADK')).toBeTruthy();
    // badge shows "Update to <version>" when updateReason is 'outdated' with latestVersion
    expect(screen.getByText(/Update to|Update required/i)).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Check Versions' }));
    await user.click(screen.getByRole('button', { name: 'Select Needs Update' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: 'Update Selected (1)' }));
    await user.click(screen.getByRole('button', { name: 'Refresh Logs' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));
    await user.click(screen.getByRole('checkbox'));

    expect(onCheckVersions).toHaveBeenCalledTimes(1);
    expect(onSelectToolsNeedingUpdate).toHaveBeenCalledTimes(1);
    expect(onClearToolSelection).toHaveBeenCalledTimes(1);
    expect(onRunSelectedUpdates).toHaveBeenCalledTimes(1);
    expect(onRefreshLogs).toHaveBeenCalledTimes(1);
    expect(onRunToolUpdate).toHaveBeenCalledWith('moai');
    expect(onToggleToolSelection).toHaveBeenCalledWith('moai');
  });

  it('shows summary and log rows', () => {
    render(
      <SkillsCliMaintenanceSection
        maintenanceTools={[createTool()]}
        toolVersions={{
          moai: createVersionInfo({
            status: 'missing',
            version: null,
            latestVersion: null,
            updateRequired: true,
            updateReason: 'missing',
          }),
        }}
        updateLogs={[
          {
            logId: 'log-1',
            batchId: 'batch-1',
            toolId: 'moai',
            success: false,
            command: ['moai', 'update'],
            exitCode: 1,
            stdout: '',
            stderr: 'failed',
            startedAt: 100,
            completedAt: 200,
          },
        ]}
        selectedToolIds={[]}
        selectedToolCount={0}
        isCheckingVersions={true}
        updatingToolId="moai"
        isBatchUpdating={true}
        lastBatchSummary={{
          batchId: 'batch-1',
          requestedToolIds: ['moai'],
          startedAt: 100,
          completedAt: 200,
          total: 1,
          succeeded: 0,
          failed: 1,
          results: [],
        }}
        message={null}
        onCheckVersions={vi.fn()}
        onRunToolUpdate={vi.fn()}
        onToggleToolSelection={vi.fn()}
        onSelectToolsNeedingUpdate={vi.fn()}
        onClearToolSelection={vi.fn()}
        onRunSelectedUpdates={vi.fn()}
        onRefreshLogs={vi.fn()}
      />,
    );

    expect(screen.getByText('Install required')).toBeTruthy();
    expect(screen.getByText(/Last batch/i)).toBeTruthy();
    expect(screen.getByText(/FAILED \(exit 1\)/i)).toBeTruthy();
    const checkButton = screen.getByRole('button', { name: 'Checking…' }) as HTMLButtonElement;
    expect(checkButton.disabled).toBe(true);
    const updatingButtons = screen.getAllByRole('button', { name: /Updating/i });
    // batch update button is rendered before per-tool update button
    const batchButton = updatingButtons[0] as HTMLButtonElement;
    expect(batchButton.disabled).toBe(true);
  });
});
