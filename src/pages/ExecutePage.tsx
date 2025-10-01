import type React from 'react';
import { useEffect, useState } from 'react';
import { StreamOutput } from '../components/stream/StreamOutput';
import type { StreamEvent } from '../lib/types';
import styles from './ExecutePage.module.css';

export const ExecutePage: React.FC = () => {
  const [projectPath, setProjectPath] = useState('');
  const [query, setQuery] = useState('');
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPid, setCurrentPid] = useState<number | null>(null);

  const handleSelectDirectory = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      setProjectPath(path);
    }
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      setError('Please select a project directory and enter a query');
      return;
    }

    setIsRunning(true);
    setError(null);
    setEvents([]);
    setErrors([]);
    setCurrentPid(null);

    try {
      const result = await window.claudeAPI.executeClaudeCommand(projectPath, query);

      if (result.success && result.pid) {
        setCurrentPid(result.pid);
      } else if (!result.success) {
        setError(result.error || 'Failed to execute command');
        setIsRunning(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsRunning(false);
    }
  };

  // Event listeners - setup once
  useEffect(() => {
    window.claudeAPI.onClaudeStarted((data) => {
      console.log('[ExecutePage] Claude started:', data);
      setIsRunning(true);
      setCurrentPid(data.pid);
    });

    window.claudeAPI.onClaudeStream((data) => {
      setEvents((prev) => [...prev, data.data]);
    });

    window.claudeAPI.onClaudeError((data) => {
      console.error('[ExecutePage] Claude error:', data);
      setError(data.error);
      setErrors((prev) => [...prev, { id: Date.now().toString(), message: data.error }]);
    });

    window.claudeAPI.onClaudeComplete((data) => {
      console.log('[ExecutePage] Claude complete:', data);
      setIsRunning(false);
      setCurrentPid(null);
    });
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <div className={styles.inputGroup}>
          <label>Project Path</label>
          <div className={styles.pathInput}>
            <input
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="/path/to/project"
              className={styles.input}
            />
            <button type="button" onClick={handleSelectDirectory} className={styles.browseButton}>
              Browse
            </button>
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label>Query</label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query..."
            className={styles.textarea}
            rows={3}
          />
        </div>

        <button
          type="button"
          onClick={handleExecute}
          disabled={isRunning}
          className={styles.executeButton}
        >
          {isRunning ? 'Running...' : 'Execute'}
        </button>

        {error && <div className={styles.error}>{error}</div>}

        {currentPid && <div className={styles.status}>Running (PID: {currentPid})</div>}
      </div>

      <div className={styles.output}>
        <StreamOutput events={events} errors={errors} currentPid={currentPid} />
      </div>
    </div>
  );
};
