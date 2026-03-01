/**
 * MCP Configurations Page
 * Manage MCP configuration files for the selected project
 * Includes quick project selector from active session folders
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ProgressBar } from '../components/common/ProgressBar';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import type { ProjectFolder, SessionLoadProgress } from '../types/api/sessions';
import type { McpConfigFile, McpDefaultConfigTarget, McpServer } from '../types/api/settings';
import styles from './McpConfigsPage.module.css';

type CreateMode = 'named' | 'default';

function defaultTargetFromToolId(toolId: string): McpDefaultConfigTarget {
  if (toolId === 'codex') return 'codex';
  if (toolId === 'gemini') return 'gemini';
  return 'claude';
}

function defaultPathFromTarget(target: McpDefaultConfigTarget): string {
  if (target === 'codex') return '.codex/.mcp.json';
  if (target === 'gemini') return '.gemini/.mcp.json';
  if (target === 'project') return '.mcp.json';
  return '.claude/.mcp.json';
}

export function McpConfigsPage() {
  const { projectPath, projectDirName, updateProject } = useProject();
  const { selectedToolId } = useToolContext();
  const [configs, setConfigs] = useState<McpConfigFile[]>([]);
  const [availableServers, setAvailableServers] = useState<McpServer[]>([]);
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<McpConfigFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [createMode, setCreateMode] = useState<CreateMode>('named');
  const [newConfigName, setNewConfigName] = useState('');
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Project picker state
  const [sessionProjects, setSessionProjects] = useState<ProjectFolder[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  // Subscribe to load progress events
  useEffect(() => {
    const cleanup = window.sessionsAPI.onLoadProgress((progress: SessionLoadProgress) => {
      if (progress.phase === 'done') {
        setProgressMessage(undefined);
      } else {
        setProgressMessage(progress.message);
      }
    });
    return cleanup;
  }, []);

  // Load session projects for the quick picker (lightweight folder listing)
  const loadSessionProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const folders = await window.sessionsAPI.listProjectFolders(selectedToolId);
      setSessionProjects(folders);
    } catch (error) {
      console.error('Failed to load session projects:', error);
    } finally {
      setProjectsLoading(false);
    }
  }, [selectedToolId]);

  const loadConfigs = useCallback(async () => {
    if (!projectPath) return;
    try {
      setLoading(true);
      const result = await window.settingsAPI.listMcpConfigs(projectPath);
      setConfigs(result);
    } catch (error) {
      console.error('Failed to load MCP configs:', error);
      toast.error('Failed to load MCP configurations');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  const loadAvailableServers = useCallback(async () => {
    if (!projectPath) {
      setAvailableServers([]);
      setSourcePaths([]);
      return;
    }
    try {
      const result = await window.settingsAPI.getMcpServers(projectPath);
      setAvailableServers(result.servers);
      setSourcePaths(result.sourcePaths || []);
      if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Failed to load available servers:', error);
    }
  }, [projectPath]);

  useEffect(() => {
    loadSessionProjects();
  }, [loadSessionProjects]);

  useEffect(() => {
    if (!projectPath) {
      setLoading(false);
      return;
    }
    loadConfigs();
    loadAvailableServers();
  }, [projectPath, loadConfigs, loadAvailableServers]);

  const handleSelectProject = async (project: ProjectFolder) => {
    await updateProject(project.projectPath, project.projectDirName);
    setShowProjectPicker(false);
    setSelectedConfig(null);
    setEditingContent('');
  };

  const handleSelectConfig = (config: McpConfigFile) => {
    setSelectedConfig(config);
    setEditingContent(config.content);
    setIsCreating(false);
    try {
      const parsed = JSON.parse(config.content);
      setSelectedServers(parsed.mcpServers ? Object.keys(parsed.mcpServers) : []);
    } catch {
      setSelectedServers([]);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;
    try {
      const validation = await window.settingsAPI.validateMcpJson(editingContent);
      if (!validation.valid) {
        toast.error(`Invalid JSON: ${validation.error}`);
        return;
      }
      const success = await window.settingsAPI.writeFile(selectedConfig.path, editingContent);
      if (success) {
        toast.success('Saved');
        loadConfigs();
      } else {
        toast.error('Failed to save');
      }
    } catch {
      toast.error('Failed to save');
    }
  };

  const handleDeleteConfig = async (config: McpConfigFile) => {
    if (!confirm(`Delete ${config.name}?`)) return;
    try {
      const success = await window.settingsAPI.deleteFile(config.path);
      if (success) {
        toast.success('Deleted');
        if (selectedConfig?.path === config.path) {
          setSelectedConfig(null);
          setEditingContent('');
        }
        loadConfigs();
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleCreateConfig = async () => {
    if (!projectPath || selectedServers.length === 0) return;
    if (createMode === 'named' && !newConfigName.trim()) return;

    const defaultTarget = defaultTargetFromToolId(selectedToolId);

    try {
      const result =
        createMode === 'named'
          ? await window.settingsAPI.createMcpConfig(projectPath, newConfigName, selectedServers)
          : await window.settingsAPI.createMcpDefaultConfig(
              projectPath,
              defaultTarget,
              selectedServers,
            );

      if (result.success) {
        toast.success('Created');
        setIsCreating(false);
        setCreateMode('named');
        setNewConfigName('');
        setSelectedServers([]);
        loadConfigs();
      } else {
        toast.error(result.error || 'Failed');
      }
    } catch {
      toast.error('Failed to create');
    }
  };

  const toggleServer = (name: string) => {
    setSelectedServers((prev) => {
      const next = prev.includes(name) ? prev.filter((s) => s !== name) : [...prev, name];
      if (selectedConfig && !isCreating) updateConfigContent(next);
      return next;
    });
  };

  const updateConfigContent = (serverNames: string[]) => {
    const configs: Record<string, unknown> = {};
    for (const s of availableServers.filter((sv) => serverNames.includes(sv.name))) {
      configs[s.name] = { type: s.type, command: s.command, args: s.args, env: s.env };
    }
    setEditingContent(JSON.stringify({ mcpServers: configs }, null, 2));
  };

  const displayName = (p: ProjectFolder) =>
    p.projectPath === '/'
      ? 'root'
      : p.projectPath.split('/').filter(Boolean).pop() || p.projectDirName;

  const renderSourcePaths = () => {
    if (sourcePaths.length === 0) {
      return <p className={styles.formHint}>No MCP source files found for this project.</p>;
    }

    return (
      <div className={styles.sourcePaths}>
        <div className={styles.sourcePathsTitle}>Loaded from</div>
        {sourcePaths.map((targetPath) => (
          <div key={targetPath} className={styles.sourcePathItem}>
            {targetPath}
          </div>
        ))}
      </div>
    );
  };

  const defaultTarget = defaultTargetFromToolId(selectedToolId);
  const defaultPathHint = defaultPathFromTarget(defaultTarget);
  const isCreateDisabled =
    selectedServers.length === 0 || (createMode === 'named' && !newConfigName.trim());

  // -- Project Picker overlay --
  const renderProjectPicker = () => (
    <div className={styles.pickerOverlay} onClick={() => setShowProjectPicker(false)}>
      <div className={styles.pickerPanel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <h3>Select Project</h3>
          <button
            type="button"
            className={styles.pickerClose}
            onClick={() => setShowProjectPicker(false)}
          >
            Close
          </button>
        </div>
        {projectsLoading ? (
          <div className={styles.pickerLoading}>
            <ProgressBar visible={true} message={progressMessage} />
          </div>
        ) : sessionProjects.length === 0 ? (
          <div className={styles.pickerEmpty}>No session projects found</div>
        ) : (
          <div className={styles.pickerList}>
            {sessionProjects.map((p) => (
              <button
                key={p.projectPath}
                type="button"
                className={`${styles.pickerItem} ${projectPath === p.projectPath ? styles.pickerItemActive : ''}`}
                onClick={() => handleSelectProject(p)}
              >
                <div className={styles.pickerItemName}>{displayName(p)}</div>
                <div className={styles.pickerItemPath}>{p.projectPath}</div>
                {p.sessionCount != null && (
                  <div className={styles.pickerItemMeta}>{p.sessionCount} sessions</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>MCP Configurations</h2>
          {/* Quick project selector */}
          <button
            type="button"
            className={styles.projectSelector}
            onClick={() => setShowProjectPicker(true)}
          >
            <span className={styles.projectSelectorLabel}>Project</span>
            <span className={styles.projectSelectorValue}>
              {projectPath
                ? projectDirName || projectPath.split('/').filter(Boolean).pop()
                : 'Select project...'}
            </span>
          </button>
          {projectPath && (
            <button
              type="button"
              onClick={() => {
                setIsCreating(true);
                setCreateMode('named');
              }}
              className={styles.newConfigButton}
            >
              + New Configuration
            </button>
          )}
        </div>
        <div className={styles.configList}>
          {!projectPath ? (
            <p className={styles.noConfigs}>Select a project to view configs</p>
          ) : loading ? (
            <p className={styles.noConfigs}>Loading...</p>
          ) : configs.length === 0 ? (
            <p className={styles.noConfigs}>No configurations found</p>
          ) : (
            configs.map((config) => (
              <div
                key={config.path}
                className={`${styles.configItem} ${selectedConfig?.path === config.path ? styles.selected : ''}`}
              >
                <button
                  type="button"
                  className={styles.configItemButton}
                  onClick={() => handleSelectConfig(config)}
                >
                  <div className={styles.configName}>{config.name}</div>
                  <div className={styles.configMeta}>
                    {new Date(config.lastModified).toLocaleString()}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConfig(config);
                  }}
                  className={styles.deleteButton}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className={styles.mainContent}>
        <div className={styles.contentInner}>
          {isCreating ? (
            <>
              <div className={styles.contentHeader}>
                <h2 className={styles.contentTitle}>Create New Configuration</h2>
              </div>
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>Create Mode</div>
                <div className={styles.modeTabs}>
                  <button
                    type="button"
                    className={`${styles.modeTab} ${createMode === 'named' ? styles.modeTabActive : ''}`}
                    onClick={() => setCreateMode('named')}
                  >
                    Named Profile
                  </button>
                  <button
                    type="button"
                    className={`${styles.modeTab} ${createMode === 'default' ? styles.modeTabActive : ''}`}
                    onClick={() => setCreateMode('default')}
                  >
                    Package Default
                  </button>
                </div>
              </div>
              <div className={styles.formGroup}>
                {createMode === 'named' ? (
                  <>
                    <div className={styles.formLabel}>Name</div>
                    <input
                      type="text"
                      value={newConfigName}
                      onChange={(e) => setNewConfigName(e.target.value)}
                      placeholder="e.g., dev, analysis"
                      className={styles.formInput}
                    />
                    <p className={styles.formHint}>File: .mcp-{newConfigName || 'name'}.json</p>
                  </>
                ) : (
                  <>
                    <div className={styles.formLabel}>Default Target (Auto)</div>
                    <p className={styles.formHint}>
                      Current CLI: <strong>{selectedToolId}</strong>
                    </p>
                    <p className={styles.formHint}>File: {defaultPathHint}</p>
                  </>
                )}
              </div>
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>MCP Servers ({selectedServers.length})</div>
                {renderSourcePaths()}
                <div className={styles.serverList}>
                  {availableServers.map((server) => (
                    <div key={server.name} className={styles.serverItem}>
                      <div className={styles.serverItemLabel}>
                        <input
                          type="checkbox"
                          checked={selectedServers.includes(server.name)}
                          onChange={() => toggleServer(server.name)}
                        />
                        <button
                          type="button"
                          className={styles.serverItemContent}
                          onClick={() => toggleServer(server.name)}
                        >
                          <div className={styles.serverName}>{server.name}</div>
                          <div className={styles.serverCommand}>
                            {server.command} {server.args.join(' ')}
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handleCreateConfig}
                  disabled={isCreateDisabled}
                  className={styles.saveButton}
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setCreateMode('named');
                    setNewConfigName('');
                    setSelectedServers([]);
                  }}
                  className={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </>
          ) : selectedConfig ? (
            <>
              <div className={styles.contentHeader}>
                <h2 className={styles.contentTitle}>{selectedConfig.name}</h2>
                <p className={styles.contentPath}>{selectedConfig.path}</p>
              </div>
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>MCP Servers ({selectedServers.length})</div>
                {renderSourcePaths()}
                <div className={styles.serverList}>
                  {availableServers.map((server) => (
                    <div key={server.name} className={styles.serverItem}>
                      <div className={styles.serverItemLabel}>
                        <input
                          type="checkbox"
                          checked={selectedServers.includes(server.name)}
                          onChange={() => toggleServer(server.name)}
                        />
                        <button
                          type="button"
                          className={styles.serverItemContent}
                          onClick={() => toggleServer(server.name)}
                        >
                          <div className={styles.serverName}>{server.name}</div>
                          <div className={styles.serverCommand}>
                            {server.command} {server.args.join(' ')}
                          </div>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={styles.formGroup}>
                <div className={styles.formLabel}>JSON</div>
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className={styles.formTextarea}
                  spellCheck={false}
                />
              </div>
              <div className={styles.buttonGroup}>
                <button type="button" onClick={handleSaveConfig} className={styles.saveButton}>
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingContent(selectedConfig.content)}
                  className={styles.cancelButton}
                >
                  Reset
                </button>
              </div>
            </>
          ) : (
            <div className={styles.emptyContent}>
              <p>Select a configuration or create a new one</p>
            </div>
          )}
        </div>
      </div>

      {showProjectPicker && renderProjectPicker()}
    </div>
  );
}
