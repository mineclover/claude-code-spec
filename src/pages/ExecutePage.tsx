/**
 * Execute Page
 * Uses sidebar tool selection + dynamic options + query input + stream output
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { OptionPanel } from '../components/options/OptionPanel';
import { StreamOutput } from '../components/stream/StreamOutput';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import type { CLIToolDefinition } from '../types/cli-tool';
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

export function ExecutePage() {
  const { projectPath } = useProject();
  const { selectedToolId } = useToolContext();
  const [tools, setTools] = useState<CLIToolDefinition[]>([]);
  const [selectedTool, setSelectedTool] = useState<CLIToolDefinition | null>(null);
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
            <OptionPanel
              options={selectedTool.options}
              values={options}
              onChange={handleOptionChange}
            />
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
