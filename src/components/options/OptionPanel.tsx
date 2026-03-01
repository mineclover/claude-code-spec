/**
 * OptionPanel - Dynamic form generated from CLIOptionSchema[]
 */

import type { CLIOptionSchema } from '../../types/cli-tool';
import { OptionField } from './OptionField';
import styles from './OptionPanel.module.css';

interface OptionPanelProps {
  options: CLIOptionSchema[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function OptionPanel({ options, values, onChange }: OptionPanelProps) {
  // Group options
  const groups = new Map<string, CLIOptionSchema[]>();
  for (const opt of options) {
    const group = opt.group || 'General';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)?.push(opt);
  }

  return (
    <div className={styles.panel}>
      {Array.from(groups.entries()).map(([groupName, groupOptions]) => (
        <div key={groupName} className={styles.group}>
          <div className={styles.groupTitle}>{groupName}</div>
          <div className={styles.fields}>
            {groupOptions.map((opt) => (
              <OptionField
                key={opt.key}
                schema={opt}
                value={values[opt.key]}
                onChange={(value) => onChange(opt.key, value)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
