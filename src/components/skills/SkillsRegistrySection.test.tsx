// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MaintenanceRegistryDraft } from '../../hooks/useMaintenanceRegistryDraft';
import { createEmptyMaintenanceRegistry } from '../../lib/maintenanceRegistryMigration';
import type { MaintenanceRegistryService } from '../../types/maintenance-registry';
import { SkillsRegistrySection } from './SkillsRegistrySection';

vi.mock('../common/JsonCodeEditor', () => ({
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

function createDraft(partial?: Partial<MaintenanceRegistryDraft>): MaintenanceRegistryDraft {
  const registry = createEmptyMaintenanceRegistry();
  return {
    parsed: { value: registry },
    validation: { valid: true, value: registry, issues: [], errors: [], migrated: false },
    status: {
      valid: true,
      serviceCount: 0,
      errors: [],
    },
    diagnostics: [],
    ...partial,
  };
}

function createTemplateActions() {
  const template: MaintenanceRegistryService = {
    id: 'new-cli',
    tools: [
      {
        id: 'new-cli',
        name: 'New CLI',
        versionCommand: { command: 'new-cli', args: ['--version'] },
        updateCommand: { command: 'npm', args: ['install', '-g', 'new-cli@latest'] },
      },
    ],
  };

  return [{ id: 'npm', label: '+ npm CLI Template', template }];
}

describe('SkillsRegistrySection', () => {
  it('renders controls and triggers callback actions', async () => {
    const user = userEvent.setup();

    const onSave = vi.fn();
    const onReload = vi.fn();
    const onFormat = vi.fn();
    const onUseExample = vi.fn();
    const onClear = vi.fn();
    const onAppendTemplate = vi.fn();
    const setMaintenanceRegistryJson = vi.fn();

    render(
      <SkillsRegistrySection
        maintenanceRegistryJson={JSON.stringify(createEmptyMaintenanceRegistry(), null, 2)}
        setMaintenanceRegistryJson={setMaintenanceRegistryJson}
        draft={createDraft()}
        visibleErrors={[]}
        isSaving={false}
        message={{ type: 'success', text: 'Saved' }}
        templateActions={createTemplateActions()}
        onSave={onSave}
        onReload={onReload}
        onFormat={onFormat}
        onUseExample={onUseExample}
        onClear={onClear}
        onAppendTemplate={onAppendTemplate}
      />,
    );

    fireEvent.change(screen.getByTestId('json-editor'), { target: { value: '[1]' } });
    expect(setMaintenanceRegistryJson).toHaveBeenCalledWith('[1]');

    await user.click(screen.getByRole('button', { name: 'Save Registry' }));
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    await user.click(screen.getByRole('button', { name: 'Format JSON' }));
    await user.click(screen.getByRole('button', { name: 'Use Example' }));
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(screen.getByRole('button', { name: '+ npm CLI Template' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onReload).toHaveBeenCalledTimes(1);
    expect(onFormat).toHaveBeenCalledTimes(1);
    expect(onUseExample).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onAppendTemplate).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('shows invalid status and disables save button', () => {
    const invalidDraft = createDraft({
      status: {
        valid: false,
        serviceCount: 1,
        errors: ['root[0]: invalid service'],
      },
    });

    render(
      <SkillsRegistrySection
        maintenanceRegistryJson='{"schemaVersion":2,"services":[{"id":"broken"}]}'
        setMaintenanceRegistryJson={vi.fn()}
        draft={invalidDraft}
        visibleErrors={['root[0]: invalid service']}
        isSaving={false}
        message={null}
        templateActions={createTemplateActions()}
        onSave={vi.fn()}
        onReload={vi.fn()}
        onFormat={vi.fn()}
        onUseExample={vi.fn()}
        onClear={vi.fn()}
        onAppendTemplate={vi.fn()}
      />,
    );

    expect(screen.getByText(/Draft invalid/i)).toBeTruthy();
    expect(screen.getByText(/root\[0\]: invalid service/i)).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'Save Registry' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });
});
