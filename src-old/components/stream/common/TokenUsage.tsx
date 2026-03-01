import type React from 'react';
import styles from './TokenUsage.module.css';

interface TokenUsageProps {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export const TokenUsage: React.FC<TokenUsageProps> = ({
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheCreationTokens,
}) => {
  return (
    <div className={styles.tokenUsage}>
      <span className={styles.label}>Tokens:</span>
      <span className={styles.stat}>
        <span className={styles.statLabel}>In:</span>
        <span className={styles.statValue}>{inputTokens.toLocaleString()}</span>
      </span>
      <span className={styles.stat}>
        <span className={styles.statLabel}>Out:</span>
        <span className={styles.statValue}>{outputTokens.toLocaleString()}</span>
      </span>
      {cacheReadTokens !== undefined && cacheReadTokens > 0 && (
        <span className={styles.stat}>
          <span className={styles.statLabel}>Cache Read:</span>
          <span className={styles.statValue}>{cacheReadTokens.toLocaleString()}</span>
        </span>
      )}
      {cacheCreationTokens !== undefined && cacheCreationTokens > 0 && (
        <span className={styles.stat}>
          <span className={styles.statLabel}>Cache Create:</span>
          <span className={styles.statValue}>{cacheCreationTokens.toLocaleString()}</span>
        </span>
      )}
    </div>
  );
};
