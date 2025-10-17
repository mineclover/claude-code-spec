/**
 * MCP Configurations Page
 * Manage MCP configuration files for the selected project
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useProject } from '../contexts/ProjectContext';
import type { McpConfigFile, McpServer } from '../preload';
import styles from './McpConfigsPage.module.css';

export function McpConfigsPage() {
  const navigate = useNavigate();
  const { projectPath, projectDirName } = useProject();
  const [configs, setConfigs] = useState<McpConfigFile[]>([]);
  const [availableServers, setAvailableServers] = useState<McpServer[]>([]);
  const [sourcePaths, setSourcePaths] = useState<string[]>([]);
  const [selectedConfig, setSelectedConfig] = useState<McpConfigFile | null>(null);
  const [editingContent, setEditingContent] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);
  const [newConfigName, setNewConfigName] = useState('');
  const [selectedServers, setSelectedServers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [skipPermissions, setSkipPermissions] = useState(false);

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
    try {
      const result = await window.settingsAPI.getMcpServers();
      if (result.error) {
        toast.error(result.error);
      } else {
        setAvailableServers(result.servers);
        setSourcePaths(result.sourcePaths || []);
      }
    } catch (error) {
      console.error('Failed to load available servers:', error);
      toast.error('Failed to load available MCP servers');
    }
  }, []);

  // Load MCP configs and available servers
  useEffect(() => {
    if (!projectPath) {
      setLoading(false);
      return;
    }

    loadConfigs();
    loadAvailableServers();
  }, [projectPath, loadAvailableServers, loadConfigs]);

  const handleSelectConfig = (config: McpConfigFile) => {
    setSelectedConfig(config);
    setEditingContent(config.content);
    setIsCreating(false);

    // Parse current config to extract selected servers
    try {
      const parsed = JSON.parse(config.content);
      const serverNames = parsed.mcpServers ? Object.keys(parsed.mcpServers) : [];
      setSelectedServers(serverNames);
    } catch (error) {
      console.error('Failed to parse config:', error);
      setSelectedServers([]);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedConfig) return;

    try {
      // Validate JSON
      const validation = await window.settingsAPI.validateMcpJson(editingContent);
      if (!validation.valid) {
        toast.error(`Invalid JSON: ${validation.error}`);
        return;
      }

      // Write file
      const success = await window.settingsAPI.writeFile(selectedConfig.path, editingContent);
      if (success) {
        toast.success('Configuration saved successfully');
        loadConfigs();
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    }
  };

  const handleDeleteConfig = async (config: McpConfigFile) => {
    if (!confirm(`Are you sure you want to delete ${config.name}?`)) {
      return;
    }

    try {
      const success = await window.settingsAPI.deleteFile(config.path);
      if (success) {
        toast.success('Configuration deleted successfully');
        if (selectedConfig?.path === config.path) {
          setSelectedConfig(null);
          setEditingContent('');
        }
        loadConfigs();
      } else {
        toast.error('Failed to delete configuration');
      }
    } catch (error) {
      console.error('Failed to delete config:', error);
      toast.error('Failed to delete configuration');
    }
  };

  const handleCreateConfig = async () => {
    if (!projectPath) {
      toast.error('No project selected');
      return;
    }

    if (!newConfigName.trim()) {
      toast.error('Please enter a configuration name');
      return;
    }

    // Check for duplicate names
    const configFileName = newConfigName.startsWith('.mcp-')
      ? newConfigName
      : `.mcp-${newConfigName}.json`;

    const isDuplicate = configs.some((config) => config.name === configFileName);
    if (isDuplicate) {
      toast.error(`Configuration "${configFileName}" already exists`);
      return;
    }

    if (selectedServers.length === 0) {
      toast.error('Please select at least one MCP server');
      return;
    }

    try {
      const result = await window.settingsAPI.createMcpConfig(
        projectPath,
        newConfigName,
        selectedServers,
      );

      if (result.success) {
        toast.success('Configuration created successfully');
        setIsCreating(false);
        setNewConfigName('');
        setSelectedServers([]);
        loadConfigs();
      } else {
        toast.error(result.error || 'Failed to create configuration');
      }
    } catch (error) {
      console.error('Failed to create config:', error);
      toast.error('Failed to create configuration');
    }
  };

  const toggleServerSelection = (serverName: string) => {
    setSelectedServers((prev) => {
      const newSelection = prev.includes(serverName)
        ? prev.filter((s) => s !== serverName)
        : [...prev, serverName];

      // If editing an existing config, update the JSON content
      if (selectedConfig && !isCreating) {
        updateConfigContent(newSelection);
      }

      return newSelection;
    });
  };

  const updateConfigContent = (serverNames: string[]) => {
    try {
      // Build new config from selected servers
      const selectedServerConfigs = availableServers.filter((s) => serverNames.includes(s.name));

      const mcpConfig: {
        mcpServers: Record<string, { type: string; command: string; args: string[]; env: Record<string, string> }>;
      } = {
        mcpServers: {},
      };

      for (const server of selectedServerConfigs) {
        mcpConfig.mcpServers[server.name] = {
          type: server.type,
          command: server.command,
          args: server.args,
          env: server.env,
        };
      }

      setEditingContent(JSON.stringify(mcpConfig, null, 2));
    } catch (error) {
      console.error('Failed to update config content:', error);
      toast.error('Failed to update configuration');
    }
  };

  if (!projectPath) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyStateContent}>
          <div className={styles.emptyStateIcon}>🔌</div>
          <h2 className={styles.emptyStateTitle}>No Project Selected</h2>
          <p className={styles.emptyStateDescription}>
            Select a project to manage MCP configurations
          </p>
          <div className={styles.emptyStateActions}>
            <button
              type="button"
              onClick={() => navigate('/claude-projects')}
              className={styles.primaryButton}
            >
              📁 Browse Claude Projects
            </button>
            <button type="button" onClick={() => navigate('/')} className={styles.secondaryButton}>
              Go to Execute Page
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.spinner}></div>
        <div className={styles.loadingText}>Loading MCP configurations...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Left Panel: Config List */}
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>MCP Configurations</h2>
          <div className={styles.projectInfo}>
            <span className={styles.projectIcon}>📂</span>
            <span className={styles.projectName} title={projectPath}>
              {projectDirName || projectPath.split('/').filter(Boolean).pop()}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating(true)}
            className={styles.newConfigButton}
          >
            + New Configuration
          </button>
        </div>

        <div className={styles.configList}>
          {configs.length === 0 ? (
            <p className={styles.noConfigs}>No configurations found</p>
          ) : (
            configs.map((config) => (
              <div
                key={config.path}
                className={`${styles.configItem} ${
                  selectedConfig?.path === config.path ? styles.selected : ''
                }`}
              >
                <button
                  type="button"
                  className={styles.configItemButton}
                  onClick={() => handleSelectConfig(config)}
                  aria-label={`Select configuration ${config.name}`}
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

      {/* Right Panel: Editor or Create Form */}
      <div className={styles.mainContent}>
        <div className={styles.contentInner}>
          {isCreating ? (
            /* Create Form */
            <>
              <div className={styles.contentHeader}>
                <h2 className={styles.contentTitle}>Create New Configuration</h2>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.formLabel}>Configuration Name</div>
                <input
                  type="text"
                  value={newConfigName}
                  onChange={(e) => setNewConfigName(e.target.value)}
                  placeholder="e.g., dev, analysis, ui"
                  className={styles.formInput}
                />
                <p className={styles.formHint}>
                  File will be named: .mcp-{newConfigName || 'name'}.json
                </p>
              </div>

              <div className={styles.formGroup}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div className={styles.formLabel} style={{ margin: 0 }}>
                    Select MCP Servers ({selectedServers.length} selected)
                  </div>
                  <button
                    type="button"
                    onClick={loadAvailableServers}
                    className={styles.refreshServersButton}
                    title="Refresh server list from configured paths"
                  >
                    🔄 Refresh Servers
                  </button>
                </div>
                {sourcePaths.length > 0 && (
                  <div className={styles.sourcePathsInfo}>
                    <span className={styles.sourcePathsLabel}>Loading from:</span>
                    {sourcePaths.map((path) => (
                      <span key={path} className={styles.sourcePathItem}>
                        {path}
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.serverList}>
                  {availableServers.length === 0 ? (
                    <p className={styles.noServers}>
                      No MCP servers found. Configure resource paths in Settings.
                    </p>
                  ) : (
                    availableServers.map((server) => (
                      <div key={server.name} className={styles.serverItem}>
                        <div className={styles.serverItemLabel}>
                          <input
                            type="checkbox"
                            checked={selectedServers.includes(server.name)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleServerSelection(server.name);
                            }}
                          />
                          <button
                            type="button"
                            className={styles.serverItemContent}
                            onClick={() => toggleServerSelection(server.name)}
                          >
                            <div className={styles.serverName}>{server.name}</div>
                            <div className={styles.serverCommand}>
                              {server.command} {server.args.join(' ')}
                            </div>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  type="button"
                  onClick={handleCreateConfig}
                  disabled={
                    !newConfigName.trim() ||
                    selectedServers.length === 0 ||
                    configs.some((config) => {
                      const configFileName = newConfigName.startsWith('.mcp-')
                        ? newConfigName
                        : `.mcp-${newConfigName}.json`;
                      return config.name === configFileName;
                    })
                  }
                  className={styles.saveButton}
                >
                  {configs.some((config) => {
                    const configFileName = newConfigName.startsWith('.mcp-')
                      ? newConfigName
                      : `.mcp-${newConfigName}.json`;
                    return config.name === configFileName;
                  })
                    ? 'Name Already Exists'
                    : 'Create Configuration'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
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
            /* Editor */
            <>
              <div className={styles.contentHeader}>
                <h2 className={styles.contentTitle}>{selectedConfig.name}</h2>
                <p className={styles.contentPath}>Path: {selectedConfig.path}</p>
              </div>

              {/* Usage Scripts */}
              <div className={styles.usageSection}>
                <div className={styles.formLabel}>Usage Scripts</div>

                {/* Skip Permissions Checkbox */}
                <div className={styles.formGroup} style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={skipPermissions}
                      onChange={(e) => setSkipPermissions(e.target.checked)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>
                      Skip permissions (--dangerously-skip-permissions)
                    </span>
                  </label>
                  <p className={styles.formHint} style={{ marginTop: '4px', marginLeft: '28px' }}>
                    ⚠️ <strong>Use with caution:</strong> This bypasses all security checks. Only use with trusted MCP servers.
                    Recommended: Configure permissions in .claude/settings.json instead.
                  </p>
                </div>

                {/* Interactive Mode */}
                <div className={styles.scriptVariant}>
                  <div className={styles.scriptVariantHeader}>
                    <span className={styles.scriptVariantTitle}>💬 Interactive Mode</span>
                    <button
                      type="button"
                      onClick={() => {
                        const relativePath = `.claude/${selectedConfig.name}`;
                        const permissionsFlag = skipPermissions ? ' --dangerously-skip-permissions' : '';
                        const script = `claude --mcp-config ${relativePath} --strict-mcp-config${permissionsFlag}`;
                        navigator.clipboard.writeText(script);
                        toast.success('Interactive script copied!');
                      }}
                      className={styles.copyScriptButton}
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className={styles.scriptBox}>
                    <code className={styles.scriptCode}>
                      claude --mcp-config .claude/{selectedConfig.name} --strict-mcp-config
                      {skipPermissions && ' --dangerously-skip-permissions'}
                    </code>
                  </div>
                  <div className={styles.scriptHint}>
                    Starts an interactive session with the selected MCP servers
                  </div>
                </div>

                {/* Single Query Mode */}
                <div className={styles.scriptVariant}>
                  <div className={styles.scriptVariantHeader}>
                    <span className={styles.scriptVariantTitle}>⚡ Single Query Mode</span>
                    <button
                      type="button"
                      onClick={() => {
                        const relativePath = `.claude/${selectedConfig.name}`;
                        const permissionsFlag = skipPermissions ? ' --dangerously-skip-permissions' : '';
                        const script = `claude -p "your query here" --mcp-config ${relativePath} --strict-mcp-config${permissionsFlag}`;
                        navigator.clipboard.writeText(script);
                        toast.success('Single query script copied!');
                      }}
                      className={styles.copyScriptButton}
                    >
                      📋 Copy
                    </button>
                  </div>
                  <div className={styles.scriptBox}>
                    <code className={styles.scriptCode}>
                      claude -p "your query here" --mcp-config .claude/{selectedConfig.name}{' '}
                      --strict-mcp-config{skipPermissions && ' --dangerously-skip-permissions'}
                    </code>
                  </div>
                  <div className={styles.scriptHint}>Executes a single query and exits</div>
                </div>
              </div>

              {/* Server Selection for Editing */}
              <div className={styles.formGroup}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '12px',
                  }}
                >
                  <div className={styles.formLabel} style={{ margin: 0 }}>
                    Select MCP Servers ({selectedServers.length} selected)
                  </div>
                  <button
                    type="button"
                    onClick={loadAvailableServers}
                    className={styles.refreshServersButton}
                    title="Refresh server list from configured paths"
                  >
                    🔄 Refresh Servers
                  </button>
                </div>
                {sourcePaths.length > 0 && (
                  <div className={styles.sourcePathsInfo}>
                    <span className={styles.sourcePathsLabel}>Loading from:</span>
                    {sourcePaths.map((path) => (
                      <span key={path} className={styles.sourcePathItem}>
                        {path}
                      </span>
                    ))}
                  </div>
                )}
                <div className={styles.serverList}>
                  {availableServers.length === 0 ? (
                    <p className={styles.noServers}>
                      No MCP servers found. Configure resource paths in Settings.
                    </p>
                  ) : (
                    availableServers.map((server) => (
                      <div key={server.name} className={styles.serverItem}>
                        <div className={styles.serverItemLabel}>
                          <input
                            type="checkbox"
                            checked={selectedServers.includes(server.name)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleServerSelection(server.name);
                            }}
                          />
                          <button
                            type="button"
                            className={styles.serverItemContent}
                            onClick={() => toggleServerSelection(server.name)}
                          >
                            <div className={styles.serverName}>{server.name}</div>
                            <div className={styles.serverCommand}>
                              {server.command} {server.args.join(' ')}
                            </div>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className={styles.formGroup}>
                <div className={styles.formLabel}>Configuration Content (JSON)</div>
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className={styles.formTextarea}
                  spellCheck={false}
                />
                <p className={styles.formHint}>
                  💡 Tip: Use the checkboxes above to add/remove servers, or edit JSON directly.
                </p>
              </div>

              <div className={styles.buttonGroup}>
                <button type="button" onClick={handleSaveConfig} className={styles.saveButton}>
                  Save Changes
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
            /* No Selection */
            <div className={styles.emptyContent}>
              <p>Select a configuration to edit or create a new one</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
