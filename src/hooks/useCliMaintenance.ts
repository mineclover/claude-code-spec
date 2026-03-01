import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  CliToolBatchUpdateSummary,
  CliToolUpdateLogEntry,
  CliToolVersionInfo,
  ManagedCliTool,
} from '../types/tool-maintenance';

type Message = { type: 'success' | 'error'; text: string } | null;

function dedupeToolIds(toolIds: string[]): string[] {
  return Array.from(new Set(toolIds.map((toolId) => toolId.trim()))).filter(
    (toolId) => toolId.length > 0,
  );
}

export function useCliMaintenance() {
  const [maintenanceTools, setMaintenanceTools] = useState<ManagedCliTool[]>([]);
  const [toolVersions, setToolVersions] = useState<Record<string, CliToolVersionInfo>>({});
  const [toolUpdateLogs, setToolUpdateLogs] = useState<CliToolUpdateLogEntry[]>([]);
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([]);
  const [isCheckingVersions, setIsCheckingVersions] = useState(false);
  const [updatingToolId, setUpdatingToolId] = useState<string | null>(null);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [lastBatchSummary, setLastBatchSummary] = useState<CliToolBatchUpdateSummary | null>(null);
  const [toolMessage, setToolMessage] = useState<Message>(null);

  const loadMaintenanceTools = useCallback(async () => {
    try {
      const tools = await window.toolsAPI.getMaintenanceTools();
      setMaintenanceTools(tools);
      setSelectedToolIds((current) =>
        current.filter((toolId) => tools.some((tool) => tool.id === toolId)),
      );
    } catch (error) {
      console.error('Failed to load maintenance tools:', error);
    }
  }, []);

  const checkToolVersions = useCallback(async (options?: { preserveMessage?: boolean }) => {
    setIsCheckingVersions(true);
    if (!options?.preserveMessage) {
      setToolMessage(null);
    }
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

  const loadToolUpdateLogs = useCallback(async (toolId?: string) => {
    try {
      const logs = await window.toolsAPI.getToolUpdateLogs(20, toolId);
      setToolUpdateLogs(logs);
    } catch (error) {
      console.error('Failed to load tool update logs:', error);
      setToolMessage({ type: 'error', text: 'Failed to load update logs.' });
    }
  }, []);

  const toggleToolSelection = useCallback((toolId: string) => {
    setSelectedToolIds((current) => {
      if (current.includes(toolId)) {
        return current.filter((item) => item !== toolId);
      }
      return [...current, toolId];
    });
  }, []);

  const clearToolSelection = useCallback(() => {
    setSelectedToolIds([]);
  }, []);

  const selectToolsNeedingUpdate = useCallback(() => {
    const selected = maintenanceTools
      .filter((tool) => toolVersions[tool.id]?.updateRequired)
      .map((tool) => tool.id);
    setSelectedToolIds(dedupeToolIds(selected));
  }, [maintenanceTools, toolVersions]);

  const runToolUpdate = useCallback(
    async (toolId: string) => {
      setUpdatingToolId(toolId);
      setToolMessage(null);
      setLastBatchSummary(null);
      try {
        const result = await window.toolsAPI.runToolUpdate(toolId);
        if (result.success) {
          setToolMessage({ type: 'success', text: `${toolId} update completed.` });
        } else {
          const detail =
            result.error || result.stderr || `exit code ${result.exitCode ?? 'unknown'}`;
          setToolMessage({ type: 'error', text: `${toolId} update failed: ${detail}` });
        }
        await Promise.all([checkToolVersions({ preserveMessage: true }), loadToolUpdateLogs()]);
      } catch (error) {
        console.error('Failed to update tool:', error);
        setToolMessage({ type: 'error', text: `Failed to update ${toolId}.` });
      } finally {
        setUpdatingToolId(null);
      }
    },
    [checkToolVersions, loadToolUpdateLogs],
  );

  const runSelectedToolUpdates = useCallback(async () => {
    const availableToolIds = new Set(maintenanceTools.map((tool) => tool.id));
    const selected = dedupeToolIds(selectedToolIds).filter((toolId) =>
      availableToolIds.has(toolId),
    );
    if (selected.length === 0) {
      setToolMessage({ type: 'error', text: 'Select at least one tool to update.' });
      return;
    }

    setIsBatchUpdating(true);
    setToolMessage(null);
    try {
      const summary = await window.toolsAPI.runToolUpdates(selected);
      setLastBatchSummary(summary);
      setToolMessage({
        type: summary.failed > 0 ? 'error' : 'success',
        text: `Batch update completed: ${summary.succeeded}/${summary.total} succeeded, ${summary.failed} failed.`,
      });
      await Promise.all([checkToolVersions({ preserveMessage: true }), loadToolUpdateLogs()]);
    } catch (error) {
      console.error('Failed to run batch tool updates:', error);
      setToolMessage({ type: 'error', text: 'Failed to run selected updates.' });
    } finally {
      setIsBatchUpdating(false);
    }
  }, [maintenanceTools, selectedToolIds, checkToolVersions, loadToolUpdateLogs]);

  useEffect(() => {
    loadMaintenanceTools();
    checkToolVersions();
    loadToolUpdateLogs();
  }, [checkToolVersions, loadMaintenanceTools, loadToolUpdateLogs]);

  const selectedToolCount = useMemo(() => selectedToolIds.length, [selectedToolIds]);

  return {
    maintenanceTools,
    toolVersions,
    toolUpdateLogs,
    selectedToolIds,
    selectedToolCount,
    isCheckingVersions,
    updatingToolId,
    isBatchUpdating,
    lastBatchSummary,
    toolMessage,
    loadMaintenanceTools,
    checkToolVersions,
    loadToolUpdateLogs,
    toggleToolSelection,
    clearToolSelection,
    selectToolsNeedingUpdate,
    runToolUpdate,
    runSelectedToolUpdates,
  };
}
