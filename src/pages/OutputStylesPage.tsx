import { useState, useEffect, useId, useCallback } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type { OutputStyle, OutputStyleListItem } from '../types/outputStyle';
import styles from './OutputStylesPage.module.css';

export function OutputStylesPage() {
  const { projectPath } = useProject();
  
  // Generate unique IDs for form elements
  const styleNameId = useId();
  const styleDescriptionId = useId();
  const styleTypeId = useId();
  const styleInstructionsId = useId();
  const [builtinStyles, setBuiltinStyles] = useState<OutputStyleListItem[]>([]);
  const [customStyles, setCustomStyles] = useState<OutputStyleListItem[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<OutputStyle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [newStyleDescription, setNewStyleDescription] = useState('');
  const [newStyleInstructions, setNewStyleInstructions] = useState('');
  const [newStyleType, setNewStyleType] = useState<'user' | 'project'>('user');

  const loadOutputStyles = useCallback(async () => {
    if (!projectPath) return;

    try {
      const allStyles = await window.outputStyleAPI.listOutputStyles(projectPath);

      const builtin = allStyles.filter((s) => s.type === 'builtin');
      const custom = allStyles.filter((s) => s.type === 'user' || s.type === 'project');

      setBuiltinStyles(builtin);
      setCustomStyles(custom);
    } catch (error) {
      console.error('Failed to load output styles:', error);
    }
  }, [projectPath]);

  // Load all output styles
  useEffect(() => {
    if (!projectPath) return;

    loadOutputStyles();
  }, [projectPath, loadOutputStyles]);

  const handleCreateStyle = async () => {
    if (!projectPath) {
      alert('No project selected');
      return;
    }

    if (!newStyleName || !newStyleDescription) {
      alert('Name and description are required');
      return;
    }

    try {
      const result = await window.outputStyleAPI.createOutputStyle(
        newStyleName,
        newStyleDescription,
        newStyleInstructions,
        newStyleType,
        projectPath,
      );

      if (result.success) {
        // Reset form and reload
        setIsCreating(false);
        setNewStyleName('');
        setNewStyleDescription('');
        setNewStyleInstructions('');
        await loadOutputStyles();
      } else {
        alert(`Failed to create output style: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create output style:', error);
      alert('Failed to create output style');
    }
  };

  const handleSelectStyle = async (style: OutputStyleListItem) => {
    if (style.type === 'builtin') {
      // Built-in styles don't have editable content
      setSelectedStyle({
        ...style,
        instructions: undefined,
      });
      return;
    }

    if (!projectPath) return;

    try {
      const content = await window.outputStyleAPI.getOutputStyle(
        style.name,
        style.type,
        projectPath,
      );

      if (content) {
        // Parse the content to get instructions
        const instructionsMatch = content.match(/^---\n[\s\S]*?\n---\n\n([\s\S]*)$/);
        const instructions = instructionsMatch ? instructionsMatch[1] : '';

        setSelectedStyle({
          ...style,
          instructions,
        });
      }
    } catch (error) {
      console.error('Failed to load output style details:', error);
    }
  };

  const handleDeleteStyle = async (name: string, type: 'user' | 'project') => {
    if (!projectPath) return;
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    try {
      const result = await window.outputStyleAPI.deleteOutputStyle(name, type, projectPath);
      if (result.success) {
        setSelectedStyle(null);
        await loadOutputStyles();
      } else {
        alert(`Failed to delete output style: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to delete output style:', error);
      alert('Failed to delete output style');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Output Styles</h1>
        <p className={styles.description}>
          Configure Claude Code's output style and behavior
        </p>
      </div>

      <div className={styles.content}>
        {/* Built-in Styles Section */}
        <section className={styles.section}>
          <h2>Built-in Styles</h2>
          <div className={styles.stylesList}>
            {builtinStyles.map((style) => (
              <button
                key={style.name}
                type="button"
                className={styles.styleCard}
                onClick={() => handleSelectStyle(style)}
              >
                <h3>{style.name}</h3>
                <p>{style.description}</p>
                {style.name === 'json-output' && (
                  <div className={styles.priorityBadge}>Priority Feature</div>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Custom Styles Section */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Custom Styles</h2>
            <button
              type="button"
              className={styles.createButton}
              onClick={() => setIsCreating(true)}
            >
              + New Custom Style
            </button>
          </div>

          {customStyles.length === 0 && !isCreating && (
            <p className={styles.emptyState}>
              No custom styles yet. Create one to define custom output behavior.
            </p>
          )}

          {customStyles.length > 0 && (
            <div className={styles.stylesList}>
              {customStyles.map((style) => (
                <button
                  key={style.name}
                  type="button"
                  className={styles.styleCard}
                  onClick={() => handleSelectStyle(style)}
                >
                  <h3>{style.name}</h3>
                  <p>{style.description}</p>
                  <span className={styles.typeBadge}>{style.type}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Create Custom Style Form */}
        {isCreating && (
          <section className={styles.createSection}>
            <h2>Create Custom Output Style</h2>
            <form
              className={styles.createForm}
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateStyle();
              }}
            >
              <div className={styles.formGroup}>
                <label htmlFor={styleNameId}>Style Name:</label>
                <input
                  id={styleNameId}
                  type="text"
                  value={newStyleName}
                  onChange={(e) => setNewStyleName(e.target.value)}
                  placeholder="e.g., json-formatter, code-reviewer"
                  required
                />
                <p className={styles.hint}>
                  Use lowercase with hyphens (e.g., my-custom-style)
                </p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor={styleDescriptionId}>Description:</label>
                <input
                  id={styleDescriptionId}
                  type="text"
                  value={newStyleDescription}
                  onChange={(e) => setNewStyleDescription(e.target.value)}
                  placeholder="Brief description of this style's purpose"
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor={styleTypeId}>Storage Location:</label>
                <select
                  id={styleTypeId}
                  value={newStyleType}
                  onChange={(e) =>
                    setNewStyleType(e.target.value as 'user' | 'project')
                  }
                >
                  <option value="user">User (~/.claude/output-styles/)</option>
                  <option value="project">
                    Project (.claude/output-styles/)
                  </option>
                </select>
                <p className={styles.hint}>
                  User styles are available globally, project styles are shared
                  with team
                </p>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor={styleInstructionsId}>Instructions (Markdown):</label>
                <textarea
                  id={styleInstructionsId}
                  value={newStyleInstructions}
                  onChange={(e) => setNewStyleInstructions(e.target.value)}
                  placeholder={`# Custom Style Instructions

## Output Format
- Use structured format
- Include examples

## Tone
- Professional and clear

## Focus Areas
- Specific aspects to emphasize`}
                  rows={15}
                  className={styles.textarea}
                />
                <p className={styles.hint}>
                  Define custom behavior modifications in Markdown format
                </p>
              </div>

              <div className={styles.formActions}>
                <button type="submit" className={styles.submitButton}>
                  Create Style
                </button>
                <button
                  type="button"
                  className={styles.cancelButton}
                  onClick={() => {
                    setIsCreating(false);
                    setNewStyleName('');
                    setNewStyleDescription('');
                    setNewStyleInstructions('');
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Style Detail View */}
        {selectedStyle && !isCreating && (
          <section className={styles.detailSection}>
            <h2>Style Details: {selectedStyle.name}</h2>
            <div className={styles.detailCard}>
              <p>
                <strong>Type:</strong> {selectedStyle.type}
              </p>
              <p>
                <strong>Description:</strong> {selectedStyle.description}
              </p>
              {selectedStyle.instructions && (
                <div className={styles.instructions}>
                  <strong>Instructions:</strong>
                  <pre>{selectedStyle.instructions}</pre>
                </div>
              )}
              <div className={styles.detailActions}>
                {(selectedStyle.type === 'user' || selectedStyle.type === 'project') && (
                  <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => handleDeleteStyle(selectedStyle.name, selectedStyle.type as 'user' | 'project')}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className={styles.closeButton}
                  onClick={() => setSelectedStyle(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
