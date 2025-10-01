import type React from 'react';
import { useEffect, useState } from 'react';
import styles from './ControllerDocsPage.module.css';

export const ControllerDocsPage: React.FC = () => {
  const [glossary, setGlossary] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const GLOSSARY_PATH = '/Users/junwoobang/project/claude-code-spec/docs/controller-docs/glossary.md';

  useEffect(() => {
    loadGlossary();
  }, []);

  const loadGlossary = async () => {
    setLoading(true);
    try {
      const content = await window.docsAPI.readDocsFile(GLOSSARY_PATH);
      setGlossary(content);
    } catch (error) {
      console.error('Failed to load glossary:', error);
      setGlossary('# Failed to load glossary\n\nPlease check the console for errors.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>Controller Docs</h1>
          <p className={styles.subtitle}>용어집 및 메타 관리</p>
        </div>
      </div>

      <div className={styles.content}>
        {loading ? (
          <div className={styles.loading}>Loading...</div>
        ) : (
          <div className={styles.markdown}>
            <pre className={styles.markdownContent}>{glossary}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
