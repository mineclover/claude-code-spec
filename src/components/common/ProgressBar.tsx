import styles from './ProgressBar.module.css';

interface ProgressBarProps {
  message?: string;
  visible?: boolean;
}

export function ProgressBar({ message, visible = true }: ProgressBarProps) {
  return (
    <div className={`${styles.wrapper} ${visible ? styles.visible : styles.hidden}`}>
      <div className={styles.track}>
        <div className={styles.bar} />
      </div>
      {message && <div className={styles.message}>{message}</div>}
    </div>
  );
}
