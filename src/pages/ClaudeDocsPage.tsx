import type React from 'react';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './ClaudeDocsPage.module.css';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export const ClaudeDocsPage: React.FC = () => {
  const navigate = useNavigate();
  const contentRef = useRef<HTMLPreElement>(null);
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const DOCS_ROOT = '/Users/junwoobang/project/claude-code-spec/docs/claude-context';

  useEffect(() => {
    loadFileTree();
  }, []);

  const loadFileTree = async () => {
    try {
      const tree = await window.docsAPI.readDocsStructure(DOCS_ROOT);
      setFileTree(tree);
      // Expand root level by default
      setExpandedDirs(new Set([DOCS_ROOT]));
    } catch (error) {
      console.error('Failed to load docs structure:', error);
    }
  };

  const loadFileContent = async (filePath: string) => {
    setLoading(true);
    try {
      const fileContent = await window.docsAPI.readDocsFile(filePath);
      setContent(fileContent);
      setSelectedFile(filePath);
    } catch (error) {
      console.error('Failed to load file:', error);
      setContent('Failed to load file content');
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = (dirPath: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const renderFileTree = (nodes: FileNode[], level = 0): React.ReactNode => {
    return nodes.map((node) => {
      const isExpanded = expandedDirs.has(node.path);
      const isSelected = selectedFile === node.path;

      if (node.type === 'directory') {
        return (
          <div key={node.path} className={styles.treeNode}>
            <div
              className={styles.directory}
              style={{ paddingLeft: `${level * 16}px` }}
              onClick={() => toggleDirectory(node.path)}
            >
              <span className={styles.dirIcon}>{isExpanded ? '📂' : '📁'}</span>
              <span className={styles.dirName}>{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className={styles.children}>
                {renderFileTree(node.children, level + 1)}
              </div>
            )}
          </div>
        );
      }

      // Only show .md files
      if (!node.name.endsWith('.md')) {
        return null;
      }

      return (
        <div
          key={node.path}
          className={`${styles.file} ${isSelected ? styles.selected : ''}`}
          style={{ paddingLeft: `${level * 16 + 24}px` }}
          onClick={() => loadFileContent(node.path)}
        >
          <span className={styles.fileIcon}>📄</span>
          <span className={styles.fileName}>{node.name}</span>
        </div>
      );
    });
  };

  const copyPathToClipboard = () => {
    if (selectedFile) {
      navigator.clipboard.writeText(selectedFile);
    }
  };

  const handleContentClick = (e: React.MouseEvent<HTMLPreElement>) => {
    const target = e.target as HTMLElement;

    // Check if clicked element contains a reference pattern (@context/...)
    const text = target.textContent || '';
    const referenceMatch = text.match(/@context\/([^\s]+)/);

    if (referenceMatch) {
      const referencePath = referenceMatch[1];
      const fullPath = `${DOCS_ROOT}/${referencePath}`;

      // Load the referenced document
      loadFileContent(fullPath);
    }
  };

  const navigateToIndex = () => {
    navigate('/index');
  };

  const getRelativePath = (filePath: string): string => {
    if (!filePath) return '';
    return filePath.replace(DOCS_ROOT + '/', '');
  };

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Claude Cookbooks</h3>
          <p className={styles.subtitle}>Context Documentation</p>
        </div>
        <div className={styles.fileTreeContainer}>
          {renderFileTree(fileTree)}
        </div>
      </div>

      <div className={styles.content}>
        {selectedFile ? (
          <>
            <div className={styles.contentHeader}>
              <div className={styles.breadcrumb}>
                <button className={styles.breadcrumbButton} onClick={navigateToIndex}>
                  📇 Index
                </button>
                <span className={styles.breadcrumbSeparator}>/</span>
                <span className={styles.breadcrumbCurrent}>{getRelativePath(selectedFile)}</span>
              </div>
              <div className={styles.headerActions}>
                <button
                  className={styles.copyButton}
                  onClick={copyPathToClipboard}
                  title="Copy file path"
                >
                  📋 Copy Path
                </button>
              </div>
            </div>
            <div className={styles.markdown}>
              {loading ? (
                <div className={styles.loading}>Loading...</div>
              ) : (
                <pre
                  ref={contentRef}
                  className={styles.markdownContent}
                  onClick={handleContentClick}
                >
                  {content}
                </pre>
              )}
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <h2>Welcome to Claude Docs</h2>
            <p>Select a document from the left sidebar to view its content.</p>
            <button className={styles.indexButton} onClick={navigateToIndex}>
              📇 Open Index
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
