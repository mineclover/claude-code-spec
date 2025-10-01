import type React from 'react';
import { Link, useLocation } from 'react-router-dom';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className={styles.container}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <h2>Claude CLI</h2>
          <span className={styles.subtitle}>Control & Analytics</span>
        </div>

        <div className={styles.nav}>
          <Link to="/" className={`${styles.navItem} ${isActive('/') ? styles.active : ''}`}>
            <span className={styles.icon}>▶️</span>
            <span>Execute</span>
          </Link>

          <Link
            to="/sessions"
            className={`${styles.navItem} ${isActive('/sessions') ? styles.active : ''}`}
          >
            <span className={styles.icon}>📋</span>
            <span>Sessions</span>
          </Link>

          <Link
            to="/claude-projects"
            className={`${styles.navItem} ${isActive('/claude-projects') ? styles.active : ''}`}
          >
            <span className={styles.icon}>📁</span>
            <span>Claude Projects</span>
          </Link>

          <Link
            to="/bookmarks"
            className={`${styles.navItem} ${isActive('/bookmarks') ? styles.active : ''}`}
          >
            <span className={styles.icon}>⭐</span>
            <span>Bookmarks</span>
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
          <div className={styles.version}>v1.0.0</div>
        </div>
      </nav>

      <main className={styles.main}>{children}</main>
    </div>
  );
};
