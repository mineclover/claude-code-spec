/**
 * OutputStyleEditor Component
 *
 * Modal for creating/editing output-styles
 */

import React, { useState, useEffect } from 'react';
import styles from './OutputStyleEditor.module.css';

interface OutputStyle {
  name: string;
  description: string;
  content: string;
}

interface OutputStyleEditorProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  editingStyle?: OutputStyle;
  onSave: () => void;
}

export function OutputStyleEditor({
  isOpen,
  onClose,
  projectPath,
  editingStyle,
  onSave
}: OutputStyleEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = !!editingStyle;

  useEffect(() => {
    if (editingStyle) {
      setName(editingStyle.name);
      setDescription(editingStyle.description);
      setContent(editingStyle.content);
    } else {
      setName('');
      setDescription('');
      setContent('');
    }
    setError(null);
  }, [editingStyle, isOpen]);

  const handleSave = async () => {
    // Validation
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    if (!content.trim()) {
      setError('Content is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const style = {
        name: name.trim(),
        description: description.trim(),
        content: content.trim()
      };

      let result;
      if (isEditMode) {
        result = await window.outputStyleAPI.updateStyle(
          projectPath,
          editingStyle.name,
          style
        );
      } else {
        result = await window.outputStyleAPI.createStyle(projectPath, style);
      }

      if (result.success) {
        onSave();
        handleClose();
      } else {
        setError(result.error || 'Failed to save output-style');
      }
    } catch (err) {
      console.error('Failed to save output-style:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setContent('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {isEditMode ? 'Edit Output-Style' : 'Create Output-Style'}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </div>

        <div className={styles.body}>
          {error && <div className={styles.error}>{error}</div>}

          <div className={styles.field}>
            <label className={styles.label}>
              Name
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., structured-json"
              disabled={isEditMode || saving}
            />
            {isEditMode && (
              <div className={styles.hint}>Name cannot be changed</div>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Description
              <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              className={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this output-style"
              disabled={saving}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Content (Markdown)
              <span className={styles.required}>*</span>
            </label>
            <textarea
              className={styles.textarea}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`# Output Style Instructions

You must respond with...

## Required Fields
- field1: description
- field2: description

## Example
\`\`\`json
{
  "field1": "value",
  "field2": "value"
}
\`\`\``}
              rows={15}
              disabled={saving}
            />
            <div className={styles.hint}>
              This will be injected into Claude's system prompt
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelButton} onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button className={styles.saveButton} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
