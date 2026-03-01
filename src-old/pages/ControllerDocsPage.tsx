import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import styles from './ControllerDocsPage.module.css';

export const ControllerDocsPage: React.FC = () => {
  const [glossary, setGlossary] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [docsPath, setDocsPath] = useState<string>('');

  // Load docs path from settings
  useEffect(() => {
    const loadDocsPath = async () => {
      try {
        const savedPath = await window.appSettingsAPI.getControllerDocsPath();
        const defaultPaths = await window.appSettingsAPI.getDefaultPaths();
        const pathToUse = savedPath || defaultPaths.controllerDocsPath;
        setDocsPath(pathToUse);
      } catch (error) {
        console.error('Failed to load docs path:', error);
      }
    };
    loadDocsPath();
  }, []);

  const loadGlossary = useCallback(async () => {
    if (!docsPath) return;

    setLoading(true);
    try {
      // Construct glossary path: docsPath + '/glossary.md'
      const glossaryPath = `${docsPath}/glossary.md`;
      const content = await window.docsAPI.readDocsFile(glossaryPath);
      setGlossary(content);
    } catch (error) {
      console.error('Failed to load glossary:', error);
      setGlossary('# Failed to load glossary\n\nPlease check the console for errors.');
    } finally {
      setLoading(false);
    }
  }, [docsPath]);

  useEffect(() => {
    loadGlossary();
  }, [loadGlossary]);

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
