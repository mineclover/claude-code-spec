import React, { useEffect, useState } from 'react';
import { OutputStyleEditor } from '../components/outputStyles/OutputStyleEditor';
import { useProject } from '../contexts/ProjectContext';
import styles from './OutputStylesPage.module.css';

interface OutputStyle {
  name: string;
  description: string;
  content: string;
  filePath: string;
}

export function OutputStylesPage() {
  const { projectPath } = useProject();
  const [stylesList, setStylesList] = useState<OutputStyle[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<OutputStyle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingStyle, setEditingStyle] = useState<OutputStyle | undefined>(undefined);

  useEffect(() => {
    loadStyles();
  }, [projectPath]);

  const loadStyles = async () => {
    if (!projectPath) return;

    setLoading(true);
    setError(null);

    try {
      const styles = await window.outputStyleAPI.listStyles(projectPath);
      setStylesList(styles);

      // Select first style if available
      if (styles.length > 0 && !selectedStyle) {
        setSelectedStyle(styles[0]);
      }
    } catch (err) {
      console.error('Failed to load output-styles:', err);
      setError('Failed to load output-styles');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingStyle(undefined);
    setIsEditorOpen(true);
  };

  const handleEdit = (style: OutputStyle) => {
    setEditingStyle(style);
    setIsEditorOpen(true);
  };

  const handleDelete = async (style: OutputStyle) => {
    if (!confirm(`Are you sure you want to delete "${style.name}"?`)) {
      return;
    }

    try {
      const result = await window.outputStyleAPI.deleteStyle(projectPath, style.name);
      if (result.success) {
        await loadStyles();
        if (selectedStyle?.name === style.name) {
          setSelectedStyle(null);
        }
      } else {
        alert(result.error || 'Failed to delete output-style');
      }
    } catch (err) {
      console.error('Failed to delete output-style:', err);
      alert('Failed to delete output-style');
    }
  };

  const handleEditorSave = () => {
    loadStyles();
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading output-styles...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Output-Styles</h1>
        <button className={styles.createButton} onClick={handleCreate}>
          + Create Output-Style
        </button>
      </div>

      <div className={styles.content}>
        {/* List Panel */}
        <div className={styles.listPanel}>
          {stylesList.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No output-styles found</p>
              <button className={styles.emptyCreateButton} onClick={handleCreate}>
                Create your first output-style
              </button>
            </div>
          ) : (
            <div className={styles.list}>
              {stylesList.map((style) => (
                <div
                  key={style.name}
                  className={`${styles.listItem} ${
                    selectedStyle?.name === style.name ? styles.selected : ''
                  }`}
                  onClick={() => setSelectedStyle(style)}
                >
                  <div className={styles.listItemHeader}>
                    <h3 className={styles.listItemName}>{style.name}</h3>
                  </div>
                  <p className={styles.listItemDescription}>{style.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className={styles.detailPanel}>
          {selectedStyle ? (
            <>
              <div className={styles.detailHeader}>
                <div>
                  <h2 className={styles.detailTitle}>{selectedStyle.name}</h2>
                  <p className={styles.detailDescription}>{selectedStyle.description}</p>
                </div>
                <div className={styles.detailActions}>
                  <button
                    className={styles.editButton}
                    onClick={() => handleEdit(selectedStyle)}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.deleteButton}
                    onClick={() => handleDelete(selectedStyle)}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className={styles.detailContent}>
                <h3 className={styles.contentLabel}>Content:</h3>
                <pre className={styles.contentPre}>{selectedStyle.content}</pre>
              </div>

              <div className={styles.detailMeta}>
                <span className={styles.metaLabel}>File:</span>
                <span className={styles.metaValue}>{selectedStyle.filePath}</span>
              </div>
            </>
          ) : (
            <div className={styles.detailEmpty}>
              <p>Select an output-style to view details</p>
            </div>
          )}
        </div>
      </div>

      <OutputStyleEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        projectPath={projectPath}
        editingStyle={editingStyle}
        onSave={handleEditorSave}
      />
    </div>
  );
}
