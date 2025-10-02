import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { PAGE_INDEX } from '../../data/pageIndex';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [addressInput, setAddressInput] = useState('');
  const [_isEditingAddress, setIsEditingAddress] = useState(false);
  const { projectPath, projectDirName } = useProject();

  const isActive = (path: string) => location.pathname === path;

  const getCurrentPageInfo = () => {
    // Find page by route
    const page = PAGE_INDEX.find((p) => p.route === location.pathname);
    return page;
  };

  const getDetailedPath = useCallback(() => {
    return location.pathname;
  }, [location.pathname]);

  const getDisplayName = () => {
    const pageInfo = getCurrentPageInfo();
    const pathParts = location.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'claude-projects') {
      const projectDirName = pathParts[1];
      const sessionId = pathParts[2];

      if (sessionId) {
        return `${pageInfo?.displayName || 'Claude Projects'} > Session`;
      } else if (projectDirName) {
        // Convert directory name format to readable name
        // -Users-junwoobang-project-name -> project-name
        const projectName = projectDirName.split('-').pop() || projectDirName;
        return `${pageInfo?.displayName || 'Claude Projects'} > ${projectName}`;
      }
    }

    return pageInfo?.displayName || location.pathname;
  };

  useEffect(() => {
    setAddressInput(getDetailedPath());
  }, [getDetailedPath]);

  const handleAddressKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigate(addressInput);
      setIsEditingAddress(false);
    } else if (e.key === 'Escape') {
      setAddressInput(getDetailedPath());
      setIsEditingAddress(false);
    }
  };

  const pageInfo = getCurrentPageInfo();

  return (
    <div className={styles.container}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <h2>Claude CLI</h2>
          <span className={styles.subtitle}>Control & Analytics</span>
        </div>

        <div className={styles.nav}>
          <Link
            to="/index"
            className={`${styles.navItem} ${isActive('/index') ? styles.active : ''}`}
          >
            <span className={styles.icon}>📇</span>
            <span>Index</span>
          </Link>

          <Link to="/" className={`${styles.navItem} ${isActive('/') ? styles.active : ''}`}>
            <span className={styles.icon}>▶️</span>
            <span>Execute</span>
          </Link>

          <Link
            to="/claude-projects"
            className={`${styles.navItem} ${isActive('/claude-projects') ? styles.active : ''}`}
          >
            <span className={styles.icon}>📁</span>
            <span>Claude Projects</span>
          </Link>

          <Link
            to="/mcp-configs"
            className={`${styles.navItem} ${isActive('/mcp-configs') ? styles.active : ''}`}
          >
            <span className={styles.icon}>🔌</span>
            <span>MCP Configs</span>
          </Link>

          <Link
            to="/claude-docs"
            className={`${styles.navItem} ${isActive('/claude-docs') ? styles.active : ''}`}
          >
            <span className={styles.icon}>📚</span>
            <span>Claude Docs</span>
          </Link>

          <Link
            to="/controller-docs"
            className={`${styles.navItem} ${isActive('/controller-docs') ? styles.active : ''}`}
          >
            <span className={styles.icon}>🎛️</span>
            <span>Controller Docs</span>
          </Link>

          <Link
            to="/settings"
            className={`${styles.navItem} ${isActive('/settings') ? styles.active : ''}`}
          >
            <span className={styles.icon}>⚙️</span>
            <span>Settings</span>
          </Link>
        </div>

        <div className={styles.footer}>
          {projectPath ? (
            <div className={styles.currentProject}>
              <div className={styles.currentProjectLabel}>📂 Current Project</div>
              <div className={styles.currentProjectPath} title={projectPath}>
                {projectDirName || projectPath.split('/').filter(Boolean).pop() || 'Unknown'}
              </div>
            </div>
          ) : (
            <div className={styles.noProject}>
              <div className={styles.noProjectLabel}>No project selected</div>
            </div>
          )}
          <div className={styles.version}>v1.0.0</div>
        </div>
      </nav>

      <main className={styles.main}>
        <div className={styles.addressBar}>
          <div className={styles.addressBarLeft}>
            {pageInfo && (
              <>
                <span className={styles.pageIcon}>{pageInfo.icon}</span>
                <span className={styles.pageName}>{getDisplayName()}</span>
                <span className={styles.addressSeparator}>•</span>
              </>
            )}
          </div>
          <div className={styles.addressInputWrapper}>
            <input
              type="text"
              className={styles.addressInput}
              value={addressInput}
              onChange={(e) => setAddressInput(e.target.value)}
              onKeyDown={handleAddressKeyDown}
              onFocus={() => setIsEditingAddress(true)}
              onBlur={() => {
                setIsEditingAddress(false);
                setAddressInput(getDetailedPath());
              }}
              placeholder="Enter route path..."
            />
          </div>
        </div>
        <div className={styles.mainContent}>{children}</div>
      </main>
    </div>
  );
};
