import { useCallback, useEffect, useState } from 'react';
import type { CliToolVersionInfo, ManagedCliTool } from '../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

export function useCliMaintenance() {
  const [maintenanceTools, setMaintenanceTools] = useState<ManagedCliTool[]>([]);
  const [toolVersions, setToolVersions] = useState<Record<string, CliToolVersionInfo>>({});
  const [isCheckingVersions, setIsCheckingVersions] = useState(false);
  const [updatingToolId, setUpdatingToolId] = useState<string | null>(null);
  const [toolMessage, setToolMessage] = useState<Message>(null);

  const loadMaintenanceTools = useCallback(async () => {
    try {
      const tools = await window.toolsAPI.getMaintenanceTools();
      setMaintenanceTools(tools);
    } catch (error) {
      console.error('Failed to load maintenance tools:', error);
    }
  }, []);

  const checkToolVersions = useCallback(async () => {
    setIsCheckingVersions(true);
    setToolMessage(null);
    try {
      const versions = await window.toolsAPI.checkToolVersions();
      const mapped = Object.fromEntries(versions.map((item) => [item.toolId, item]));
      setToolVersions(mapped);
    } catch (error) {
      console.error('Failed to check tool versions:', error);
      setToolMessage({ type: 'error', text: 'Failed to check versions.' });
    } finally {
      setIsCheckingVersions(false);
    }
  }, []);

  const runToolUpdate = useCallback(
    async (toolId: string) => {
      setUpdatingToolId(toolId);
      setToolMessage(null);
      try {
        const result = await window.toolsAPI.runToolUpdate(toolId);
        if (result.success) {
          setToolMessage({ type: 'success', text: `${toolId} update completed.` });
        } else {
          const detail =
            result.error || result.stderr || `exit code ${result.exitCode ?? 'unknown'}`;
          setToolMessage({ type: 'error', text: `${toolId} update failed: ${detail}` });
        }
        await checkToolVersions();
      } catch (error) {
        console.error('Failed to update tool:', error);
        setToolMessage({ type: 'error', text: `Failed to update ${toolId}.` });
      } finally {
        setUpdatingToolId(null);
      }
    },
    [checkToolVersions],
  );

  useEffect(() => {
    loadMaintenanceTools();
    checkToolVersions();
  }, [checkToolVersions, loadMaintenanceTools]);

  return {
    maintenanceTools,
    toolVersions,
    isCheckingVersions,
    updatingToolId,
    toolMessage,
    loadMaintenanceTools,
    checkToolVersions,
    runToolUpdate,
  };
}
