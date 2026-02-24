/**
 * Settings Page
 * App-level settings only
 */

import { useCallback, useEffect, useId, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { ClaudeProjectInfo } from '../types/api/sessions';
import type { McpServer } from '../types/api/settings';
import styles from './SettingsPage.module.css';

type Message = { type: 'success' | 'error'; text: string } | null;

export function SettingsPage() {
  const claudeProjectsPathId = useId();
  const newMcpPathId = useId();
  const { updateProject, projectPath, projectDirName } = useProject();

  const [claudeProjectsPath, setClaudeProjectsPath] = useState('');
  const [isPathLoading, setIsPathLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<Message>(null);
  const [mcpResourcePaths, setMcpResourcePaths] = useState<string[]>([]);
  const [newMcpPath, setNewMcpPath] = useState('');
  const [defaultProjectsPath, setDefaultProjectsPath] = useState('');
  const [mcpPathsMessage, setMcpPathsMessage] = useState<Message>(null);
  const [settingsFilePath, setSettingsFilePath] = useState('');

  const [recentProjects, setRecentProjects] = useState<ClaudeProjectInfo[]>([]);
  const [mcpPreviewServers, setMcpPreviewServers] = useState<McpServer[]>([]);
  const [mcpPreviewSources, setMcpPreviewSources] = useState<string[]>([]);
  const [mcpPreviewError, setMcpPreviewError] = useState<string | null>(null);
  const [isMcpPreviewLoading, setIsMcpPreviewLoading] = useState(false);

  const loadAppSettings = useCallback(async () => {
    setIsPathLoading(true);
    try {
      const path = await window.settingsAPI.getClaudeProjectsPath();
      setClaudeProjectsPath(path || '');
      const paths = await window.settingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(paths);
      const defaultPaths = await window.settingsAPI.getDefaultPaths();
      setDefaultProjectsPath(defaultPaths.claudeProjectsPath);
      const sp = await window.settingsAPI.getSettingsPath();
      setSettingsFilePath(sp);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsPathLoading(false);
    }
  }, []);

  const loadRecentProjects = useCallback(async () => {
    try {
      const result = await window.sessionsAPI.getAllProjectsPaginated(0, 5);
      setRecentProjects(result.projects);
    } catch {
      // ignore
    }
  }, []);

  const loadMcpPreview = useCallback(async () => {
    setIsMcpPreviewLoading(true);
    try {
      const result = await window.settingsAPI.getMcpServers(projectPath ?? undefined);
      setMcpPreviewServers(result.servers);
      setMcpPreviewSources(result.sourcePaths || []);
      setMcpPreviewError(result.error || null);
    } catch {
      setMcpPreviewError('Failed to load MCP preview');
      setMcpPreviewServers([]);
      setMcpPreviewSources([]);
    } finally {
      setIsMcpPreviewLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadAppSettings();
    loadRecentProjects();
  }, [loadAppSettings, loadRecentProjects]);

  useEffect(() => {
    loadMcpPreview();
  }, [loadMcpPreview]);

  const handleSave = async () => {
    if (!claudeProjectsPath) {
      setSaveMessage({ type: 'error', text: 'Please enter a path' });
      return;
    }
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await window.settingsAPI.setClaudeProjectsPath(claudeProjectsPath);
      setSaveMessage({ type: 'success', text: 'Saved!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed to save' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectDirectory = async () => {
    const selectedPath = await window.dialogAPI.selectDirectory();
    if (selectedPath) setClaudeProjectsPath(selectedPath);
  };

  const handleSetDefaultPath = async () => {
    try {
      const defaultPaths = await window.settingsAPI.getDefaultPaths();
      setClaudeProjectsPath(defaultPaths.claudeProjectsPath);
    } catch {
      setSaveMessage({ type: 'error', text: 'Failed' });
    }
  };

  const handleAddMcpPath = async () => {
    if (!newMcpPath.trim()) return;
    try {
      await window.settingsAPI.addMcpResourcePath(newMcpPath.trim());
      const updated = await window.settingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updated);
      await loadMcpPreview();
      setNewMcpPath('');
      setMcpPathsMessage({ type: 'success', text: 'Added!' });
      setTimeout(() => setMcpPathsMessage(null), 3000);
    } catch {
      setMcpPathsMessage({ type: 'error', text: 'Failed' });
    }
  };

  const handleRemoveMcpPath = async (targetPath: string) => {
    try {
      await window.settingsAPI.removeMcpResourcePath(targetPath);
      const updated = await window.settingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updated);
      await loadMcpPreview();
    } catch {
      setMcpPathsMessage({ type: 'error', text: 'Failed' });
    }
  };

  const handleSetDefaultMcpPaths = async () => {
    try {
      const defaults = await window.settingsAPI.getDefaultMcpResourcePaths();
      for (const p of defaults) await window.settingsAPI.addMcpResourcePath(p);
      const updated = await window.settingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updated);
      await loadMcpPreview();
      setMcpPathsMessage({ type: 'success', text: 'Default path added' });
      setTimeout(() => setMcpPathsMessage(null), 3000);
    } catch {
      setMcpPathsMessage({ type: 'error', text: 'Failed' });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Application Settings</h2>
      </div>

      {settingsFilePath && (
        <div className={styles.settingsInfo}>
          <div className={styles.infoLabel}>Settings File:</div>
          <div className={styles.infoValue}>{settingsFilePath}</div>
        </div>
      )}

      <div className={styles.settingsSection}>
        {recentProjects.length > 0 && (
          <div className={styles.settingItem}>
            <div className={styles.settingLabel}>Quick Project Select</div>
            <div className={styles.settingDescription}>Select a project to work with</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
              {recentProjects.map((p) => (
                <button
                  key={p.projectDirName}
                  type="button"
                  onClick={() => updateProject(p.projectPath, p.projectDirName)}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #2a2a4a',
                    borderRadius: '4px',
                    background: 'transparent',
                    color: '#c0c0d0',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                  }}
                >
                  {p.projectPath.split('/').filter(Boolean).pop()} ({p.sessions.length} sessions)
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={styles.settingItem}>
          <label htmlFor={claudeProjectsPathId} className={styles.settingLabel}>
            Claude Projects Path
          </label>
          <div className={styles.settingDescription}>
            Directory where Claude CLI stores session data (typically ~/.claude/projects)
          </div>
          <div className={styles.pathInput}>
            <input
              id={claudeProjectsPathId}
              type="text"
              value={claudeProjectsPath}
              onChange={(e) => setClaudeProjectsPath(e.target.value)}
              placeholder={defaultProjectsPath}
              className={styles.input}
              disabled={isPathLoading}
            />
            <button
              type="button"
              onClick={handleSetDefaultPath}
              className={styles.browseButton}
              disabled={isPathLoading}
            >
              Default
            </button>
            <button
              type="button"
              onClick={handleSelectDirectory}
              className={styles.browseButton}
              disabled={isPathLoading}
            >
              Browse
            </button>
          </div>
          <button
            type="button"
            onClick={handleSave}
            className={styles.saveButton}
            disabled={isSaving || isPathLoading}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          {saveMessage && (
            <div
              className={
                saveMessage.type === 'success' ? styles.successMessage : styles.errorMessage
              }
            >
              {saveMessage.text}
            </div>
          )}
        </div>

        <div className={styles.settingItem}>
          <label htmlFor={newMcpPathId} className={styles.settingLabel}>
            MCP Configuration Resource Paths
          </label>
          <div className={styles.settingDescription}>Files containing mcpServers definitions</div>
          <div className={styles.resourcePathsList}>
            {mcpResourcePaths.length > 0 ? (
              mcpResourcePaths.map((targetPath) => (
                <div key={targetPath} className={styles.resourcePathItem}>
                  <span className={styles.resourcePathText}>{targetPath}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveMcpPath(targetPath)}
                    className={styles.removePathButton}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.emptyPaths}>
                No paths configured. Click "Set Default" to add ~/.claude.json.
              </div>
            )}
          </div>
          <div className={styles.pathInput}>
            <input
              id={newMcpPathId}
              type="text"
              value={newMcpPath}
              onChange={(e) => setNewMcpPath(e.target.value)}
              placeholder="/path/to/config.json"
              className={styles.input}
              disabled={isPathLoading}
            />
            <button
              type="button"
              onClick={handleSetDefaultMcpPaths}
              className={styles.browseButton}
              disabled={isPathLoading}
            >
              Set Default
            </button>
          </div>
          <button
            type="button"
            onClick={handleAddMcpPath}
            className={styles.addPathButton}
            disabled={!newMcpPath.trim() || isPathLoading}
          >
            + Add Path
          </button>
          {mcpPathsMessage && (
            <div
              className={
                mcpPathsMessage.type === 'success' ? styles.successMessage : styles.errorMessage
              }
            >
              {mcpPathsMessage.text}
            </div>
          )}

          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>Effective MCP Preview</div>
              <button
                type="button"
                onClick={loadMcpPreview}
                className={styles.browseButton}
                disabled={isMcpPreviewLoading}
              >
                {isMcpPreviewLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
            <div className={styles.previewDescription}>
              {projectPath
                ? `Current project: ${projectDirName || projectPath}`
                : 'No project selected (showing global and configured resource paths only).'}
            </div>
            {mcpPreviewError && <div className={styles.errorMessage}>{mcpPreviewError}</div>}
            <div className={styles.previewSection}>
              <div className={styles.previewSectionTitle}>
                Loaded Source Files ({mcpPreviewSources.length})
              </div>
              {mcpPreviewSources.length > 0 ? (
                <div className={styles.previewList}>
                  {mcpPreviewSources.map((source) => (
                    <div key={source} className={styles.previewPath}>
                      {source}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyPaths}>No MCP source files detected.</div>
              )}
            </div>
            <div className={styles.previewSection}>
              <div className={styles.previewSectionTitle}>
                Available MCP Servers ({mcpPreviewServers.length})
              </div>
              {mcpPreviewServers.length > 0 ? (
                <div className={styles.previewList}>
                  {mcpPreviewServers.map((server) => (
                    <div key={server.name} className={styles.previewServerItem}>
                      <div className={styles.previewServerName}>{server.name}</div>
                      <div className={styles.previewServerCommand}>
                        {server.command} {server.args.join(' ')}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyPaths}>No MCP servers available.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
