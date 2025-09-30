import type React from 'react';
import { useEffect, useId, useState } from 'react';
import { StreamOutput } from './components/stream/StreamOutput';
import type { StreamEvent } from './lib/types';

function App() {
  const projectPathId = useId();
  const queryId = useId();
  const [projectPath, setProjectPath] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentPid, setCurrentPid] = useState<number | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);

  useEffect(() => {
    // Setup IPC listeners
    window.claudeAPI.onClaudeStarted((data) => {
      console.log('[Renderer] Process started:', data.pid);
      setCurrentPid(data.pid);
      setIsExecuting(true);
      setStreamEvents([]);
      setErrors([]);
    });

    window.claudeAPI.onClaudeStream((data) => {
      console.log('[Renderer] Stream event:', data.data);
      setStreamEvents((prev) => [...prev, data.data]);
    });

    window.claudeAPI.onClaudeError((data) => {
      console.error('[Renderer] Error:', data.error);
      setErrors((prev) => [
        ...prev,
        { id: `error-${Date.now()}-${Math.random()}`, message: data.error },
      ]);
    });

    window.claudeAPI.onClaudeComplete((data) => {
      console.log('[Renderer] Process complete:', data);
      setIsExecuting(false);
    });
  }, []);

  const handleSelectDirectory = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      setProjectPath(path);
    }
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      alert('Please select a project directory and enter a query');
      return;
    }

    console.log('[Renderer] Executing:', { projectPath, query });
    const result = await window.claudeAPI.executeClaudeCommand(projectPath, query);

    if (!result.success) {
      alert(`Failed to execute: ${result.error}`);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Claude Code Headless Controller</h1>
        <p style={styles.subtitle}>Stream JSON Output Mode</p>
      </div>

      <div style={styles.inputSection}>
        <div style={styles.inputGroup}>
          <label htmlFor={projectPathId} style={styles.label}>
            Project Directory:
          </label>
          <div style={styles.inputRow}>
            <input
              id={projectPathId}
              type="text"
              value={projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="Select or enter project directory"
              style={styles.input}
              disabled={isExecuting}
            />
            <button
              type="button"
              onClick={handleSelectDirectory}
              style={styles.browseButton}
              disabled={isExecuting}
            >
              Browse...
            </button>
          </div>
        </div>

        <div style={styles.inputGroup}>
          <label htmlFor={queryId} style={styles.label}>
            Query:
          </label>
          <textarea
            id={queryId}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query for Claude"
            rows={4}
            style={styles.textarea}
            disabled={isExecuting}
          />
        </div>

        <button
          type="button"
          onClick={handleExecute}
          style={{
            ...styles.executeButton,
            ...(isExecuting ? styles.executeButtonDisabled : {}),
          }}
          disabled={isExecuting}
        >
          {isExecuting ? `⏳ Executing (PID: ${currentPid})...` : '▶️ Execute'}
        </button>
      </div>

      <div style={styles.outputSection}>
        <StreamOutput events={streamEvents} errors={errors} currentPid={currentPid} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: '20px 30px',
    backgroundColor: '#007acc',
    color: 'white',
    borderBottom: '3px solid #005a9e',
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 600,
  },
  subtitle: {
    margin: '5px 0 0 0',
    fontSize: '14px',
    opacity: 0.9,
  },
  inputSection: {
    padding: '20px 30px',
    backgroundColor: 'white',
    borderBottom: '1px solid #ddd',
  },
  inputGroup: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    fontSize: '14px',
    fontWeight: 500,
    color: '#333',
  },
  inputRow: {
    display: 'flex',
    gap: '10px',
  },
  input: {
    flex: 1,
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontFamily: 'monospace',
  },
  textarea: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    fontFamily: 'monospace',
    resize: 'vertical',
  },
  browseButton: {
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: '#6c757d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  executeButton: {
    padding: '12px 24px',
    fontSize: '16px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 600,
  },
  executeButtonDisabled: {
    backgroundColor: '#6c757d',
    cursor: 'not-allowed',
  },
  outputSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 30px',
    overflow: 'hidden',
  },
};

export default App;
