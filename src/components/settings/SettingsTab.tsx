import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { ProjectSettings } from '../../preload';
import styles from './SettingsTab.module.css';

interface SettingsTabProps {
  projectPath?: string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ projectPath }) => {
  const [claudeProjectsPath, setClaudeProjectsPath] = useState('');
  const [isPathLoading, setIsPathLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // MCP Resource Paths state
  const [mcpResourcePaths, setMcpResourcePaths] = useState<string[]>([]);
  const [newMcpPath, setNewMcpPath] = useState('');
  const [defaultProjectsPath, setDefaultProjectsPath] = useState('');
  const [mcpPathsMessage, setMcpPathsMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Document Paths state
  const [claudeDocsPath, setClaudeDocsPath] = useState('');
  const [controllerDocsPath, setControllerDocsPath] = useState('');
  const [metadataPath, setMetadataPath] = useState('');
  const [docsPathsMessage, setDocsPathsMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Settings file location
  const [settingsFilePath, setSettingsFilePath] = useState<string>('');

  // Legacy project settings states (only used if projectPath is provided)
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<'claudeMd' | 'mcpJson' | null>(null);

  const loadAppSettings = useCallback(async () => {
    setIsPathLoading(true);
    try {
      const path = await window.appSettingsAPI.getClaudeProjectsPath();
      setClaudeProjectsPath(path || '');

      // Load MCP resource paths
      const paths = await window.appSettingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(paths);

      // Get default paths from backend (OS-specific)
      const defaultPaths = await window.appSettingsAPI.getDefaultPaths();
      setDefaultProjectsPath(defaultPaths.claudeProjectsPath);

      // Load document paths
      const claudeDocs = await window.appSettingsAPI.getClaudeDocsPath();
      const controllerDocs = await window.appSettingsAPI.getControllerDocsPath();
      const metadata = await window.appSettingsAPI.getMetadataPath();
      setClaudeDocsPath(claudeDocs || '');
      setControllerDocsPath(controllerDocs || '');
      setMetadataPath(metadata || '');

      // Load settings file path
      const settingsPath = await window.appSettingsAPI.getSettingsPath();
      setSettingsFilePath(settingsPath);
    } catch (error) {
      console.error('Failed to load app settings:', error);
    } finally {
      setIsPathLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const projectSettings = await window.settingsAPI.findFiles(projectPath);
      setSettings(projectSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadAppSettings();
    if (projectPath) {
      loadSettings();
    }
  }, [projectPath, loadAppSettings, loadSettings]);

  const handleSelectDirectory = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      setClaudeProjectsPath(path);
    }
  };

  const handleSave = async () => {
    if (!claudeProjectsPath) {
      setSaveMessage({ type: 'error', text: 'Please enter a path' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      await window.appSettingsAPI.setClaudeProjectsPath(claudeProjectsPath);
      setSaveMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setSaveMessage({ type: 'error', text: 'Failed to save settings' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    if (!projectPath) return;
    try {
      const backup = await window.settingsAPI.createBackup(projectPath);
      const timestamp = new Date(backup.timestamp).toISOString().replace(/[:.]/g, '-');
      const filename = `settings-backup-${timestamp}.json`;

      // In real app, use dialog to select save location
      console.log('Backup created:', backup);
      alert(`Backup created: ${filename}\n\nUse export functionality to save to file.`);
    } catch (error) {
      console.error('Backup failed:', error);
      alert('Failed to create backup');
    }
  };

  // MCP Resource Paths handlers
  const handleAddMcpPath = async () => {
    if (!newMcpPath.trim()) {
      setMcpPathsMessage({ type: 'error', text: 'Please enter a valid path' });
      return;
    }

    try {
      await window.appSettingsAPI.addMcpResourcePath(newMcpPath.trim());
      const updatedPaths = await window.appSettingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updatedPaths);
      setNewMcpPath('');
      setMcpPathsMessage({ type: 'success', text: 'Path added successfully!' });
      setTimeout(() => setMcpPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to add MCP path:', error);
      setMcpPathsMessage({ type: 'error', text: 'Failed to add path' });
    }
  };

  const handleRemoveMcpPath = async (path: string) => {
    try {
      await window.appSettingsAPI.removeMcpResourcePath(path);
      const updatedPaths = await window.appSettingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updatedPaths);
      setMcpPathsMessage({ type: 'success', text: 'Path removed successfully!' });
      setTimeout(() => setMcpPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to remove MCP path:', error);
      setMcpPathsMessage({ type: 'error', text: 'Failed to remove path' });
    }
  };

  const handleSelectMcpFile = async () => {
    const path = await window.claudeAPI.selectDirectory();
    if (path) {
      setNewMcpPath(path);
    }
  };

  const handleSetDefaultProjectsPath = async () => {
    try {
      const defaultPaths = await window.appSettingsAPI.getDefaultPaths();
      setClaudeProjectsPath(defaultPaths.claudeProjectsPath);
    } catch (error) {
      console.error('Failed to get default path:', error);
      setSaveMessage({ type: 'error', text: 'Failed to get default path' });
    }
  };

  const handleSetDefaultMcpPaths = async () => {
    try {
      const defaultPaths = await window.appSettingsAPI.getDefaultMcpResourcePaths();
      const beforeCount = mcpResourcePaths.length;

      // Add the default path (will skip if already exists due to backend logic)
      for (const path of defaultPaths) {
        await window.appSettingsAPI.addMcpResourcePath(path);
      }

      // Reload paths
      const updatedPaths = await window.appSettingsAPI.getMcpResourcePaths();
      setMcpResourcePaths(updatedPaths);

      // Check if path was actually added
      if (updatedPaths.length > beforeCount) {
        setMcpPathsMessage({
          type: 'success',
          text: 'Default path added successfully',
        });
      } else {
        setMcpPathsMessage({
          type: 'success',
          text: 'Default path already configured',
        });
      }
      setTimeout(() => setMcpPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to set default MCP path:', error);
      setMcpPathsMessage({ type: 'error', text: 'Failed to set default path' });
    }
  };

  // Document Paths handlers
  const handleSaveClaudeDocsPath = async () => {
    if (!claudeDocsPath.trim()) {
      setDocsPathsMessage({ type: 'error', text: 'Please enter a valid path' });
      return;
    }

    try {
      await window.appSettingsAPI.setClaudeDocsPath(claudeDocsPath);
      setDocsPathsMessage({ type: 'success', text: 'Claude Docs path saved!' });
      setTimeout(() => setDocsPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save Claude Docs path:', error);
      setDocsPathsMessage({ type: 'error', text: 'Failed to save path' });
    }
  };

  const handleSaveControllerDocsPath = async () => {
    if (!controllerDocsPath.trim()) {
      setDocsPathsMessage({ type: 'error', text: 'Please enter a valid path' });
      return;
    }

    try {
      await window.appSettingsAPI.setControllerDocsPath(controllerDocsPath);
      setDocsPathsMessage({ type: 'success', text: 'Controller Docs path saved!' });
      setTimeout(() => setDocsPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save Controller Docs path:', error);
      setDocsPathsMessage({ type: 'error', text: 'Failed to save path' });
    }
  };

  const handleSaveMetadataPath = async () => {
    if (!metadataPath.trim()) {
      setDocsPathsMessage({ type: 'error', text: 'Please enter a valid path' });
      return;
    }

    try {
      await window.appSettingsAPI.setMetadataPath(metadataPath);
      setDocsPathsMessage({ type: 'success', text: 'Metadata path saved!' });
      setTimeout(() => setDocsPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save Metadata path:', error);
      setDocsPathsMessage({ type: 'error', text: 'Failed to save path' });
    }
  };

  const handleSetDefaultDocsPaths = async () => {
    try {
      const defaultPaths = await window.appSettingsAPI.getDefaultPaths();
      setClaudeDocsPath(defaultPaths.claudeDocsPath);
      setControllerDocsPath(defaultPaths.controllerDocsPath);
      setMetadataPath(defaultPaths.metadataPath);
      setDocsPathsMessage({ type: 'success', text: 'Default paths set!' });
      setTimeout(() => setDocsPathsMessage(null), 3000);
    } catch (error) {
      console.error('Failed to set default paths:', error);
      setDocsPathsMessage({ type: 'error', text: 'Failed to set default paths' });
    }
  };

  // If no projectPath, show app settings UI
  if (!projectPath) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h2>Application Settings</h2>
        </div>

        {/* Settings File Location Info */}
        {settingsFilePath && (
          <div className={styles.settingsInfo}>
            <div className={styles.infoLabel}>Settings File Location:</div>
            <div className={styles.infoValue}>{settingsFilePath}</div>
          </div>
        )}

        <div className={styles.settingsSection}>
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>Claude Projects Path</label>
            <div className={styles.settingDescription}>
              The directory path where Claude CLI stores session data (typically ~/.claude/projects)
            </div>
            <div className={styles.settingNote}>
              💡 After changing the path, use the "Refresh" button in Claude Projects page to reload
              the session list.
            </div>
            <div className={styles.pathInput}>
              <input
                type="text"
                value={claudeProjectsPath}
                onChange={(e) => setClaudeProjectsPath(e.target.value)}
                placeholder={defaultProjectsPath || '/Users/yourusername/.claude/projects'}
                className={styles.input}
                disabled={isPathLoading}
              />
              <button
                type="button"
                onClick={handleSetDefaultProjectsPath}
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

          {/* MCP Resource Paths Section */}
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>MCP Configuration Resource Paths</label>
            <div className={styles.settingDescription}>
              Configuration files containing mcpServers definitions (e.g., GitHub, Memory, Database
              servers). Each file should have a "mcpServers" section defining MCP server
              configurations. The default location is ~/.claude.json. You can add custom MCP
              configuration files here.
            </div>
            <div className={styles.settingNote}>
              💡 After changing paths, use the "🔄 Refresh Servers" button in MCP Configs page to
              reload the server list.
            </div>

            {/* Configured Paths */}
            <div className={styles.resourcePathsList}>
              {mcpResourcePaths.length > 0 ? (
                mcpResourcePaths.map((path, index) => (
                  <div key={index} className={styles.resourcePathItem}>
                    <span className={styles.resourcePathText}>{path}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveMcpPath(path)}
                      className={styles.removePathButton}
                    >
                      Remove
                    </button>
                  </div>
                ))
              ) : (
                <div className={styles.emptyPaths}>
                  No resource paths configured. Click "Set Default Path" to add ~/.claude.json.
                </div>
              )}
            </div>

            {/* Add New Path */}
            <div className={styles.pathInput}>
              <input
                type="text"
                value={newMcpPath}
                onChange={(e) => setNewMcpPath(e.target.value)}
                placeholder="/path/to/mcp-config.json or ~/.config/claude/config.json"
                className={styles.input}
                disabled={isPathLoading}
              />
              <button
                type="button"
                onClick={handleSetDefaultMcpPaths}
                className={styles.browseButton}
                disabled={isPathLoading}
              >
                Set Default Path
              </button>
              <button
                type="button"
                onClick={handleSelectMcpFile}
                className={styles.browseButton}
                disabled={isPathLoading}
              >
                Browse
              </button>
            </div>
            <button
              type="button"
              onClick={handleAddMcpPath}
              className={styles.addPathButton}
              disabled={!newMcpPath.trim() || isPathLoading}
            >
              + Add Custom Path
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
          </div>

          {/* Document Paths Section */}
          <div className={styles.settingItem}>
            <label className={styles.settingLabel}>Document Paths</label>
            <div className={styles.settingDescription}>
              Configure paths to documentation and metadata directories used by the application.
            </div>

            {/* Claude Docs Path */}
            <div className={styles.docPathSection}>
              <label className={styles.docPathLabel}>Claude Cookbooks Path</label>
              <div className={styles.pathInput}>
                <input
                  type="text"
                  value={claudeDocsPath}
                  onChange={(e) => setClaudeDocsPath(e.target.value)}
                  placeholder="Path to Claude documentation files"
                  className={styles.input}
                  disabled={isPathLoading}
                />
                <button
                  type="button"
                  onClick={handleSaveClaudeDocsPath}
                  className={styles.browseButton}
                  disabled={!claudeDocsPath.trim() || isPathLoading}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Controller Docs Path */}
            <div className={styles.docPathSection}>
              <label className={styles.docPathLabel}>Controller Docs Path</label>
              <div className={styles.pathInput}>
                <input
                  type="text"
                  value={controllerDocsPath}
                  onChange={(e) => setControllerDocsPath(e.target.value)}
                  placeholder="Path to controller documentation files"
                  className={styles.input}
                  disabled={isPathLoading}
                />
                <button
                  type="button"
                  onClick={handleSaveControllerDocsPath}
                  className={styles.browseButton}
                  disabled={!controllerDocsPath.trim() || isPathLoading}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Metadata Path */}
            <div className={styles.docPathSection}>
              <label className={styles.docPathLabel}>Metadata Path</label>
              <div className={styles.pathInput}>
                <input
                  type="text"
                  value={metadataPath}
                  onChange={(e) => setMetadataPath(e.target.value)}
                  placeholder="Path to metadata storage directory"
                  className={styles.input}
                  disabled={isPathLoading}
                />
                <button
                  type="button"
                  onClick={handleSaveMetadataPath}
                  className={styles.browseButton}
                  disabled={!metadataPath.trim() || isPathLoading}
                >
                  Save
                </button>
              </div>
            </div>

            {/* Set Default Button */}
            <button
              type="button"
              onClick={handleSetDefaultDocsPaths}
              className={styles.addPathButton}
              disabled={isPathLoading}
            >
              Set Default Paths
            </button>

            {docsPathsMessage && (
              <div
                className={
                  docsPathsMessage.type === 'success' ? styles.successMessage : styles.errorMessage
                }
              >
                {docsPathsMessage.text}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Legacy project settings UI
  if (loading) {
    return <div className={styles.container}>Loading settings...</div>;
  }

  if (!settings) {
    return <div className={styles.container}>No settings found</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Project Settings</h2>
        <div className={styles.actions}>
          <button type="button" onClick={handleBackup} className={styles.button}>
            Create Backup
          </button>
          <button type="button" onClick={loadSettings} className={styles.button}>
            Refresh
          </button>
        </div>
      </div>

      <div className={styles.fileList}>
        {/* CLAUDE.md */}
        {settings.claudeMd && (
          <div className={styles.fileItem}>
            <div className={styles.fileHeader}>
              <span className={styles.fileName}>
                {settings.claudeMd.name}
                {!settings.claudeMd.exists && <span className={styles.notFound}> (not found)</span>}
              </span>
              {settings.claudeMd.exists && (
                <button
                  type="button"
                  onClick={() => setActiveFile(activeFile === 'claudeMd' ? null : 'claudeMd')}
                  className={styles.toggleButton}
                >
                  {activeFile === 'claudeMd' ? 'Hide' : 'Edit'}
                </button>
              )}
            </div>
            {settings.claudeMd.lastModified && (
              <div className={styles.fileInfo}>
                Last modified: {new Date(settings.claudeMd.lastModified).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* .mcp.json */}
        {settings.mcpJson && (
          <div className={styles.fileItem}>
            <div className={styles.fileHeader}>
              <span className={styles.fileName}>
                {settings.mcpJson.name}
                {!settings.mcpJson.exists && <span className={styles.notFound}> (not found)</span>}
              </span>
              {settings.mcpJson.exists && (
                <button
                  type="button"
                  onClick={() => setActiveFile(activeFile === 'mcpJson' ? null : 'mcpJson')}
                  className={styles.toggleButton}
                >
                  {activeFile === 'mcpJson' ? 'Hide' : 'Edit'}
                </button>
              )}
            </div>
            {settings.mcpJson.lastModified && (
              <div className={styles.fileInfo}>
                Last modified: {new Date(settings.mcpJson.lastModified).toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* .claude/ directory info */}
        {settings.claudeDir?.exists && (
          <div className={styles.fileItem}>
            <div className={styles.fileHeader}>
              <span className={styles.fileName}>{settings.claudeDir.name}/</span>
            </div>
            <div className={styles.fileInfo}>Directory exists</div>
          </div>
        )}
      </div>

      {/* Editor panels */}
      {activeFile === 'claudeMd' && settings.claudeMd && (
        <div className={styles.editorPanel}>
          <h3>Edit CLAUDE.md</h3>
          <p className={styles.editorNote}>Editor component will be implemented next</p>
        </div>
      )}

      {activeFile === 'mcpJson' && settings.mcpJson && (
        <div className={styles.editorPanel}>
          <h3>Edit .mcp.json</h3>
          <p className={styles.editorNote}>Editor component will be implemented next</p>
        </div>
      )}
    </div>
  );
};
