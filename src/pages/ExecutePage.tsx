/**
 * Execute Page
 * Uses sidebar tool selection + dynamic options + query input + stream output
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OptionPanel } from '../components/options/OptionPanel';
import { StreamOutput } from '../components/stream/StreamOutput';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import type { McpConfigFile } from '../types/api/settings';
import type { CLIOptionSchema, CLIToolDefinition } from '../types/cli-tool';
import type { StreamEvent } from '../types/stream-events';
import styles from './ExecutePage.module.css';

function buildDefaultOptions(tool: CLIToolDefinition): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const option of tool.options) {
    if (option.defaultValue !== undefined) {
      defaults[option.key] = option.defaultValue;
    }
  }
  return defaults;
}

function hasMcpConfigOption(tool: CLIToolDefinition | null): boolean {
  return Boolean(tool?.options.some((option) => option.key === 'mcpConfig'));
}

function toProjectRelativePath(filePath: string, projectPath: string): string {
  const prefix = projectPath.endsWith('/') ? projectPath : `${projectPath}/`;
  if (filePath.startsWith(prefix)) {
    return filePath.slice(prefix.length);
  }
  return filePath;
}

function buildMcpConfigChoices(
  configs: McpConfigFile[],
  projectPath: string,
): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const choices: Array<{ label: string; value: string }> = [];
  for (const config of configs) {
    const relativePath = toProjectRelativePath(config.path, projectPath);
    if (seen.has(relativePath)) {
      continue;
    }
    seen.add(relativePath);
    choices.push({ label: config.name, value: relativePath });
  }
  return choices;
}

export function ExecutePage() {
  const { projectPath } = useProject();
  const { selectedToolId } = useToolContext();
  const [tools, setTools] = useState<CLIToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<CLIToolDefinition | null>(null);
  const [mcpConfigChoices, setMcpConfigChoices] = useState<Array<{ label: string; value: string }>>(
    [],
  );
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const cleanupRef = useRef<Array<() => void>>([]);

  // Load registered tools and select the one matching sidebar
  useEffect(() => {
    window.toolsAPI.getRegisteredTools().then((registered) => {
      setTools(registered);
    });
  }, []);

  // Sync selectedTool with sidebar toolId
  useEffect(() => {
    const match = tools.find((t) => t.id === selectedToolId);
    if (match) {
      setSelectedTool(match);
      setOptions(buildDefaultOptions(match));
    } else if (tools.length > 0) {
      // Fallback: tool not registered yet, still show first registered tool
      setSelectedTool(tools[0]);
      setOptions(buildDefaultOptions(tools[0]));
    }
  }, [selectedToolId, tools]);

  // Load project MCP config files as selectable suggestions for mcpConfig option.
  useEffect(() => {
    if (!projectPath || !hasMcpConfigOption(selectedTool)) {
      setMcpConfigChoices([]);
      return;
    }

    let cancelled = false;
    window.settingsAPI
      .listMcpConfigs(projectPath)
      .then((configs) => {
        if (cancelled) {
          return;
        }
        setMcpConfigChoices(buildMcpConfigChoices(configs, projectPath));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error('[ExecutePage] Failed to load MCP config choices:', error);
        setMcpConfigChoices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTool, projectPath]);

  // Subscribe to stream events
  useEffect(() => {
    const unsub1 = window.executeAPI.onStream((sessionId, event) => {
      if (sessionId === currentSessionId) {
        setEvents((prev) => [...prev, event]);
      }
    });

    const unsub2 = window.executeAPI.onComplete((sessionId) => {
      if (sessionId === currentSessionId) {
        setIsRunning(false);
      }
    });

    const unsub3 = window.executeAPI.onError((sessionId, error) => {
      if (sessionId === currentSessionId) {
        setIsRunning(false);
        console.error('[ExecutePage] Execution error:', error);
      }
    });

    cleanupRef.current = [unsub1, unsub2, unsub3];
    return () => {
      for (const fn of cleanupRef.current) fn();
    };
  }, [currentSessionId]);

  const handleOptionChange = (key: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const handleExecute = useCallback(async () => {
    if (!selectedTool || !query.trim() || !projectPath) return;

    setEvents([]);
    setIsRunning(true);

    try {
      const sessionId = await window.executeAPI.execute({
        toolId: selectedTool.id,
        projectPath,
        query: query.trim(),
        options,
      });
      setCurrentSessionId(sessionId);
    } catch (error) {
      setIsRunning(false);
      console.error('[ExecutePage] Failed to start execution:', error);
    }
  }, [selectedTool, query, projectPath, options]);

  const handleStop = useCallback(() => {
    if (currentSessionId) {
      window.executeAPI.killExecution(currentSessionId);
    }
  }, [currentSessionId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleExecute();
    }
  };

  const optionSchemas = useMemo<CLIOptionSchema[]>(() => {
    if (!selectedTool) {
      return [];
    }
    if (mcpConfigChoices.length === 0) {
      return selectedTool.options;
    }

    return selectedTool.options.map((option) => {
      if (option.key !== 'mcpConfig') {
        return option;
      }
      return {
        ...option,
        choices: mcpConfigChoices,
      };
    });
  }, [selectedTool, mcpConfigChoices]);

  if (!projectPath) {
    return (
      <div className={styles.emptyState}>
        <h2>No Project Selected</h2>
        <p>Go to Settings to configure a project path, then return here to execute.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.configPanel}>
        {/* Current tool indicator */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>CLI Tool</label>
          <div className={styles.toolIndicator}>{selectedTool?.name ?? selectedToolId}</div>
        </div>

        {/* Dynamic options */}
        {selectedTool && (
          <div className={styles.section}>
            <label className={styles.sectionLabel}>Options</label>
            <OptionPanel options={optionSchemas} values={options} onChange={handleOptionChange} />
          </div>
        )}

        {/* Query input */}
        <div className={styles.section}>
          <label className={styles.sectionLabel}>Query</label>
          <textarea
            className={styles.queryInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter your query... (Cmd+Enter to execute)"
            rows={4}
          />
        </div>

        {/* Execute/Stop button */}
        <div className={styles.actions}>
          {isRunning ? (
            <button type="button" className={styles.stopButton} onClick={handleStop}>
              Stop
            </button>
          ) : (
            <button
              type="button"
              className={styles.executeButton}
              onClick={handleExecute}
              disabled={!query.trim() || !selectedTool}
            >
              Execute
            </button>
          )}
        </div>
      </div>

      {/* Stream output */}
      <div className={styles.outputPanel}>
        {events.length > 0 ? (
          <StreamOutput events={events} errors={[]} currentPid={null} />
        ) : (
          <div className={styles.outputPlaceholder}>Stream output will appear here...</div>
        )}
      </div>
    </div>
  );
}
