import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import { spawn, ChildProcess } from 'node:child_process';
import started from 'electron-squirrel-startup';

// Suppress macOS TSM/IMK warnings (harmless system warnings)
process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true';
app.commandLine.appendSwitch('disable-features', 'IOSurfaceCapturer');

// Debug logging
const DEBUG = process.env.DEBUG === 'true' || process.argv.includes('--debug');
const log = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[Main Process]', ...args);
  }
};

// Session management
interface SessionInfo {
  sessionId: string;
  projectPath: string;
  query: string;
  timestamp: number;
  response?: string;
}

// Process management
interface PersistentProcess {
  pid: number;
  currentPath: string;
  startTime: number;
  status: 'idle' | 'busy' | 'failed';
  lastQuery?: string;
  process: ChildProcess;
  pwdBuffer: string;
  pwdPollingInterval?: NodeJS.Timeout;
  executionCount: number;
  lastExecutionTime?: number;
  stdoutListeners: ((data: Buffer) => void)[];
}

interface RunningProcess {
  pid: number;
  projectPath: string;
  query: string;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
  output: string[];
  errors: string[];
}

const sessions: Map<string, SessionInfo> = new Map();
let currentSessionId: string | null = null;
const persistentProcesses: Map<number, PersistentProcess> = new Map();
const runningProcesses: Map<number, RunningProcess> = new Map();
let processCounter = 0;

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Disable node integration in renderer
      contextIsolation: true, // Enable context isolation for security
      sandbox: false, // Disable sandbox to allow IPC communication
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// Helper function to get comprehensive PATH for all platforms
const getComprehensivePath = (): string => {
  const paths = new Set<string>();
  const platform = process.platform;
  const pathSeparator = platform === 'win32' ? ';' : ':';

  // Add current PATH (filtered)
  if (process.env.PATH) {
    process.env.PATH.split(pathSeparator)
      .filter(p => !p.includes('node_modules'))
      .forEach(p => paths.add(p));
  }

  // Platform-specific paths
  if (platform === 'win32') {
    // Windows paths
    const windowsPaths = [
      'C:\\Windows\\System32',
      'C:\\Windows',
      'C:\\Windows\\System32\\Wbem',
      'C:\\Program Files\\nodejs',
      'C:\\Program Files\\Git\\cmd',
      `${process.env.USERPROFILE}\\AppData\\Local\\Programs\\Python`,
      `${process.env.USERPROFILE}\\AppData\\Roaming\\npm`,
      `${process.env.LOCALAPPDATA}\\Programs\\Python`,
      `${process.env.ProgramFiles}\\dotnet`,
      `${process.env['ProgramFiles(x86)']}\\dotnet`,
    ];
    windowsPaths.forEach(p => paths.add(p));
  } else {
    // Unix-like systems (macOS, Linux)
    const unixPaths = [
      '/usr/local/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
      '/usr/local/sbin',
      `${process.env.HOME}/.local/bin`,
      `${process.env.HOME}/bin`,
    ];

    // macOS specific
    if (platform === 'darwin') {
      unixPaths.push(
        '/opt/homebrew/bin',      // Homebrew on Apple Silicon
        '/opt/homebrew/sbin',
        '/usr/local/opt',
        '/opt/local/bin',         // MacPorts
        '/opt/local/sbin',
      );
    }

    // Linux specific
    if (platform === 'linux') {
      unixPaths.push(
        '/snap/bin',              // Snap packages
        '/usr/games',
        '/usr/local/games',
        `${process.env.HOME}/.cargo/bin`,    // Rust
        `${process.env.HOME}/.npm-global/bin`, // npm global
      );
    }

    unixPaths.forEach(p => paths.add(p));
  }

  return Array.from(paths).filter(p => p).join(pathSeparator);
};

// Setup stdout broadcaster for persistent process
const setupStdoutBroadcaster = (persistentProc: PersistentProcess) => {
  persistentProc.process.stdout.on('data', (data: Buffer) => {
    const dataStr = data.toString();
    log('📡 Broadcasting stdout to', persistentProc.stdoutListeners.length, 'listeners, data length:', dataStr.length);
    log('📡 Data preview:', dataStr.substring(0, 100));

    // Broadcast to all listeners
    persistentProc.stdoutListeners.forEach((listener, index) => {
      try {
        log('  → Calling listener', index);
        listener(data);
      } catch (error) {
        log('⚠️ Listener', index, 'error:', error);
      }
    });
  });
};

