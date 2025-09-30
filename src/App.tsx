import type React from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import type { StreamEvent } from './lib/types';
import {
  extractTextFromMessage,
  extractToolUsesFromMessage,
  isAssistantEvent,
  isErrorEvent,
  isResultEvent,
  isSystemInitEvent,
} from './lib/types';

function App() {
  const projectPathId = useId();
  const queryId = useId();
  const [projectPath, setProjectPath] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [currentPid, setCurrentPid] = useState<number | null>(null);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [errors, setErrors] = useState<Array<{ id: string; message: string }>>([]);
  const outputEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    // Auto-scroll to bottom
    outputEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

  const renderStreamEvent = (event: StreamEvent, index: number): React.ReactNode => {
    // Use type guards for type-safe event handling
    if (isSystemInitEvent(event)) {
      return (
        <div key={index} style={styles.eventBox}>
          <strong>🔧 System Init</strong>
          <div>Session: {event.session_id}</div>
          <div>CWD: {event.cwd}</div>
          <div>Model: {event.model}</div>
          {event.tools.length > 0 && (
            <div style={styles.infoText}>Tools: {event.tools.join(', ')}</div>
          )}
        </div>
      );
    }

    if (isAssistantEvent(event)) {
      const textContent = extractTextFromMessage(event.message);
      const toolUses = extractToolUsesFromMessage(event.message);

      return (
        <div key={index} style={styles.eventBox}>
          <strong>🤖 Assistant</strong>
          {textContent && <div style={styles.contentText}>{textContent}</div>}
          {toolUses.map((tool) => (
            <div key={tool.id} style={styles.toolUse}>
              <div>🔨 Tool: {tool.name}</div>
              <pre style={styles.codeBlock}>{JSON.stringify(tool.input, null, 2)}</pre>
            </div>
          ))}
          <div style={styles.infoText}>
            Tokens - Input: {event.message.usage.input_tokens} | Output:{' '}
            {event.message.usage.output_tokens}
          </div>
        </div>
      );
    }

    if (isResultEvent(event)) {
      return (
        <div key={index} style={styles.eventBox}>
          <strong>✅ Result</strong>
          <div>Status: {event.subtype}</div>
          {event.result && <div style={styles.contentText}>{event.result}</div>}
          <div>
            Duration: {event.duration_ms}ms (API: {event.duration_api_ms}ms)
          </div>
          <div>Turns: {event.num_turns}</div>
          <div>Cost: ${event.total_cost_usd.toFixed(6)}</div>
          <div style={styles.infoText}>
            Total - Input: {event.usage.input_tokens} | Output: {event.usage.output_tokens}
            {event.usage.cache_read_input_tokens &&
              ` | Cache Read: ${event.usage.cache_read_input_tokens}`}
          </div>
        </div>
      );
    }

    if (isErrorEvent(event)) {
      return (
        <div key={index} style={styles.errorBox}>
          <strong>❌ Error</strong>
          <div style={styles.contentText}>
            {event.error.type}: {event.error.message}
          </div>
        </div>
      );
    }

    // Fallback for unknown event types
    return (
      <div key={index} style={styles.eventBox}>
        <strong>📦 {event.type}</strong>
        <pre style={styles.codeBlock}>{JSON.stringify(event, null, 2)}</pre>
      </div>
    );
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
        <div style={styles.outputHeader}>
          <h3 style={styles.outputTitle}>
            Stream Output
            {currentPid && <span style={styles.pidBadge}>PID: {currentPid}</span>}
          </h3>
          <div style={styles.stats}>
            <span style={styles.statBadge}>Events: {streamEvents.length}</span>
            {errors.length > 0 && <span style={styles.errorBadge}>Errors: {errors.length}</span>}
          </div>
        </div>

        <div style={styles.outputContent}>
          {streamEvents.length === 0 && errors.length === 0 ? (
            <p style={styles.emptyMessage}>
              No output yet. Execute a query to see stream-json output.
            </p>
          ) : (
            <>
              {streamEvents.map((event, index) => renderStreamEvent(event, index))}
              {errors.map((error) => (
                <div key={error.id} style={styles.errorBox}>
                  <div style={styles.eventType}>❌ Error</div>
                  <pre style={styles.eventData}>{error.message}</pre>
                </div>
              ))}
            </>
          )}
          <div ref={outputEndRef} />
        </div>
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
  outputHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px',
  },
  outputTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  pidBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#007acc',
    color: 'white',
    borderRadius: '3px',
    fontWeight: 'normal',
  },
  stats: {
    display: 'flex',
    gap: '10px',
  },
  statBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#e9ecef',
    borderRadius: '3px',
  },
  errorBadge: {
    fontSize: '12px',
    padding: '4px 8px',
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderRadius: '3px',
    fontWeight: 500,
  },
  outputContent: {
    flex: 1,
    overflowY: 'auto',
    backgroundColor: 'white',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '15px',
  },
  emptyMessage: {
    color: '#999',
    textAlign: 'center',
    padding: '40px 20px',
    fontSize: '14px',
  },
  eventBox: {
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '4px',
  },
  eventType: {
    fontSize: '12px',
    fontWeight: 600,
    color: '#495057',
    marginBottom: '5px',
  },
  eventData: {
    fontSize: '11px',
    fontFamily: 'monospace',
    margin: 0,
    padding: '8px',
    backgroundColor: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '3px',
    overflow: 'auto',
    maxHeight: '200px',
  },
  contentDelta: {
    marginBottom: '5px',
    padding: '8px 12px',
    backgroundColor: '#e3f2fd',
    borderLeft: '3px solid #2196f3',
    borderRadius: '3px',
    fontSize: '14px',
    lineHeight: '1.6',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  },
  errorBox: {
    marginBottom: '10px',
    padding: '10px',
    backgroundColor: '#f8d7da',
    border: '1px solid #f5c6cb',
    borderRadius: '4px',
  },
  contentText: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#fff',
    border: '1px solid #e9ecef',
    borderRadius: '3px',
    fontSize: '14px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
  },
  toolUse: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#fff3cd',
    border: '1px solid #ffeaa7',
    borderRadius: '3px',
  },
  codeBlock: {
    marginTop: '4px',
    fontSize: '11px',
    fontFamily: 'monospace',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    border: '1px solid #dee2e6',
    borderRadius: '3px',
    overflow: 'auto',
    maxHeight: '200px',
  },
  infoText: {
    fontSize: '12px',
    color: '#666',
    marginTop: '8px',
  },
};

export default App;
