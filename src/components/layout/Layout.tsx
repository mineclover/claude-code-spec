/**
 * Layout with tool selector + sidebar navigation
 */

import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { type ToolId, useToolContext } from '../../contexts/ToolContext';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

const navItems = [
  { path: '/', label: 'Execute', icon: '>', end: true },
  { path: '/sessions', label: 'Sessions', icon: '#' },
  { path: '/mcp-configs', label: 'MCP Configs', icon: '@' },
  { path: '/skills', label: 'Skills', icon: '%' },
  { path: '/references', label: 'References', icon: 'R', end: true },
  { path: '/references/hooks', label: 'Ref Hooks', icon: 'H' },
  { path: '/references/output-styles', label: 'Ref Styles', icon: 'O' },
  { path: '/references/skills', label: 'Ref Skills', icon: 'S' },
  { path: '/settings', label: 'Settings', icon: '*' },
];

const toolOptions: Array<{ id: ToolId; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
];

export function Layout({ children }: LayoutProps) {
  const { projectPath } = useProject();
  const { selectedToolId, setSelectedToolId } = useToolContext();

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoText}>CLI Platform</span>
        </div>
        <div className={styles.toolSelector}>
          {toolOptions.map((tool) => (
            <button
              key={tool.id}
              type="button"
              className={`${styles.toolButton} ${selectedToolId === tool.id ? styles.toolActive : ''}`}
              onClick={() => setSelectedToolId(tool.id)}
            >
              {tool.label}
            </button>
          ))}
        </div>
        <div className={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => `${styles.navItem} ${isActive ? styles.active : ''}`}
              end={item.end === true}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navLabel}>{item.label}</span>
            </NavLink>
          ))}
        </div>
        {projectPath && (
          <div className={styles.projectInfo}>
            <span className={styles.projectLabel}>Project</span>
            <span className={styles.projectPath} title={projectPath}>
              {projectPath.split('/').filter(Boolean).pop()}
            </span>
          </div>
        )}
      </nav>
      <main className={styles.content}>{children}</main>
    </div>
  );
}
