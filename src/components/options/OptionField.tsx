/**
 * OptionField - Single option input by type
 */

import { useId } from 'react';
import type { CLIOptionSchema } from '../../types/cli-tool';
import styles from './OptionField.module.css';

interface OptionFieldProps {
  schema: CLIOptionSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

export function OptionField({ schema, value, onChange }: OptionFieldProps) {
  const id = useId();

  const renderInput = () => {
    switch (schema.type) {
      case 'select':
        return (
          <select
            id={id}
            className={styles.select}
            value={(value as string) ?? schema.defaultValue ?? ''}
            onChange={(e) => onChange(e.target.value || undefined)}
          >
            <option value="">-- Default --</option>
            {schema.choices?.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className={styles.checkboxLabel}>
            <input
              id={id}
              type="checkbox"
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
            />
            <span>{schema.label}</span>
          </label>
        );

      case 'number':
        return (
          <input
            id={id}
            type="number"
            className={styles.input}
            value={(value as number) ?? ''}
            placeholder={schema.placeholder}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          />
        );

      default:
        return (
          <input
            id={id}
            type="text"
            className={styles.input}
            value={(value as string) ?? ''}
            placeholder={schema.placeholder}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
        );
    }
  };

  const meta = (
    <>
      {schema.description && <div className={styles.hint}>{schema.description}</div>}
      {schema.cliFlag && <div className={styles.flag}>CLI flag: {schema.cliFlag}</div>}
    </>
  );

  if (schema.type === 'boolean') {
    return (
      <div className={styles.field}>
        {renderInput()}
        {meta}
      </div>
    );
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {schema.label}
        {schema.required && <span className={styles.required}>*</span>}
      </label>
      {renderInput()}
      {meta}
    </div>
  );
}
