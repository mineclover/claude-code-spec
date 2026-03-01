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
    command: ['moai', 'version'],
    rawOutput: '1.2.3',
    checkedAt: Date.now(),
    ...partial,
  };
}

describe('SkillsCliMaintenanceSection', () => {
  it('renders tool card and triggers check/update callbacks', async () => {
    const user = userEvent.setup();
    const onCheckVersions = vi.fn();
    const onRunToolUpdate = vi.fn();

    render(
      <SkillsCliMaintenanceSection
        maintenanceTools={[createTool()]}
        toolVersions={{ moai: createVersionInfo() }}
        isCheckingVersions={false}
        updatingToolId={null}
        message={{ type: 'success', text: 'Updated' }}
        onCheckVersions={onCheckVersions}
        onRunToolUpdate={onRunToolUpdate}
      />,
    );

    expect(screen.getByText('MoAI-ADK')).toBeTruthy();
    expect(screen.getByText('1.2.3')).toBeTruthy();
    expect(screen.getByText('Updated')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Check Versions' }));
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(onCheckVersions).toHaveBeenCalledTimes(1);
    expect(onRunToolUpdate).toHaveBeenCalledWith('moai');
  });

  it('shows missing status and updating state', () => {
    render(
      <SkillsCliMaintenanceSection
        maintenanceTools={[createTool()]}
        toolVersions={{ moai: createVersionInfo({ status: 'missing', version: null }) }}
        isCheckingVersions={true}
        updatingToolId="moai"
        message={null}
        onCheckVersions={vi.fn()}
        onRunToolUpdate={vi.fn()}
      />,
    );

    expect(screen.getByText('Not installed')).toBeTruthy();
    const checkButton = screen.getByRole('button', { name: 'Checking...' }) as HTMLButtonElement;
    expect(checkButton.disabled).toBe(true);
    const updateButton = screen.getByRole('button', { name: 'Updating...' }) as HTMLButtonElement;
    expect(updateButton.disabled).toBe(true);
  });
});
