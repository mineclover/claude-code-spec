/**
 * MCP Configurations Page
 * Manage MCP configuration files for the selected project
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import type { McpConfigFile, McpDefaultConfigTarget, McpServer } from '../types/api/settings';
import styles from './McpConfigsPage.module.css';

type CreateMode = 'named' | 'default';

function relativeToProject(absPath: string, projectPath: string): string {
  const prefix = projectPath.endsWith('/') ? projectPath : `${projectPath}/`;
  return absPath.startsWith(prefix) ? absPath.slice(prefix.length) : absPath;
}

function buildUsageScripts(
  toolId: string,
  configRelPath: string,
  skipPerms: boolean,
): { interactive: string; singleQuery: string } {
  const permFlag = skipPerms ? ' --dangerously-skip-permissions' : '';
  const mcpFlags = `--mcp-config ${configRelPath} --strict-mcp-config`;
  return {
    interactive: `${toolId} ${mcpFlags}${permFlag}`,
    singleQuery: `${toolId} -p "your query here" ${mcpFlags}${permFlag}`,
  };
}

async function copyToClipboard(text: string): Promise<void> {
  await navigator.clipboard.writeText(text);
}

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
  const { projectPath, projectDirName } = useProject();
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
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = async (key: string, text: string) => {
    await copyToClipboard(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
  };

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
    if (!projectPath) {
      setLoading(false);
      return;
    }
    loadConfigs();
    loadAvailableServers();
  }, [projectPath, loadConfigs, loadAvailableServers]);

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
    const next = selectedServers.includes(name)
      ? selectedServers.filter((s) => s !== name)
      : [...selectedServers, name];
    setSelectedServers(next);
    if (selectedConfig && !isCreating) updateConfigContent(next);
  };

  const updateConfigContent = (serverNames: string[]) => {
    const configs: Record<string, unknown> = {};
    for (const s of availableServers.filter((sv) => serverNames.includes(sv.name))) {
      configs[s.name] = { type: s.type, command: s.command, args: s.args, env: s.env };
    }
    setEditingContent(JSON.stringify({ mcpServers: configs }, null, 2));
  };

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

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h2 className={styles.sidebarTitle}>MCP Configurations</h2>
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

              {/* Usage Scripts — shown immediately after selecting a config */}
              {(() => {
                const relPath = relativeToProject(selectedConfig.path, projectPath ?? '');
                const { interactive, singleQuery } = buildUsageScripts(
                  selectedToolId,
                  relPath,
                  skipPermissions,
                );
                return (
                  <div className={styles.usageSection}>
                    <div className={styles.usageSectionTitle}>Usage Scripts</div>

                    <label className={styles.usageToggle}>
                      <input
                        type="checkbox"
                        checked={skipPermissions}
                        onChange={() => setSkipPermissions((v) => !v)}
                      />
                      <span>Skip permissions (--dangerously-skip-permissions)</span>
                    </label>
                    {skipPermissions && (
                      <div className={styles.usageWarning}>
                        ⚠️ Use with caution: bypasses all security checks. Only use with trusted MCP
                        servers. Recommended: configure permissions in .claude/settings.json
                        instead.
                      </div>
                    )}

                    <div className={styles.usageMode}>
                      <div className={styles.usageModeHeader}>
                        <span>💬 Interactive Mode</span>
                        <button
                          type="button"
                          className={styles.copyButton}
                          onClick={() => handleCopy('interactive', interactive)}
                        >
                          {copiedKey === 'interactive' ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                      <code className={styles.usageCommand}>{interactive}</code>
                      <div className={styles.usageModeDesc}>
                        Starts an interactive session with the selected MCP servers
                      </div>
                    </div>

                    <div className={styles.usageMode}>
                      <div className={styles.usageModeHeader}>
                        <span>⚡ Single Query Mode</span>
                        <button
                          type="button"
                          className={styles.copyButton}
                          onClick={() => handleCopy('singleQuery', singleQuery)}
                        >
                          {copiedKey === 'singleQuery' ? '✓ Copied' : '📋 Copy'}
                        </button>
                      </div>
                      <code className={styles.usageCommand}>{singleQuery}</code>
                      <div className={styles.usageModeDesc}>Executes a single query and exits</div>
                    </div>
                  </div>
                );
              })()}

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

    </div>
  );
}
