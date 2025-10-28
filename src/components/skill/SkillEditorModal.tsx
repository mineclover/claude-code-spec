import type React from 'react';
import { useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import type { Skill, SkillCreateInput, SkillUpdateInput } from '../../types/skill';
import styles from './SkillEditorModal.module.css';

interface SkillEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  skill?: Skill | null;
  scope: 'global' | 'project';
  projectPath?: string;
  mode: 'create' | 'edit';
}

export const SkillEditorModal: React.FC<SkillEditorModalProps> = ({
  isOpen,
  onClose,
  onSave,
  skill,
  scope,
  projectPath,
  mode,
}) => {
  // Frontmatter fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('');
  const [author, setAuthor] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Content
  const [content, setContent] = useState('');

  // UI state
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Generate unique IDs for form elements
  const nameId = useId();
  const descriptionId = useId();
  const versionId = useId();
  const authorId = useId();
  const tagsId = useId();

  // Load skill data when editing
  useEffect(() => {
    if (mode === 'edit' && skill) {
      setName(skill.frontmatter.name || '');
      setDescription(skill.frontmatter.description || '');
      setVersion(skill.frontmatter.version || '');
      setAuthor(skill.frontmatter.author || '');
      setTags(skill.frontmatter.tags || []);
      setContent(skill.content || '');
    } else if (mode === 'create') {
      // Reset form
      setName('');
      setDescription('');
      setVersion('1.0.0');
      setAuthor('');
      setTags([]);
      setContent(
        '# Skill Instructions\n\nDescribe how Claude should use this skill...\n\n## When to Use\n\n## How to Use\n\n## Examples\n',
      );
    }
  }, [mode, skill]);

  // Validate form
  const validate = (): boolean => {
    const newErrors: string[] = [];

    if (!name.trim()) {
      newErrors.push('Name is required');
    } else if (!/^[a-z0-9-]+$/.test(name)) {
      newErrors.push('Name must be lowercase letters, numbers, and hyphens only');
    }

    if (!description.trim()) {
      newErrors.push('Description is required');
    }

    if (!content.trim()) {
      newErrors.push('Content is required');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      toast.error('Please fix validation errors');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'create') {
        const input: SkillCreateInput = {
          name,
          description,
          content,
          scope,
          projectPath: scope === 'project' ? projectPath : undefined,
          frontmatter: {
            name,
            description,
            version: version || undefined,
            author: author || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
        };

        await window.skillAPI.createSkill(input);
        toast.success('Skill created successfully');
      } else if (mode === 'edit' && skill) {
        const updates: SkillUpdateInput = {
          frontmatter: {
            name,
            description,
            version: version || undefined,
            author: author || undefined,
            tags: tags.length > 0 ? tags : undefined,
          },
          content,
        };

        await window.skillAPI.updateSkill(
          skill.id,
          updates,
          scope,
          scope === 'project' ? projectPath : undefined,
        );
        toast.success('Skill updated successfully');
      }

      onSave();
      onClose();
    } catch (error) {
      console.error('Failed to save skill:', error);
      toast.error('Failed to save skill');
    } finally {
      setSaving(false);
    }
  };

  // Handle tag input
  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className={styles.header}>
          <h2>{mode === 'create' ? 'Create New Skill' : 'Edit Skill'}</h2>
          <button type="button" className={styles.closeButton} onClick={onClose}>
            ×
          </button>
        </div>

        {errors.length > 0 && (
          <div className={styles.errors}>
            {errors.map((error) => (
              <div key={error} className={styles.error}>
                ⚠️ {error}
              </div>
            ))}
          </div>
        )}

        <div className={styles.tabs}>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'edit' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('edit')}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.tab} ${activeTab === 'preview' ? styles.activeTab : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>

        <div className={styles.content}>
          {activeTab === 'edit' ? (
            <div className={styles.editView}>
              {/* Frontmatter Section */}
              <div className={styles.section}>
                <h3>Frontmatter</h3>
                <div className={styles.formGrid}>
                  <div className={styles.formGroup}>
                    <label htmlFor={nameId}>
                      Name <span className={styles.required}>*</span>
                    </label>
                    <input
                      id={nameId}
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="my-custom-skill"
                      disabled={mode === 'edit'}
                      className={styles.input}
                    />
                    <span className={styles.hint}>Lowercase, hyphens only</span>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor={descriptionId}>
                      Description <span className={styles.required}>*</span>
                    </label>
                    <input
                      id={descriptionId}
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Brief description of this skill"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor={versionId}>Version</label>
                    <input
                      id={versionId}
                      type="text"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0.0"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor={authorId}>Author</label>
                    <input
                      id={authorId}
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      placeholder="Your name"
                      className={styles.input}
                    />
                  </div>

                  <div className={styles.formGroup} style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor={tagsId}>Tags</label>
                    <div className={styles.tagInput}>
                      <input
                        id={tagsId}
                        type="text"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Add tag and press Enter"
                        className={styles.input}
                      />
                      <button type="button" onClick={handleAddTag} className={styles.addButton}>
                        Add
                      </button>
                    </div>
                    <div className={styles.tags}>
                      {tags.map((tag) => (
                        <span key={tag} className={styles.tag}>
                          {tag}
                          <button type="button" onClick={() => handleRemoveTag(tag)}>
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Section */}
              <div className={styles.section}>
                <h3>
                  Content <span className={styles.required}>*</span>
                </h3>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="# Skill Instructions&#10;&#10;Describe how Claude should use this skill..."
                  className={styles.textarea}
                />
                <span className={styles.hint}>Markdown format</span>
              </div>
            </div>
          ) : (
            <div className={styles.previewView}>
              {/* Frontmatter Preview */}
              <div className={styles.previewSection}>
                <h3>Frontmatter</h3>
                <pre className={styles.yamlPreview}>
                  {`---
name: ${name || '(empty)'}
description: ${description || '(empty)'}${version ? `\nversion: ${version}` : ''}${author ? `\nauthor: ${author}` : ''}${
                    tags.length > 0 ? `\ntags:\n${tags.map((t) => `  - ${t}`).join('\n')}` : ''
                  }
---`}
                </pre>
              </div>

              {/* Content Preview */}
              <div className={styles.previewSection}>
                <h3>Content</h3>
                <div className={styles.markdownPreview}>
                  <pre>{content || '(empty)'}</pre>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button type="button" onClick={onClose} className={styles.cancelButton} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={styles.saveButton}
            disabled={saving}
          >
            {saving ? 'Saving...' : mode === 'create' ? 'Create Skill' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
