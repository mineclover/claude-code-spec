import React, { useState, useEffect, useRef } from 'react';
import type { SessionInfo, RunningProcess, PersistentProcess, ClaudeExecutionOptions } from './global';

// Debug logging
const DEBUG = true; // Enable by default for development
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[Renderer]', ...args);
  }
};

interface ProcessOutput {
  responses: string[];
  errors: string[];
}

function App() {
  const [projectPath, setProjectPath] = useState<string>('');
  const [query, setQuery] = useState<string>('');
  const [processes, setProcesses] = useState<Map<number, ProcessOutput>>(new Map());
  const [runningProcesses, setRunningProcesses] = useState<RunningProcess[]>([]);
  const [persistentProcesses, setPersistentProcesses] = useState<PersistentProcess[]>([]);
  const [selectedPersistentPid, setSelectedPersistentPid] = useState<number | null>(null);
  const [selectedPid, setSelectedPid] = useState<number | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [showSessions, setShowSessions] = useState(false);
  const [claudeStatus, setClaudeStatus] = useState<{ available: boolean; authenticated: boolean; error?: string } | null>(null);
  const [dirValidation, setDirValidation] = useState<{ valid: boolean; error?: string; realPath?: string } | null>(null);
  const responsesEndRef = useRef<HTMLDivElement>(null);

  // Developer debug room
  const [showDebugRoom, setShowDebugRoom] = useState(false);
  const [testCommand, setTestCommand] = useState<string>('echo "Hello from PID $$"');
  const [debugOutput, setDebugOutput] = useState<string[]>([]);
  const debugEndRef = useRef<HTMLDivElement>(null);

  // Claude execution options
  const [outputFormat, setOutputFormat] = useState<'json' | 'markdown' | 'text'>('json');
  const [skipPermissions, setSkipPermissions] = useState<boolean>(true);

  useEffect(() => {
    log('🔧 Setting up IPC listeners');

    // Check Claude CLI status on mount
    checkClaudeStatus();

    // Setup IPC listeners
    window.claudeAPI.onClaudeResponse((pid: number, data: string) => {
      log('📥 Received response for PID', pid, ':', data.substring(0, 100) + (data.length > 100 ? '...' : ''));
      setProcesses((prev) => {
        const newMap = new Map(prev);
        const processOutput = newMap.get(pid) || { responses: [], errors: [] };
        processOutput.responses.push(data);
        newMap.set(pid, processOutput);
        return newMap;
      });
    });

    window.claudeAPI.onClaudeError((pid: number, error: string) => {
      log('⚠️ Received error for PID', pid, ':', error.substring(0, 100) + (error.length > 100 ? '...' : ''));
      setProcesses((prev) => {
        const newMap = new Map(prev);
        const processOutput = newMap.get(pid) || { responses: [], errors: [] };
        processOutput.errors.push(error);
        newMap.set(pid, processOutput);
        return newMap;
      });
    });

    window.claudeAPI.onClaudeComplete((pid: number) => {
      log('✅ Execution complete for PID', pid);
      loadProcesses(); // Reload process list
      loadSessions(); // Reload sessions after completion
    });

    window.claudeAPI.onProcessStarted((process: { pid: number; projectPath: string; query: string }) => {
      log('🚀 Process started:', process);
      setSelectedPid(process.pid);
      setProcesses((prev) => {
        const newMap = new Map(prev);
        newMap.set(process.pid, { responses: [], errors: [] });
        return newMap;
      });
      loadProcesses();
    });

    window.claudeAPI.onSessionUpdate((sessionId: string) => {
      log('💾 Session updated:', sessionId);
      setCurrentSessionId(sessionId);
      loadSessions();
    });

    window.claudeAPI.onPwdUpdate((update: { pid: number; currentPath: string }) => {
      log('📍 PWD updated for PID', update.pid, ':', update.currentPath);
      setPersistentProcesses((prev) => {
        return prev.map((proc) => {
          if (proc.pid === update.pid) {
            return { ...proc, currentPath: update.currentPath };
          }
          return proc;
        });
      });

      // If this is the selected process, update the project path input
      if (update.pid === selectedPersistentPid) {
        setProjectPath(update.currentPath);
      }
    });

    window.claudeAPI.onDebugOutput((data: { pid: number; output: string }) => {
      log('🐛 Debug output from PID', data.pid, ':', data.output);
      setDebugOutput((prev) => [...prev, `[PID ${data.pid}] ${data.output}`]);
    });

    // Load initial data
    loadSessions();
    loadProcesses();
    loadPersistentProcesses();
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom when selected process changes
    responsesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedPid, processes]);

  const checkClaudeStatus = async () => {
    try {
      const status = await window.claudeAPI.checkStatus();
      setClaudeStatus(status);
      log('📊 Claude status:', status);
    } catch (error) {
      log('❌ Failed to check Claude status:', error);
      setClaudeStatus({ available: false, authenticated: false, error: 'Check failed' });
    }
  };

  const loadSessions = async () => {
    try {
      const sessionList = await window.claudeAPI.getSessions();
      setSessions(sessionList);
      log('📋 Loaded sessions:', sessionList.length);
    } catch (error) {
      log('❌ Failed to load sessions:', error);
    }
  };

  const loadProcesses = async () => {
    try {
      const processList = await window.claudeAPI.getProcesses();
      setRunningProcesses(processList);
      log('📋 Loaded processes:', processList.length);
    } catch (error) {
      log('❌ Failed to load processes:', error);
    }
  };

  const loadPersistentProcesses = async () => {
    try {
      const processList = await window.claudeAPI.getPersistentProcesses();
      setPersistentProcesses(processList);
      log('📋 Loaded persistent processes:', processList.length);
      // Auto-select first persistent process if none selected
      if (processList.length > 0 && !selectedPersistentPid) {
        const firstProc = processList[0];
        setSelectedPersistentPid(firstProc.pid);
        setProjectPath(firstProc.currentPath);
      }
    } catch (error) {
      log('❌ Failed to load persistent processes:', error);
    }
  };

  // Update project path when persistent PID changes
  useEffect(() => {
    if (selectedPersistentPid) {
      const proc = persistentProcesses.find(p => p.pid === selectedPersistentPid);
      if (proc) {
        setProjectPath(proc.currentPath);
        log('📍 Updated project path from PID', selectedPersistentPid, ':', proc.currentPath);
      }
    }
  }, [selectedPersistentPid, persistentProcesses]);

  const handleCreatePersistentProcess = async () => {
    const pid = await window.claudeAPI.createPersistentProcess(projectPath || undefined);
    if (pid) {
      log('✅ Created persistent process:', pid);
      loadPersistentProcesses();
    }
  };

  const handleKillProcess = async (pid: number) => {
    try {
      const success = await window.claudeAPI.killProcess(pid);
      if (success) {
        log('✅ Process killed:', pid);
        loadProcesses();
        if (selectedPid === pid) {
          setSelectedPid(null);
        }
      }
    } catch (error) {
      log('❌ Failed to kill process:', error);
    }
  };

  const validatePath = async (path: string) => {
    if (!path) {
      setDirValidation(null);
      return;
    }

    try {
      const validation = await window.claudeAPI.validateDirectory(path);
      setDirValidation(validation);
      log('📁 Directory validation:', validation);
    } catch (error) {
      log('❌ Validation error:', error);
      setDirValidation({ valid: false, error: 'Validation failed' });
    }
  };

  const handleSelectDirectory = async () => {
    log('🗂️ Opening directory selector');
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      log('✅ Directory selected:', path);
      setProjectPath(path);
      await validatePath(path);
    } else {
      log('❌ Directory selection canceled');
    }
  };

  const handleTestCommand = async () => {
    if (!selectedPersistentPid) {
      alert('Please select a persistent process first');
      return;
    }

    log('🧪 Executing test command:', testCommand);
    setDebugOutput((prev) => [...prev, `>>> ${testCommand}`]);

    try {
      await window.claudeAPI.executeTestCommand(selectedPersistentPid, testCommand);
    } catch (error) {
      log('❌ Test command failed:', error);
      setDebugOutput((prev) => [...prev, `❌ Error: ${error.message}`]);
    }
  };

  const clearDebugOutput = () => {
    setDebugOutput([]);
  };

  const handlePathChange = async (path: string) => {
    setProjectPath(path);
    await validatePath(path);
  };

  const handleExecute = async () => {
    if (!projectPath || !query) {
      log('⚠️ Missing project path or query');
      alert('Please select a project directory and enter a query');
      return;
    }

    if (!selectedPersistentPid) {
      log('⚠️ No persistent process selected');
      alert('Please select a persistent process first');
      return;
    }

    const options: ClaudeExecutionOptions = {
      outputFormat,
      skipPermissions,
    };

    log('🚀 Executing Claude command in persistent process', { pid: selectedPersistentPid, projectPath, query, options });
    await window.claudeAPI.executeInProcess(selectedPersistentPid, projectPath, query, options);
    setSelectedPid(selectedPersistentPid);
    log('📤 Command sent to persistent process');
  };

  const handleResumeSession = async (session: SessionInfo) => {
    log('🔄 Resuming session:', session.sessionId);
    setProjectPath(session.projectPath);

    await window.claudeAPI.executeClaudeCommand(session.projectPath, query || '', session.sessionId);
    log('📤 Resume command sent');
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'monospace' }}>
      {/* Session History Sidebar */}
      <div
        style={{
          width: showSessions ? '300px' : '0px',
          transition: 'width 0.3s',
          borderRight: '1px solid #ccc',
          overflow: 'hidden',
          backgroundColor: '#f9f9f9',
        }}
      >
        {showSessions && (
          <div style={{ padding: '20px' }}>
            <h3>Session History</h3>
            <div style={{ maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              {sessions.length === 0 ? (
                <p style={{ color: '#666', fontSize: '12px' }}>No sessions yet</p>
              ) : (
                sessions.map((session) => (
                  <div
                    key={session.sessionId}
                    style={{
                      padding: '10px',
                      marginBottom: '10px',
                      backgroundColor: currentSessionId === session.sessionId ? '#e3f2fd' : 'white',
                      border: '1px solid #ddd',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                    }}
                    onClick={() => handleResumeSession(session)}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#007acc' }}>
                      {session.sessionId.substring(0, 8)}...
                    </div>
                    <div style={{ color: '#666', marginBottom: '3px' }}>
                      {formatTimestamp(session.timestamp)}
                    </div>
                    <div style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#333'
                    }}>
                      {session.query}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h1>Claude CLI Headless Controller</h1>
          <button
            onClick={() => setShowSessions(!showSessions)}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            {showSessions ? 'Hide' : 'Show'} Sessions ({sessions.length})
          </button>
        </div>

        {/* Persistent Process Selection */}
        <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>Persistent Processes</h3>
            <button
              onClick={handleCreatePersistentProcess}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              + New Process
            </button>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {persistentProcesses.map((proc) => (
              <div
                key={proc.pid}
                onClick={() => setSelectedPersistentPid(proc.pid)}
                style={{
                  padding: '12px',
                  backgroundColor: selectedPersistentPid === proc.pid ? '#007acc' : 'white',
                  color: selectedPersistentPid === proc.pid ? 'white' : 'black',
                  border: selectedPersistentPid === proc.pid ? '2px solid #005a9e' : '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  minWidth: '200px',
                  maxWidth: '300px',
                  boxShadow: selectedPersistentPid === proc.pid ? '0 2px 8px rgba(0,122,204,0.3)' : '0 1px 3px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '6px' }}>
                  🔧 PID: {proc.pid}
                </div>
                <div style={{ fontSize: '11px', marginTop: '4px', marginBottom: '4px' }}>
                  Status: {proc.status === 'idle' ? '🟢 Idle' : proc.status === 'busy' ? '🟡 Busy' : '🔴 Failed'}
                </div>
                <div style={{ fontSize: '10px', marginTop: '2px', opacity: 0.7 }}>
                  📊 Executions: {proc.executionCount || 0}
                  {proc.lastExecutionTime && (
                    <span style={{ marginLeft: '8px' }}>
                      🕐 {new Date(proc.lastExecutionTime).toLocaleTimeString()}
                    </span>
                  )}
                </div>
                <div style={{
                  fontSize: '10px',
                  marginTop: '4px',
                  wordBreak: 'break-all',
                  opacity: 0.8,
                  borderTop: selectedPersistentPid === proc.pid ? '1px solid rgba(255,255,255,0.3)' : '1px solid #eee',
                  paddingTop: '6px',
                }}>
                  📁 {proc.currentPath.length > 40 ? '...' + proc.currentPath.substring(proc.currentPath.length - 37) : proc.currentPath}
                </div>
                {proc.lastQuery && (
                  <div style={{
                    fontSize: '10px',
                    marginTop: '4px',
                    opacity: 0.7,
                    fontStyle: 'italic',
                  }}>
                    Last: {proc.lastQuery.substring(0, 30)}{proc.lastQuery.length > 30 ? '...' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
          {persistentProcesses.length === 0 && (
            <p style={{ color: '#666', fontSize: '12px', margin: '10px 0' }}>No persistent processes. Creating one...</p>
          )}
        </div>

        {claudeStatus && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: claudeStatus.available && claudeStatus.authenticated ? '#e8f5e9' : '#ffebee',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span>
              {claudeStatus.available && claudeStatus.authenticated ? (
                <>✅ Claude CLI: Ready</>
              ) : claudeStatus.available && !claudeStatus.authenticated ? (
                <>🔐 Claude CLI: Not authenticated (run `claude login`)</>
              ) : (
                <>❌ Claude CLI: Not installed</>
              )}
            </span>
            <button
              onClick={checkClaudeStatus}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: '#007acc',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
        )}

        {currentSessionId && (
          <div style={{
            padding: '8px 12px',
            backgroundColor: '#e8f5e9',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '12px',
          }}>
            💾 Current Session: <code>{currentSessionId}</code>
          </div>
        )}

      <div style={{ marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
            <label style={{ display: 'block' }}>
              Project Directory:
            </label>
            {selectedPersistentPid && (
              <div style={{
                fontSize: '11px',
                padding: '4px 8px',
                backgroundColor: '#007acc',
                color: 'white',
                borderRadius: '3px',
                fontWeight: 'bold',
              }}>
                🎛️ Controlling PID: {selectedPersistentPid}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexDirection: 'column' }}>
            <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'center' }}>
              <input
                type="text"
                value={projectPath}
                onChange={(e) => handlePathChange(e.target.value)}
                placeholder={selectedPersistentPid ? `Set directory for PID ${selectedPersistentPid}` : "Select or enter project directory"}
                style={{
                  flex: 1,
                  padding: '8px',
                  fontSize: '14px',
                  border: `1px solid ${dirValidation?.valid === false ? '#f44336' : dirValidation?.valid ? '#4caf50' : '#ccc'}`,
                  borderRadius: '4px',
                  backgroundColor: dirValidation?.valid === false ? '#ffebee' : dirValidation?.valid ? '#e8f5e9' : 'white',
                }}
                disabled={!selectedPersistentPid}
              />
              <button
                onClick={handleSelectDirectory}
                disabled={!selectedPersistentPid}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  backgroundColor: selectedPersistentPid ? '#007acc' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: selectedPersistentPid ? 'pointer' : 'not-allowed',
                }}
              >
                Browse...
              </button>
            </div>
            {dirValidation && (
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                {dirValidation.valid ? (
                  <span style={{ color: '#4caf50' }}>
                    ✅ Valid directory: {dirValidation.realPath}
                  </span>
                ) : (
                  <span style={{ color: '#f44336' }}>
                    ❌ {dirValidation.error}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <label style={{ display: 'block', marginBottom: '5px' }}>
            Query:
          </label>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selectedPersistentPid ? `Enter query for PID ${selectedPersistentPid}` : "Select a persistent process first"}
            rows={4}
            style={{
              width: '100%',
              padding: '8px',
              fontSize: '14px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontFamily: 'monospace',
            }}
            disabled={!selectedPersistentPid}
          />
        </div>

        {/* Execution Options */}
        <div style={{
          marginBottom: '10px',
          padding: '10px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #ddd',
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px', fontSize: '13px' }}>
            ⚙️ Execution Options
          </div>
          <div style={{ display: 'flex', gap: '20px', fontSize: '13px' }}>
            <div>
              <label style={{ marginRight: '8px' }}>Output Format:</label>
              <select
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value as 'json' | 'markdown' | 'text')}
                style={{
                  padding: '4px 8px',
                  borderRadius: '3px',
                  border: '1px solid #ccc',
                }}
                disabled={!selectedPersistentPid}
              >
                <option value="json">JSON</option>
                <option value="markdown">Markdown</option>
                <option value="text">Text</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={skipPermissions}
                  onChange={(e) => setSkipPermissions(e.target.checked)}
                  style={{ marginRight: '6px' }}
                  disabled={!selectedPersistentPid}
                />
                Skip Permissions (--dangerously-skip-permissions)
              </label>
            </div>
          </div>
        </div>

        <button
          onClick={handleExecute}
          disabled={!selectedPersistentPid}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: selectedPersistentPid ? '#28a745' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedPersistentPid ? 'pointer' : 'not-allowed',
          }}
        >
          {selectedPersistentPid ? `Execute in PID ${selectedPersistentPid}` : 'Select Process First'}
        </button>
      </div>

      {/* Running Processes */}
      {runningProcesses.length > 0 && (
        <div style={{ marginBottom: '20px', marginTop: '20px' }}>
          <h3>Running Processes ({runningProcesses.length})</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {runningProcesses.map((proc) => (
              <div
                key={proc.pid}
                onClick={() => setSelectedPid(proc.pid)}
                style={{
                  padding: '10px',
                  backgroundColor: selectedPid === proc.pid ? '#e3f2fd' : 'white',
                  border: `2px solid ${selectedPid === proc.pid ? '#007acc' : '#ddd'}`,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  minWidth: '150px',
                }}
              >
                <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                  PID: {proc.pid}
                  {proc.status === 'running' && <span style={{ color: '#4caf50' }}> ●</span>}
                  {proc.status === 'completed' && <span style={{ color: '#2196f3' }}> ✓</span>}
                  {proc.status === 'failed' && <span style={{ color: '#f44336' }}> ✗</span>}
                </div>
                <div style={{ color: '#666', fontSize: '11px', marginBottom: '3px' }}>
                  {proc.query.substring(0, 30)}...
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '10px', color: '#999' }}>
                    {new Date(proc.startTime).toLocaleTimeString()}
                  </span>
                  {proc.status === 'running' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleKillProcess(proc.pid);
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '10px',
                        backgroundColor: '#f44336',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                      }}
                    >
                      Kill
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '10px',
          minHeight: '400px',
          maxHeight: '600px',
          overflowY: 'auto',
          backgroundColor: '#f5f5f5',
        }}
      >
        <h3>Output: {selectedPid ? `PID ${selectedPid}` : 'No process selected'}</h3>
        {(() => {
          if (!selectedPid) {
            return <p style={{ color: '#666' }}>Select a process to view output...</p>;
          }
          const processOutput = processes.get(selectedPid);
          if (!processOutput || (processOutput.responses.length === 0 && processOutput.errors.length === 0)) {
            return <p style={{ color: '#666' }}>No output yet...</p>;
          }
          return (
            <>
              {processOutput.responses.map((response, index) => (
                <div
                  key={`response-${index}`}
                  style={{
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: 'white',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {response}
                </div>
              ))}

              {processOutput.errors.map((error, index) => (
                <div
                  key={`error-${index}`}
                  style={{
                    marginBottom: '10px',
                    padding: '8px',
                    backgroundColor: '#ffe6e6',
                    color: '#c00',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {error}
                </div>
              ))}
            </>
          );
        })()}

        <div ref={responsesEndRef} />
      </div>

      {/* Developer Debug Room */}
      <div style={{
        position: 'fixed',
        bottom: showDebugRoom ? '0' : '-400px',
        left: '0',
        right: '0',
        height: '400px',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        borderTop: '2px solid #007acc',
        transition: 'bottom 0.3s ease-in-out',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '10px 15px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #444',
        }}>
          <h3 style={{ margin: 0, fontSize: '14px', color: '#4ec9b0' }}>
            🐛 Developer Debug Room
          </h3>
          <button
            onClick={() => setShowDebugRoom(!showDebugRoom)}
            style={{
              padding: '4px 12px',
              fontSize: '12px',
              backgroundColor: '#007acc',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {showDebugRoom ? '▼ Hide' : '▲ Show'}
          </button>
        </div>

        <div style={{ display: 'flex', padding: '10px 15px', gap: '10px', borderBottom: '1px solid #444' }}>
          <input
            type="text"
            value={testCommand}
            onChange={(e) => setTestCommand(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleTestCommand()}
            placeholder="Enter test command (e.g., echo 'test', pwd, ls)"
            style={{
              flex: 1,
              padding: '8px',
              fontSize: '13px',
              backgroundColor: '#3c3c3c',
              color: '#d4d4d4',
              border: '1px solid #555',
              borderRadius: '3px',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={handleTestCommand}
            disabled={!selectedPersistentPid}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              backgroundColor: selectedPersistentPid ? '#4caf50' : '#555',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: selectedPersistentPid ? 'pointer' : 'not-allowed',
            }}
          >
            Execute
          </button>
          <button
            onClick={clearDebugOutput}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              backgroundColor: '#f44336',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            Clear
          </button>
        </div>

        <div style={{
          flex: 1,
          padding: '10px 15px',
          overflowY: 'auto',
          fontFamily: 'monospace',
          fontSize: '12px',
        }}>
          {debugOutput.map((line, index) => (
            <div key={index} style={{
              padding: '2px 0',
              color: line.startsWith('>>>') ? '#4ec9b0' : line.includes('❌') ? '#f48771' : '#d4d4d4',
            }}>
              {line}
            </div>
          ))}
          {debugOutput.length === 0 && (
            <div style={{ color: '#666', fontStyle: 'italic' }}>
              No output yet. Select a persistent process and execute a test command.
            </div>
          )}
          <div ref={debugEndRef} />
        </div>
      </div>

      {/* Debug Room Toggle Button (Always Visible) */}
      {!showDebugRoom && (
        <button
          onClick={() => setShowDebugRoom(true)}
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            padding: '10px 15px',
            fontSize: '14px',
            backgroundColor: '#007acc',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            cursor: 'pointer',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
            zIndex: 999,
            width: '50px',
            height: '50px',
          }}
          title="Open Debug Room"
        >
          🐛
        </button>
      )}
      </div>
    </div>
  );
}

export default App;