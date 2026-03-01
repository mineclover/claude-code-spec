import type React from 'react';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
  code: string;
  language?: 'json' | 'typescript' | 'text';
  maxHeight?: number;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = 'text',
  maxHeight = 300,
}) => {
  return (
    <pre className={styles.codeBlock} style={{ maxHeight: `${maxHeight}px` }}>
      <code className={styles[language]}>{code}</code>
    </pre>
  );
};