// Add a stdout listener to persistent process
const addStdoutListener = (persistentProc: PersistentProcess, listener: (data: Buffer) => void) => {
  persistentProc.stdoutListeners.push(listener);
};

// Remove a stdout listener from persistent process
const removeStdoutListener = (persistentProc: PersistentProcess, listener: (data: Buffer) => void) => {
  const index = persistentProc.stdoutListeners.indexOf(listener);
  if (index > -1) {
    persistentProc.stdoutListeners.splice(index, 1);
  }
};

// Setup pwd polling for a persistent process
const setupPwdPolling = (persistentProc: PersistentProcess, mainWindow: BrowserWindow | null) => {
  const platform = process.platform;
  const pwdCommand = platform === 'win32' ? 'Get-Location | Select-Object -ExpandProperty Path\n' : 'pwd\n';

  // Setup pwd listener
  let stdoutBuffer = '';
  const pwdListener = (data: Buffer) => {
    const output = data.toString();
    stdoutBuffer += output;

    // Look for pwd output pattern (absolute path)
    const lines = stdoutBuffer.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();

      // Detect absolute path (starts with / on Unix or drive letter on Windows)
      const isAbsolutePath = platform === 'win32'
        ? /^[A-Z]:\\.+/.test(trimmed)
        : /^\/[\w\-\/]*/.test(trimmed);

      if (isAbsolutePath && trimmed !== persistentProc.currentPath) {
        log('📍 PWD updated for PID', persistentProc.pid, ':', trimmed);
        persistentProc.currentPath = trimmed;

        // Notify renderer about path update
        if (mainWindow) {
          mainWindow.webContents.send('claude:pwd-update', {
            pid: persistentProc.pid,
            currentPath: trimmed,
          });
        }
      }
    }

    // Keep only the last incomplete line in buffer
    stdoutBuffer = lines[lines.length - 1];
  };

  addStdoutListener(persistentProc, pwdListener);

  // Poll pwd every 5 seconds
  const pollingInterval = setInterval(() => {
    if (persistentProc.status === 'idle') {
      try {
        persistentProc.process.stdin.write(pwdCommand);
      } catch (error) {
        log('⚠️ Failed to poll pwd for PID', persistentProc.pid, ':', error);
      }
    }
  }, 5000);

  persistentProc.pwdPollingInterval = pollingInterval;

  log('✅ PWD polling setup for PID', persistentProc.pid);
};

// Stop pwd polling for a persistent process
const stopPwdPolling = (persistentProc: PersistentProcess) => {
  if (persistentProc.pwdPollingInterval) {
    clearInterval(persistentProc.pwdPollingInterval);
    persistentProc.pwdPollingInterval = undefined;
    log('🛑 PWD polling stopped for PID', persistentProc.pid);
  }
};

// Note: claude doctor functionality removed due to raw mode/TTY requirements
// that are incompatible with persistent process architecture

