import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MaintenanceRegistryService } from '../types/maintenance-registry';
import { useMaintenanceRegistryDraft } from './useMaintenanceRegistryDraft';

type Message = { type: 'success' | 'error'; text: string } | null;

export interface RegistryTemplateAction {
  id: string;
  label: string;
  template: MaintenanceRegistryService;
}

interface UseMaintenanceRegistryEditorOptions {
  onRegistrySaved?: () => Promise<void> | void;
}

const DEFAULT_MAINTENANCE_REGISTRY_JSON = '[]';
const MAINTENANCE_REGISTRY_EXAMPLE_JSON = JSON.stringify(
  [
    {
      id: 'acme',
      name: 'Acme CLI',
      enabled: true,
      capability: {
        maintenance: { enabled: true },
        skills: { enabled: true },
      },
      tools: [
        {
          id: 'acme-cli',
          name: 'Acme CLI',
          description: 'Example third-party CLI',
          versionCommand: { command: 'acme', args: ['--version'] },
          updateCommand: { command: 'npm', args: ['install', '-g', 'acme-cli@latest'] },
          docsUrl: 'https://example.com/acme',
        },
      ],
      skillStore: {
        provider: 'acme',
        installRoot: '~/.acme/skills',
      },
    },
    {
      id: 'moai',
      name: 'MoAI-ADK',
      enabled: true,
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
      tools: [
        {
          id: 'moai',
          name: 'MoAI-ADK',
          description: 'Self-updating binary CLI example',
          versionCommand: { command: 'moai', args: ['version'] },
          updateCommand: { command: 'moai', args: ['update', '--binary', '--yes'] },
          docsUrl: 'https://github.com/modu-ai/moai-adk',
        },
      ],
    },
  ],
  null,
  2,
);

const TEMPLATE_ACTIONS: RegistryTemplateAction[] = [
  {
    id: 'npm',
    label: '+ npm CLI Template',
    template: {
      id: 'new-cli',
      name: 'New CLI',
      enabled: true,
      capability: {
        maintenance: { enabled: true },
      },
      tools: [
        {
          id: 'new-cli',
          name: 'New CLI',
          description: 'npm-installed global CLI template',
          versionCommand: { command: 'new-cli', args: ['--version'] },
          updateCommand: { command: 'npm', args: ['install', '-g', 'new-cli@latest'] },
          docsUrl: 'https://example.com/new-cli',
        },
      ],
    },
  },
  {
    id: 'self-update',
    label: '+ Self-update Template',
    template: {
      id: 'self-update-cli',
      name: 'Self Update CLI',
      enabled: true,
      capability: {
        maintenance: { enabled: true },
        execution: { enabled: true },
      },
      tools: [
        {
          id: 'self-update-cli',
          name: 'Self Update CLI',
          description: 'Self-updating binary CLI template',
          versionCommand: { command: 'self-update-cli', args: ['version'] },
          updateCommand: { command: 'self-update-cli', args: ['update', '--yes'] },
          docsUrl: 'https://example.com/self-update-cli',
        },
      ],
    },
  },
  {
    id: 'skill-store',
    label: '+ Skill Store Template',
    template: {
      id: 'new-provider',
      name: 'New Skill Provider',
      enabled: true,
      capability: {
        skills: { enabled: true },
      },
      skillStore: {
        provider: 'new-provider',
        installRoot: '~/.new-provider/skills',
        disabledRoot: '~/.new-provider/skills-disabled',
      },
    },
  },
];

function buildInvalidRegistryError(errors: string[]): Error {
  const maxVisibleErrors = 6;
  const errorLines = errors.slice(0, maxVisibleErrors);
  const suffix =
    errors.length > maxVisibleErrors ? `\n... ${errors.length - maxVisibleErrors} more` : '';
  return new Error(`Invalid registry JSON:\n${errorLines.join('\n')}${suffix}`);
}

export function useMaintenanceRegistryEditor({
  onRegistrySaved,
}: UseMaintenanceRegistryEditorOptions = {}) {
  const [maintenanceRegistryJson, setMaintenanceRegistryJson] = useState(
    DEFAULT_MAINTENANCE_REGISTRY_JSON,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  const draft = useMaintenanceRegistryDraft(maintenanceRegistryJson);
  const visibleErrors = useMemo(
    () => Array.from(new Set(draft.status.errors.slice(0, 6))),
    [draft.status.errors],
  );

  const loadRegistry = useCallback(async () => {
    setMessage(null);
    try {
      const services = await window.settingsAPI.getMaintenanceServices();
      setMaintenanceRegistryJson(
        services.length > 0 ? JSON.stringify(services, null, 2) : DEFAULT_MAINTENANCE_REGISTRY_JSON,
      );
    } catch (error) {
      console.error('Failed to load maintenance registry:', error);
      setMessage({ type: 'error', text: 'Failed to load registry config.' });
    }
  }, []);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const appendTemplate = useCallback(
    (template: MaintenanceRegistryService) => {
      if (draft.parsed.error) {
        setMessage({ type: 'error', text: draft.parsed.error });
        return;
      }
      if (!Array.isArray(draft.parsed.value)) {
        setMessage({ type: 'error', text: 'Registry root must be an array.' });
        return;
      }

      const next = [...draft.parsed.value, template];
      setMaintenanceRegistryJson(JSON.stringify(next, null, 2));
      setMessage({
        type: 'success',
        text: `Template inserted: ${template.id}`,
      });
    },
    [draft.parsed.error, draft.parsed.value],
  );

  const formatRegistry = useCallback(() => {
    if (draft.parsed.error) {
      setMessage({ type: 'error', text: draft.parsed.error });
      return;
    }
    setMaintenanceRegistryJson(JSON.stringify(draft.parsed.value, null, 2));
    setMessage({ type: 'success', text: 'Registry JSON formatted.' });
  }, [draft.parsed.error, draft.parsed.value]);

  const useExampleRegistry = useCallback(() => {
    setMaintenanceRegistryJson(MAINTENANCE_REGISTRY_EXAMPLE_JSON);
  }, []);

  const clearRegistry = useCallback(() => {
    setMaintenanceRegistryJson(DEFAULT_MAINTENANCE_REGISTRY_JSON);
  }, []);

  const saveRegistry = useCallback(async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      if (draft.parsed.error) {
        throw new Error(draft.parsed.error);
      }

      const validation = draft.validation;
      if (!validation || !validation.valid) {
        throw buildInvalidRegistryError(draft.status.errors);
      }

      await window.settingsAPI.setMaintenanceServices(validation.value ?? []);
      setMessage({ type: 'success', text: 'Registry saved.' });
      await onRegistrySaved?.();
    } catch (error) {
      const nextMessage = error instanceof Error ? error.message : 'Invalid registry JSON.';
      setMessage({ type: 'error', text: nextMessage });
    } finally {
      setIsSaving(false);
    }
  }, [draft.parsed.error, draft.status.errors, draft.validation, onRegistrySaved]);

  return {
    maintenanceRegistryJson,
    setMaintenanceRegistryJson,
    isSaving,
    message,
    draft,
    visibleErrors,
    templateActions: TEMPLATE_ACTIONS,
    loadRegistry,
    appendTemplate,
    formatRegistry,
    useExampleRegistry,
    clearRegistry,
    saveRegistry,
  };
}
