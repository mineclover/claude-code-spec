import type React from 'react';
import { useEffect, useState } from 'react';
import type { ProjectSettings, SettingsBackup } from '../../preload';
import styles from './SettingsTab.module.css';

interface SettingsTabProps {
  projectPath: string;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ projectPath }) => {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFile, setActiveFile] = useState<'claudeMd' | 'mcpJson' | null>(null);

  useEffect(() => {
    loadSettings();
  }, [projectPath]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const projectSettings = await window.settingsAPI.findFiles(projectPath);
      setSettings(projectSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
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
        {settings.claudeDir && settings.claudeDir.exists && (
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
