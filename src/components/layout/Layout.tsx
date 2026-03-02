/**
 * Layout with tool selector + grouped sidebar navigation + project picker
 */

import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { type ToolId, useToolContext } from '../../contexts/ToolContext';
import { ProjectPicker } from './ProjectPicker';
import styles from './Layout.module.css';

interface LayoutProps {
  children: ReactNode;
}

interface NavItem {
  path: string;
  label: string;
  icon: string;
  end?: boolean;
  sub?: boolean;
}

interface NavGroup {
  label?: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    items: [
      { path: '/', label: 'Execute', icon: '▶', end: true },
      { path: '/sessions', label: 'Sessions', icon: '#' },
      { path: '/mcp-configs', label: 'MCP Configs', icon: '@' },
    ],
  },
  {
    label: 'Management',
    items: [
      { path: '/skills', label: 'Skills', icon: '%' },
      { path: '/cli-maintenance', label: 'CLI Maintenance', icon: '⚒' },
      { path: '/moai-statusline', label: 'Status Bar', icon: 'M' },
    ],
  },
  {
    label: 'Providers',
    items: [
      { path: '/hooks', label: 'Active Hooks', icon: 'H' },
      { path: '/references', label: 'Providers', icon: 'P', end: true },
      { path: '/references/hooks', label: 'Ref Hooks', icon: '~', sub: true },
      { path: '/references/output-styles', label: 'Output Styles', icon: 'O', sub: true },
      { path: '/references/skills', label: 'Skills', icon: 'S', sub: true },
    ],
  },
  {
    items: [{ path: '/settings', label: 'Settings', icon: '⚙' }],
  },
];

const toolOptions: Array<{ id: ToolId; label: string }> = [
  { id: 'claude', label: 'Claude' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
];

export function Layout({ children }: LayoutProps) {
  const { projectPath, projectDirName } = useProject();
  const { selectedToolId, setSelectedToolId } = useToolContext();
  const [showProjectPicker, setShowProjectPicker] = useState(false);

  const projectLabel =
    projectPath
      ? (projectPath === '/' ? 'root' : projectPath.split('/').filter(Boolean).pop()) || projectDirName
      : null;

  return (
    <div className={styles.layout}>
      <nav className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoText}>CLI Cockpit</span>
          <span className={styles.logoVersion}>Next</span>
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

        <button
          type="button"
          className={styles.projectSelector}
          onClick={() => setShowProjectPicker(true)}
          title={projectPath ?? 'Select a project'}
        >
          <span className={styles.projectSelectorLabel}>Project</span>
          <span className={styles.projectSelectorValue}>
            {projectLabel ?? 'Select project...'}
          </span>
        </button>

        <div className={styles.nav}>
          {navGroups.map((group, gi) => (
            <div key={String(gi)} className={styles.navGroup}>
              {group.label && <span className={styles.navGroupLabel}>{group.label}</span>}
              {group.items.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `${styles.navItem} ${item.sub ? styles.navSub : ''} ${isActive ? styles.active : ''}`
                  }
                  end={item.end === true}
                >
                  <span className={styles.navIcon}>{item.icon}</span>
                  <span className={styles.navLabel}>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </div>
      </nav>

      <main className={styles.content}>{children}</main>

      {showProjectPicker && <ProjectPicker onClose={() => setShowProjectPicker(false)} />}
    </div>
  );
}