// Create a persistent Claude process
const createPersistentClaudeProcess = async (cwd: string = process.env.HOME || process.env.USERPROFILE || '/'): Promise<number | null> => {
  try {
    log('🚀 Creating persistent Claude process in:', cwd);

    const platform = process.platform;

    // Get comprehensive PATH
    const comprehensivePath = getComprehensivePath();
    log('📍 Using PATH:', comprehensivePath);

    // Build environment with all necessary variables (platform-agnostic)
    const processEnv: Record<string, string> = {
      PATH: comprehensivePath,
      // Preserve important environment variables
      LANG: process.env.LANG || 'en_US.UTF-8',
      LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
    };

    // Platform-specific environment
    if (platform === 'win32') {
      // Windows
      processEnv.USERPROFILE = process.env.USERPROFILE || '';
      processEnv.USERNAME = process.env.USERNAME || '';
      processEnv.APPDATA = process.env.APPDATA || '';
      processEnv.LOCALAPPDATA = process.env.LOCALAPPDATA || '';
      processEnv.TEMP = process.env.TEMP || '';
      processEnv.TMP = process.env.TMP || '';
      processEnv.SystemRoot = process.env.SystemRoot || 'C:\\Windows';
      processEnv.COMSPEC = process.env.COMSPEC || 'C:\\Windows\\System32\\cmd.exe';
    } else {
      // Unix-like (macOS, Linux)
      processEnv.HOME = process.env.HOME || '';
      processEnv.USER = process.env.USER || '';
      processEnv.SHELL = process.env.SHELL || '/bin/bash';
      processEnv.TERM = 'xterm-256color';
      processEnv.PS1 = '$ ';
      // Ensure access to .claude directory
      processEnv.XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`;
    }

    log('🔧 Process environment:', processEnv);

    // Choose shell based on platform
    let shellCommand: string;
    let shellArgs: string[];

    if (platform === 'win32') {
      // Use PowerShell on Windows for better compatibility
      shellCommand = 'powershell.exe';
      shellArgs = ['-NoLogo', '-NoExit'];
    } else {
      // Use bash on Unix-like systems with login to load profile
      shellCommand = 'bash';
      shellArgs = ['-l', '-i'];
    }

    log('🐚 Using shell:', shellCommand, shellArgs);

    // Start a persistent shell
    const claudeProcess = spawn(shellCommand, shellArgs, {
      cwd,
      env: processEnv,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: false, // Direct spawn, no wrapper shell
    });

    const pid = claudeProcess.pid!;

    const persistentProc: PersistentProcess = {
      pid,
      currentPath: cwd,
      startTime: Date.now(),
      status: 'idle',
      process: claudeProcess,
      pwdBuffer: '',
      executionCount: 0,
      stdoutListeners: [],
    };

    persistentProcesses.set(pid, persistentProc);

    // Setup stdout broadcaster FIRST
    setupStdoutBroadcaster(persistentProc);

    // Log stderr for debugging
    claudeProcess.stderr.on('data', (data) => {
      log('🔍 Persistent process stderr:', data.toString());
    });

    // Handle process exit
    claudeProcess.on('exit', (code) => {
      log('⚠️ Persistent process exited:', { pid, code });
      stopPwdPolling(persistentProc);
      persistentProcesses.delete(pid);
    });

    // Setup pwd polling (will get mainWindow reference later)
    setupPwdPolling(persistentProc, BrowserWindow.getAllWindows()[0] || null);

    log('✅ Persistent Claude process created with PID:', pid);
    return pid;
  } catch (error) {
    log('❌ Failed to create persistent process:', error);
    return null;
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  await createWindow();
  // Create initial persistent process
  await createPersistentClaudeProcess();
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// Helper function to check Claude CLI availability and auth
const checkClaudeAuth = async (): Promise<{ available: boolean; authenticated: boolean; error?: string; pid?: number }> => {
  return new Promise((resolve) => {
    const checkProcess = spawn('claude --version', { shell: true });
    let output = '';

    checkProcess.stdout.on('data', (data) => {
      output += data.toString();
    });

    checkProcess.stderr.on('data', (data) => {
      output += data.toString();
    });

    checkProcess.on('close', (code) => {
      if (code !== 0 || output.includes('command not found')) {
        resolve({ available: false, authenticated: false, error: 'Claude CLI not installed' });
      } else {
        // Check auth by trying a simple command
        const authCheck = spawn('claude -p "test" --output-format json', { shell: true, timeout: 3000 });
        let authOutput = '';
        const authPid = authCheck.pid;

        authCheck.stderr.on('data', (data) => {
          authOutput += data.toString();
        });

        authCheck.on('close', (authCode) => {
          if (authOutput.includes('authentication') || authOutput.includes('login')) {
            resolve({ available: true, authenticated: false, error: 'Not authenticated', pid: authPid });
          } else {
            resolve({ available: true, authenticated: true, pid: authPid });
          }
        });

        authCheck.on('error', () => {
          resolve({ available: true, authenticated: false, error: 'Auth check failed', pid: authPid });
        });

        // Timeout after 3 seconds
        setTimeout(() => {
          authCheck.kill();
          resolve({ available: true, authenticated: true, pid: authPid }); // Assume OK if no error
        }, 3000);
      }
    });

    checkProcess.on('error', () => {
      resolve({ available: false, authenticated: false, error: 'Failed to execute Claude CLI' });
    });
  });
};

// IPC handler for checking Claude CLI status
ipcMain.handle('claude:check-status', async () => {
  log('📤 IPC Request: claude:check-status');
  const status = await checkClaudeAuth();
  log('📊 Claude status:', status);
  return status;
});

// IPC handler for getting persistent processes
ipcMain.handle('claude:get-persistent-processes', async () => {
  log('📤 IPC Request: claude:get-persistent-processes');
  const processes = Array.from(persistentProcesses.values()).map(p => ({
    pid: p.pid,
    currentPath: p.currentPath,
    startTime: p.startTime,
    status: p.status,
    lastQuery: p.lastQuery,
    executionCount: p.executionCount,
    lastExecutionTime: p.lastExecutionTime,
  }));
  log('📋 Returning persistent processes:', processes.length);
  return processes;
});

// IPC handler for creating new persistent process
ipcMain.handle('claude:create-persistent-process', async (_event, cwd?: string) => {
  log('📤 IPC Request: claude:create-persistent-process', cwd);
  const pid = await createPersistentClaudeProcess(cwd);
  return pid;
});

// IPC handler for getting running processes
ipcMain.handle('claude:get-processes', async () => {
  log('📤 IPC Request: claude:get-processes');
  const processes = Array.from(runningProcesses.values()).map(p => ({
    pid: p.pid,
    projectPath: p.projectPath,
    query: p.query,
    startTime: p.startTime,
    status: p.status,
    outputCount: p.output.length,
    errorCount: p.errors.length,
  }));
  log('📋 Returning processes:', processes.length);
  return processes;
});

// IPC handler for killing a process
ipcMain.handle('claude:kill-process', async (_event, pid: number) => {
  log('📤 IPC Request: claude:kill-process', pid);
  const process = runningProcesses.get(pid);
  if (process) {
    try {
      process.kill();
      process.status = 'failed';
      log('🔪 Process killed:', pid);
      return { success: true };
    } catch (error) {
      log('❌ Failed to kill process:', error);
      return { success: false, error: error.message };
    }
  }
  return { success: false, error: 'Process not found' };
});

// Helper function to validate directory
const validateDirectory = async (dirPath: string): Promise<{ valid: boolean; error?: string; realPath?: string }> => {
  const fs = await import('fs/promises');
  const pathModule = await import('path');

  try {
    // Resolve to absolute path
    const absolutePath = pathModule.resolve(dirPath);
    log('🔍 Validating directory:', { input: dirPath, absolute: absolutePath });

    // Check if path exists
    const stats = await fs.stat(absolutePath);

    if (!stats.isDirectory()) {
      return { valid: false, error: 'Path is not a directory' };
    }

    // Check if directory is readable
    try {
      await fs.access(absolutePath, (await import('fs')).constants.R_OK);
    } catch {
      return { valid: false, error: 'Directory is not readable' };
    }

    // Get real path (resolves symlinks)
    const realPath = await fs.realpath(absolutePath);
    log('✅ Directory validated:', realPath);

    return { valid: true, realPath };
  } catch (error) {
    log('❌ Directory validation failed:', error);
    return { valid: false, error: `Directory does not exist or is not accessible: ${error.message}` };
  }
};

// IPC handler for directory validation
ipcMain.handle('claude:validate-directory', async (_event, dirPath: string) => {
  log('📤 IPC Request: claude:validate-directory', dirPath);
  const result = await validateDirectory(dirPath);
  log('📊 Validation result:', result);
  return result;
});

// IPC handler for executing test command in persistent process
ipcMain.handle('claude:execute-test-command', async (event, persistentPid: number, command: string) => {
  log('📤 IPC Request: claude:execute-test-command', { persistentPid, command });

  const persistentProc = persistentProcesses.get(persistentPid);
  if (!persistentProc) {
    event.sender.send('claude:debug-output', { pid: persistentPid, output: '❌ Process not found' });
    return;
  }

  try {
    // Send command to process
    log('🧪 Sending test command:', command);

    // Add output listener FIRST
    const outputListener = (data: Buffer) => {
      const output = data.toString();
      log('📥 Test output:', output);

      // Send to renderer
      event.sender.send('claude:debug-output', {
        pid: persistentPid,
        output: output,
      });
    };

    addStdoutListener(persistentProc, outputListener);

    // Send command
    persistentProc.process.stdin.write(`${command}\n`);

    // Remove listener after 2 seconds
    setTimeout(() => {
      removeStdoutListener(persistentProc, outputListener);
      log('🛑 Test command listener removed');
    }, 2000);

  } catch (error) {
    log('❌ Failed to execute test command:', error);
    event.sender.send('claude:debug-output', { pid: persistentPid, output: `Error: ${error.message}` });
  }
});

// IPC handler for changing persistent process directory
ipcMain.handle('claude:change-directory', async (event, persistentPid: number, projectPath: string) => {
  log('📤 IPC Request: claude:change-directory', { persistentPid, projectPath });

  const persistentProc = persistentProcesses.get(persistentPid);
  if (!persistentProc) {
    return { success: false, error: 'Persistent process not found' };
  }

  try {
    const platform = process.platform;

    // Send cd command (platform-specific)
    if (platform === 'win32') {
      // Windows: use Set-Location in PowerShell
      persistentProc.process.stdin.write(`Set-Location "${projectPath}"\n`);
      await new Promise(resolve => setTimeout(resolve, 100));
      persistentProc.process.stdin.write('Get-Location | Select-Object -ExpandProperty Path\n');
    } else {
      // Unix-like: use cd
      persistentProc.process.stdin.write(`cd "${projectPath}"\n`);
      await new Promise(resolve => setTimeout(resolve, 100));
      persistentProc.process.stdin.write('pwd\n');
    }

    // Optimistically update currentPath (will be corrected by pwd polling if wrong)
    persistentProc.currentPath = projectPath;
    log('✅ Changed directory to:', projectPath);
    return { success: true };
  } catch (error) {
    log('❌ Failed to change directory:', error);
    return { success: false, error: error.message };
  }
});

// IPC handler for executing command in persistent process
ipcMain.handle('claude:execute-in-process', async (event, persistentPid: number, projectPath: string, query: string) => {
  log('📤 IPC Request: claude:execute-in-process', { persistentPid, projectPath, query });

  const persistentProc = persistentProcesses.get(persistentPid);
  if (!persistentProc) {
    event.sender.send('claude:error', { pid: persistentPid, error: '❌ Persistent process not found' });
    return;
  }

  if (persistentProc.status === 'busy') {
    event.sender.send('claude:error', { pid: persistentPid, error: '⚠️ Process is busy' });
    return;
  }

  try {
    persistentProc.status = 'busy';
    persistentProc.lastQuery = query;
    persistentProc.executionCount++;
    persistentProc.lastExecutionTime = Date.now();

    // Update working directory in persistent process state
    persistentProc.currentPath = projectPath;

    log('🚀 Spawning new claude process in:', projectPath);

    // Spawn claude as a separate process (not through bash)
    const claudeArgs = [
      '-p',
      query,
      '--output-format', 'json',
      '--dangerously-skip-permissions'
    ];

    const claudeProcess = spawn('claude', claudeArgs, {
      cwd: projectPath,
      env: {
        ...process.env,
        PATH: getComprehensivePath(),
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    log('✅ Claude process spawned with PID:', claudeProcess.pid);

    // Listen for stdout directly from claude process
    let outputBuffer = '';

    claudeProcess.stdout.on('data', (data: Buffer) => {
      const chunk = data.toString();
      outputBuffer += chunk;
      log('📥 Claude stdout:', chunk.substring(0, 200));

      // Send to renderer
      event.sender.send('claude:response', { pid: persistentPid, data: chunk });
    });

    // Listen for stderr
    claudeProcess.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString();
      log('⚠️ Claude stderr:', chunk);
      event.sender.send('claude:error', { pid: persistentPid, error: chunk });
    });

    // Handle process completion
    claudeProcess.on('close', (code) => {
      log('✅ Claude process closed with code:', code);

      // Try to parse accumulated output as JSON
      if (outputBuffer.includes('{')) {
        try {
          const jsonStart = outputBuffer.indexOf('{');
          const json = JSON.parse(outputBuffer.substring(jsonStart));
          log('✅ Parsed JSON response');

          if (json.content) {
            for (const block of json.content) {
              if (block.type === 'text' && block.text) {
                event.sender.send('claude:response', { pid: persistentPid, data: '\n\n' + block.text });
              }
            }
          }
        } catch (e) {
          log('⚠️ Failed to parse JSON:', e.message);
        }
      }

      // Mark as complete
      persistentProc.status = 'idle';
      event.sender.send('claude:complete', { pid: persistentPid });
    });

    // Handle errors
    claudeProcess.on('error', (error) => {
      log('❌ Claude process error:', error);
      persistentProc.status = 'failed';
      event.sender.send('claude:error', { pid: persistentPid, error: error.message });
      event.sender.send('claude:complete', { pid: persistentPid });
    });

  } catch (error) {
    log('❌ Execution error:', error);
    persistentProc.status = 'failed';
    event.sender.send('claude:error', { pid: persistentPid, error: `Error: ${error.message}` });
  }
});

// IPC handler for Claude CLI execution
ipcMain.handle('claude:execute', async (event, projectPath: string, query: string, sessionId?: string) => {
  log('📤 IPC Request: claude:execute', { projectPath, query, sessionId });

  try {
    // Validate directory first
    const dirValidation = await validateDirectory(projectPath);
    if (!dirValidation.valid) {
      event.sender.send('claude:error', `❌ Invalid directory: ${dirValidation.error}`);
      event.sender.send('claude:complete');
      return;
    }

    // Use the real path (resolved)
    const resolvedPath = dirValidation.realPath!;
    log('📁 Using resolved path:', resolvedPath);

    // Check Claude status
    const status = await checkClaudeAuth();
    if (!status.available) {
      event.sender.send('claude:error', '❌ Claude CLI is not installed. Please install it first: https://github.com/anthropics/claude-code');
      event.sender.send('claude:complete');
      return;
    }
    if (!status.authenticated) {
      event.sender.send('claude:error', '🔐 Claude CLI is not authenticated. Please run `claude login` in terminal first.');
      event.sender.send('claude:complete');
      return;
    }

    log('✅ Claude CLI status OK, proceeding with execution');

    // Build claude command arguments
    const args = [];
    if (sessionId) {
      args.push('--resume', sessionId);
    } else {
      args.push('-p', query);
    }
    args.push('--output-format', 'json', '--dangerously-skip-permissions');

    log('🚀 Executing claude with args:', args);

    // Get comprehensive PATH
    const comprehensivePath = getComprehensivePath();

    // Execute claude directly with cwd option
    const claudeProcess = spawn('claude', args, {
      cwd: resolvedPath,
      env: {
        HOME: process.env.HOME,
        USER: process.env.USER,
        PATH: comprehensivePath,
        DEBUG: 'true',
        SHELL: '/bin/bash',
        // Force non-interactive mode for consistent output
        TERM: 'dumb',
        // Disable colors and formatting
        NO_COLOR: '1',
        FORCE_COLOR: '0',
        // Ensure output is not buffered
        PYTHONUNBUFFERED: '1',
        // Preserve important environment variables
        LANG: process.env.LANG || 'en_US.UTF-8',
        LC_ALL: process.env.LC_ALL || 'en_US.UTF-8',
        // Ensure access to .claude directory
        XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`,
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const internalPid = claudeProcess.pid!;

    log('🚀 Claude process started', {
      pid: internalPid,
      cwd: resolvedPath,
      env: {
        HOME: process.env.HOME,
        USER: process.env.USER,
        PATH: systemPath,
      }
    });

    // Register process
    const processInfo: RunningProcess = {
      pid: internalPid,
      projectPath: resolvedPath,
      query,
      startTime: Date.now(),
      status: 'running',
      output: [],
      errors: [],
    };
    runningProcesses.set(internalPid, processInfo);

    // Notify UI about new process
    event.sender.send('claude:process-started', {
      pid: internalPid,
      projectPath: resolvedPath,
      query,
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let fullResponse = '';
    let detectedSessionId: string | null = null;
    let lastDataTime = Date.now();
    let checkInterval: NodeJS.Timeout | null = null;

    // Function to try parsing current buffer
    const tryParseBuffer = () => {
      if (stdoutBuffer.trim()) {
        try {
          const json = JSON.parse(stdoutBuffer);
          log('✅ Successfully parsed JSON from buffer');
          return json;
        } catch (e) {
          // Not yet complete JSON
          return null;
        }
      }
      return null;
    };

    // Check for stalled process (no data for 2 seconds after receiving some data)
    checkInterval = setInterval(() => {
      if (stdoutBuffer.length > 0 && Date.now() - lastDataTime > 2000) {
        log('⏱️ No new data for 2 seconds, attempting to parse buffer');
        const json = tryParseBuffer();
        if (json) {
          log('✅ Parsed complete response from stalled buffer');
          clearInterval(checkInterval!);
          processJsonResponse(json);
        }
      }
    }, 500);

    const processJsonResponse = (json: any) => {
      log('📥 Processing JSON response for PID:', internalPid);
      log('🔍 JSON structure:', JSON.stringify(json, null, 2).substring(0, 500));

      // Extract session ID - try different possible fields
      if (json.session_id) {
        detectedSessionId = json.session_id;
        currentSessionId = detectedSessionId;
        log('💾 Session ID detected:', detectedSessionId);
      } else if (json.sessionId) {
        detectedSessionId = json.sessionId;
        currentSessionId = detectedSessionId;
        log('💾 Session ID detected (alt):', detectedSessionId);
      }

      // Try multiple possible response formats
      if (json.result) {
        // Format: { result: "...", ... }
        fullResponse = json.result;
        processInfo.output.push(json.result);
        event.sender.send('claude:response', { pid: internalPid, data: json.result });
        log('✅ Extracted from json.result');
      } else if (json.content && Array.isArray(json.content)) {
        // Format: { content: [{type: "text", text: "..."}] }
        for (const block of json.content) {
          if (block.type === 'text' && block.text) {
            fullResponse += block.text;
            processInfo.output.push(block.text);
            event.sender.send('claude:response', { pid: internalPid, data: block.text });
          } else if (block.type === 'tool_use') {
            const toolInfo = `[Tool: ${block.name}]\n${JSON.stringify(block.input, null, 2)}`;
            fullResponse += toolInfo;
            processInfo.output.push(toolInfo);
            event.sender.send('claude:response', { pid: internalPid, data: toolInfo });
          }
        }
        log('✅ Extracted from json.content array');
      } else if (json.message?.content) {
        // Format: { message: { content: [...] } }
        for (const block of json.message.content) {
          if (block.type === 'text' && block.text) {
            fullResponse += block.text;
            processInfo.output.push(block.text);
            event.sender.send('claude:response', { pid: internalPid, data: block.text });
          }
        }
        log('✅ Extracted from json.message.content');
      } else if (json.error) {
        const errorMsg = json.error.message || JSON.stringify(json.error);
        processInfo.errors.push(errorMsg);
        event.sender.send('claude:error', { pid: internalPid, error: errorMsg });
        log('❌ Error in JSON:', json.error);
      } else {
        const formatted = JSON.stringify(json, null, 2);
        processInfo.output.push(formatted);
        event.sender.send('claude:response', { pid: internalPid, data: formatted });
        log('⚠️ Unknown format, sending raw JSON');
      }

      // Extract cost info
      if (json.total_cost_usd !== undefined) {
        const costMsg = `\n\n💰 Cost: $${json.total_cost_usd.toFixed(4)}`;
        processInfo.output.push(costMsg);
        event.sender.send('claude:response', { pid: internalPid, data: costMsg });
      } else if (json.cost_usd !== undefined) {
        const costMsg = `\n\n💰 Cost: $${json.cost_usd}`;
        processInfo.output.push(costMsg);
        event.sender.send('claude:response', { pid: internalPid, data: costMsg });
      }

      // Show permission denials
      if (json.permission_denials && json.permission_denials.length > 0) {
        const denials = json.permission_denials.map((d: any) =>
          `❌ Permission denied for ${d.tool_name}: ${JSON.stringify(d.tool_input, null, 2)}`
        ).join('\n\n');
        const denialsMsg = `\n\n⚠️ Permission Denials:\n${denials}`;
        processInfo.output.push(denialsMsg);
        event.sender.send('claude:response', { pid: internalPid, data: denialsMsg });
      }

      // Save session
      if (detectedSessionId) {
        const session: SessionInfo = {
          sessionId: detectedSessionId,
          projectPath: resolvedPath,
          query,
          timestamp: Date.now(),
          response: fullResponse,
        };
        sessions.set(detectedSessionId, session);
        log('💾 Session saved:', detectedSessionId);
        event.sender.send('claude:session-update', detectedSessionId);
      }

      // Mark process as completed
      processInfo.status = 'completed';
      event.sender.send('claude:complete', { pid: internalPid });
    };

    claudeProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      stdoutBuffer += chunk;
      lastDataTime = Date.now();
      log('📥 Raw stdout chunk received:', chunk.length, 'bytes');
      log('📄 Full chunk content:', chunk);
      log('📊 Current buffer size:', stdoutBuffer.length, 'bytes');
      log('📋 Buffer preview (first 500 chars):', stdoutBuffer.substring(0, 500));

      // Try to parse immediately if it looks complete
      const json = tryParseBuffer();
      if (json) {
        log('✅ Parsed complete JSON immediately');
        if (checkInterval) clearInterval(checkInterval);
        processJsonResponse(json);
      } else {
        log('⏳ Buffer not yet complete JSON, waiting for more data...');
      }
    });

    claudeProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      stderrBuffer += chunk;
      processInfo.errors.push(chunk);
      log('⚠️ stderr chunk:', chunk);

      // Check for common error patterns
      if (chunk.includes('authentication') || chunk.includes('login') || chunk.includes('API key')) {
        log('🔐 Authentication issue detected');
        event.sender.send('claude:error', { pid: internalPid, error: '🔐 Authentication Error: ' + chunk });
      } else if (chunk.includes('ENOENT') || chunk.includes('command not found')) {
        log('❌ Command not found');
        event.sender.send('claude:error', { pid: internalPid, error: '❌ Claude CLI not found: ' + chunk });
      } else if (chunk.includes('permission denied') || chunk.includes('EACCES')) {
        log('🚫 Permission denied');
        event.sender.send('claude:error', { pid: internalPid, error: '🚫 Permission Error: ' + chunk });
      } else {
        event.sender.send('claude:error', { pid: internalPid, error: chunk });
      }
    });

    claudeProcess.on('close', (code) => {
      log('✅ Process closed', { code, pid: internalPid });

      if (checkInterval) {
        clearInterval(checkInterval);
      }

      // Only process if not already processed
      if (stdoutBuffer.trim() && !detectedSessionId) {
        log('📊 Buffer size:', stdoutBuffer.length, 'bytes');
        const json = tryParseBuffer();
        if (json) {
          processJsonResponse(json);
        } else {
          log('⚠️ Failed to parse JSON on close');
          processInfo.output.push(stdoutBuffer);
          event.sender.send('claude:response', { pid: internalPid, data: stdoutBuffer });
          processInfo.status = code === 0 ? 'completed' : 'failed';
          event.sender.send('claude:complete', { pid: internalPid });
        }
      } else if (detectedSessionId) {
        log('ℹ️ Response already processed during data events');
      } else {
        log('⚠️ No stdout buffer received');
        processInfo.status = code === 0 ? 'completed' : 'failed';
        event.sender.send('claude:complete', { pid: internalPid });
      }

      if (stderrBuffer.trim()) {
        log('⚠️ stderr buffer:', stderrBuffer);
        if (!processInfo.errors.includes(stderrBuffer)) {
          processInfo.errors.push(stderrBuffer);
        }
        event.sender.send('claude:error', { pid: internalPid, error: stderrBuffer });
      }

      if (code !== 0) {
        log('❌ Process exited with non-zero code:', code);
        processInfo.status = 'failed';
        const errorMsg = `Process exited with code ${code}`;
        processInfo.errors.push(errorMsg);
        event.sender.send('claude:error', { pid: internalPid, error: errorMsg });
      }
    });

    claudeProcess.on('error', (error) => {
      log('❌ Process error:', error);
      processInfo.status = 'failed';
      const errorMsg = `Failed to start process: ${error.message}`;
      processInfo.errors.push(errorMsg);
      event.sender.send('claude:error', { pid: internalPid, error: errorMsg });
    });
  } catch (error) {
    log('❌ Execution error:', error);
    event.sender.send('claude:error', `Error: ${error.message}`);
  }
});

// IPC handler for getting session history
ipcMain.handle('claude:get-sessions', async () => {
  log('📤 IPC Request: claude:get-sessions');
  const sessionList = Array.from(sessions.values()).sort((a, b) => b.timestamp - a.timestamp);
  log('📋 Returning sessions:', sessionList.length);
  return sessionList;
});

// IPC handler for getting current session ID
ipcMain.handle('claude:get-current-session', async () => {
  log('📤 IPC Request: claude:get-current-session');
  return currentSessionId;
});

// IPC handler for continuing last session
ipcMain.handle('claude:continue', async (event, projectPath: string, query: string) => {
  log('📤 IPC Request: claude:continue', { currentSessionId });
  if (currentSessionId) {
    return ipcMain.emit('claude:execute', event, projectPath, query, currentSessionId);
  }
  throw new Error('No active session to continue');
});

// IPC handler for directory selection
ipcMain.handle('dialog:selectDirectory', async () => {
  log('📤 IPC Request: dialog:selectDirectory');

  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });

  if (result.canceled) {
    log('❌ Directory selection canceled');
    return null;
  }

  log('✅ Directory selected:', result.filePaths[0]);
  return result.filePaths[0];
});
