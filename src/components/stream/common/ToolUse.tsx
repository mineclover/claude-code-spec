import type React from 'react';
import { CodeBlock } from './CodeBlock';
import styles from './ToolUse.module.css';

interface ToolUseProps {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export const ToolUse: React.FC<ToolUseProps> = ({ id, name, input }) => {
  return (
    <div className={styles.toolUse}>
      <div className={styles.header}>
        <span className={styles.icon}>🔨</span>
        <span className={styles.toolName}>{name}</span>
        <span className={styles.toolId}>{id}</span>
      </div>
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" maxHeight={200} />
    </div>
  );
};
