/**
 * OutputStyleSelector Component
 *
 * Dropdown selector for output-styles
 */

import React, { useEffect, useState } from 'react';
import styles from './OutputStyleSelector.module.css';

interface OutputStyleSelectorProps {
  projectPath: string;
  value?: string;
  onChange: (styleName: string | undefined) => void;
  disabled?: boolean;
}

export function OutputStyleSelector({
  projectPath,
  value,
  onChange,
  disabled = false
}: OutputStyleSelectorProps) {
  const [styleNames, setStyleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStyleNames();
  }, [projectPath]);

  const loadStyleNames = async () => {
    if (!projectPath) return;

    setLoading(true);
    setError(null);

    try {
      const names = await window.outputStyleAPI.listNames(projectPath);
      setStyleNames(names);
    } catch (err) {
      console.error('Failed to load output-styles:', err);
      setError('Failed to load output-styles');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    onChange(selectedValue === '' ? undefined : selectedValue);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <label className={styles.label}>Output Style</label>
        <select className={styles.select} disabled>
          <option>Loading...</option>
        </select>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <label className={styles.label}>Output Style</label>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <label className={styles.label}>
        Output Style
        <span className={styles.optional}>(optional)</span>
      </label>
      <select
        className={styles.select}
        value={value || ''}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="">None (default)</option>
        {styleNames.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {value && (
        <div className={styles.hint}>
          Output will be formatted according to '{value}' style
        </div>
      )}
    </div>
  );
}
