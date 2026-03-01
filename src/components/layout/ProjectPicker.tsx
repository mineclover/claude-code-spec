/**
 * ProjectPicker - sidebar overlay for selecting the active project
 */

import { useProject } from '../../contexts/ProjectContext';
import type { ProjectFolder } from '../../types/api/sessions';
import styles from './ProjectPicker.module.css';

interface ProjectPickerProps {
  onClose: () => void;
}

function projectDisplayName(p: ProjectFolder): string {
  if (p.projectPath === '/') return 'root';
  return p.projectPath.split('/').filter(Boolean).pop() || p.projectDirName;
}

export function ProjectPicker({ onClose }: ProjectPickerProps) {
  const { projectPath, projectFolders, isLoadingFolders, updateProject, refreshProjectFolders } =
    useProject();

  const handleSelect = async (p: ProjectFolder) => {
    await updateProject(p.projectPath, p.projectDirName);
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.title}>Select Project</span>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.refreshButton}
              onClick={refreshProjectFolders}
              disabled={isLoadingFolders}
            >
              ↺
            </button>
            <button type="button" className={styles.closeButton} onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className={styles.list}>
          {isLoadingFolders ? (
            <div className={styles.empty}>Loading...</div>
          ) : projectFolders.length === 0 ? (
            <div className={styles.empty}>No session projects found</div>
          ) : (
            projectFolders.map((p) => (
              <button
                key={p.projectPath}
                type="button"
                className={`${styles.item} ${projectPath === p.projectPath ? styles.itemActive : ''}`}
                onClick={() => handleSelect(p)}
              >
                <div className={styles.itemName}>{projectDisplayName(p)}</div>
                <div className={styles.itemPath}>{p.projectPath}</div>
                {p.sessionCount != null && (
                  <div className={styles.itemMeta}>{p.sessionCount} sessions</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
