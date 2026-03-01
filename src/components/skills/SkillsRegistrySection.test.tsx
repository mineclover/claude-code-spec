// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { MaintenanceRegistryDraft } from '../../hooks/useMaintenanceRegistryDraft';
import type { MaintenanceRegistryFormErrors } from '../../lib/maintenanceRegistryForm';
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

function createFormErrors(
  partial?: Partial<MaintenanceRegistryFormErrors>,
): MaintenanceRegistryFormErrors {
  return {
    global: [],
    services: {},
    ...partial,
  };
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
    const onAddService = vi.fn();
    const onUpdateService = vi.fn();
    const onDeleteService = vi.fn();
    const onEnsureServiceTool = vi.fn();
    const setMaintenanceRegistryJson = vi.fn();

    render(
      <SkillsRegistrySection
        maintenanceRegistryJson={JSON.stringify(createEmptyMaintenanceRegistry(), null, 2)}
        setMaintenanceRegistryJson={setMaintenanceRegistryJson}
        draft={createDraft()}
        formDocument={{
          schemaVersion: 2,
          services: [
            {
              id: 'service-a',
              name: 'Service A',
              enabled: true,
              tools: [
                {
                  id: 'service-a',
                  name: 'Service A',
                  versionCommand: { command: 'service-a', args: ['--version'] },
                  updateCommand: { command: 'npm', args: ['install', '-g', 'service-a@latest'] },
                },
              ],
            },
          ],
        }}
        formErrors={createFormErrors()}
        canEditForm={true}
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
        onAddService={onAddService}
        onUpdateService={onUpdateService}
        onDeleteService={onDeleteService}
        onEnsureServiceTool={onEnsureServiceTool}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Add Service' }));
    expect(onAddService).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText('Service ID'), { target: { value: 'service-b' } });
    expect(onUpdateService).toHaveBeenCalledWith(0, expect.objectContaining({ id: 'service-b' }));

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDeleteService).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'JSON Editor' }));
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
        formDocument={createEmptyMaintenanceRegistry()}
        formErrors={createFormErrors()}
        canEditForm={true}
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
        onAddService={vi.fn()}
        onUpdateService={vi.fn()}
        onDeleteService={vi.fn()}
        onEnsureServiceTool={vi.fn()}
      />,
    );

    expect(screen.getByText(/Draft invalid/i)).toBeTruthy();
    expect(screen.getByText(/root\[0\]: invalid service/i)).toBeTruthy();
    const saveButton = screen.getByRole('button', { name: 'Save Registry' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('shows schema errors near form fields', () => {
    render(
      <SkillsRegistrySection
        maintenanceRegistryJson='{"schemaVersion":2,"services":[{"id":""}]}'
        setMaintenanceRegistryJson={vi.fn()}
        draft={createDraft({
          status: {
            valid: false,
            serviceCount: 1,
            errors: ['root.services[0].id: Must be a non-empty string'],
          },
        })}
        formDocument={{
          schemaVersion: 2,
          services: [{ id: '', name: 'Broken service' }],
        }}
        formErrors={createFormErrors({
          services: {
            0: {
              root: [],
              fields: {
                id: ['Must be a non-empty string'],
              },
            },
          },
        })}
        canEditForm={true}
        visibleErrors={['root.services[0].id: Must be a non-empty string']}
        isSaving={false}
        message={null}
        templateActions={createTemplateActions()}
        onSave={vi.fn()}
        onReload={vi.fn()}
        onFormat={vi.fn()}
        onUseExample={vi.fn()}
        onClear={vi.fn()}
        onAppendTemplate={vi.fn()}
        onAddService={vi.fn()}
        onUpdateService={vi.fn()}
        onDeleteService={vi.fn()}
        onEnsureServiceTool={vi.fn()}
      />,
    );

    expect(screen.getByText('Must be a non-empty string')).toBeTruthy();
  });
});
