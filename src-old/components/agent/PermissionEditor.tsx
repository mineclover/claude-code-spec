import { useState } from 'react';
import type { AgentMetadata } from '../../types/agent';
import styles from './PermissionEditor.module.css';

interface PermissionEditorProps {
  permissions: AgentMetadata['permissions'];
  onPermissionsChange: (permissions: AgentMetadata['permissions']) => void;
}

export function PermissionEditor({ permissions, onPermissionsChange }: PermissionEditorProps) {
  const [newAllowPattern, setNewAllowPattern] = useState('');
  const [newDenyPattern, setNewDenyPattern] = useState('');

  const allowList = permissions?.allowList || [];
  const denyList = permissions?.denyList || [];

  const handleAddAllowPattern = () => {
    if (!newAllowPattern.trim()) return;

    const updatedPermissions = {
      ...permissions,
      allowList: [...allowList, newAllowPattern.trim()],
    };

    onPermissionsChange(updatedPermissions);
    setNewAllowPattern('');
  };

  const handleRemoveAllowPattern = (pattern: string) => {
    const updatedAllowList = allowList.filter((p) => p !== pattern);
    const updatedPermissions = {
      ...permissions,
      allowList: updatedAllowList,
    };

    onPermissionsChange(updatedPermissions);
  };

  const handleAddDenyPattern = () => {
    if (!newDenyPattern.trim()) return;

    const updatedPermissions = {
      ...permissions,
      denyList: [...denyList, newDenyPattern.trim()],
    };

    onPermissionsChange(updatedPermissions);
    setNewDenyPattern('');
  };

  const handleRemoveDenyPattern = (pattern: string) => {
    const updatedDenyList = denyList.filter((p) => p !== pattern);
    const updatedPermissions = {
      ...permissions,
      denyList: updatedDenyList,
    };

    onPermissionsChange(updatedPermissions);
  };

  return (
    <div className={styles.permissionEditor}>
      <h3>Permissions</h3>

      {/* Allow List */}
      <div className={styles.section}>
        <h4>Allow List:</h4>
        <p className={styles.description}>
          허용할 작업 패턴을 지정합니다. 예: <code>read:src/**</code>, <code>write:tests/**</code>,{' '}
          <code>bash:npm run test</code>
        </p>

        <div className={styles.patternList}>
          {allowList.length === 0 ? (
            <p className={styles.empty}>허용 패턴이 없습니다.</p>
          ) : (
            allowList.map((pattern) => (
              <div key={`allow-${pattern}`} className={styles.patternItem}>
                <code className={styles.patternText}>{pattern}</code>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveAllowPattern(pattern)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className={styles.addPattern}>
          <input
            type="text"
            className={styles.patternInput}
            placeholder="예: read:src/**"
            value={newAllowPattern}
            onChange={(e) => setNewAllowPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddAllowPattern();
              }
            }}
          />
          <button type="button" className={styles.addButton} onClick={handleAddAllowPattern}>
            + Add Pattern
          </button>
        </div>
      </div>

      {/* Deny List */}
      <div className={styles.section}>
        <h4>Deny List:</h4>
        <p className={styles.description}>
          거부할 작업 패턴을 지정합니다. 예: <code>write:src/**</code>, <code>read:.env</code>,{' '}
          <code>bash:rm:*</code>
        </p>

        <div className={styles.patternList}>
          {denyList.length === 0 ? (
            <p className={styles.empty}>거부 패턴이 없습니다.</p>
          ) : (
            denyList.map((pattern) => (
              <div key={`deny-${pattern}`} className={styles.patternItem}>
                <code className={styles.patternText}>{pattern}</code>
                <button
                  type="button"
                  className={styles.removeButton}
                  onClick={() => handleRemoveDenyPattern(pattern)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>

        <div className={styles.addPattern}>
          <input
            type="text"
            className={styles.patternInput}
            placeholder="예: write:src/**"
            value={newDenyPattern}
            onChange={(e) => setNewDenyPattern(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddDenyPattern();
              }
            }}
          />
          <button type="button" className={styles.addButton} onClick={handleAddDenyPattern}>
            + Add Pattern
          </button>
        </div>
      </div>

      {/* Permission Examples */}
      <div className={styles.examples}>
        <h4>권한 패턴 예시:</h4>
        <ul>
          <li>
            <code>read:**</code> - 모든 파일 읽기 허용
          </li>
          <li>
            <code>read:src/**</code> - src 디렉토리 내 모든 파일 읽기 허용
          </li>
          <li>
            <code>write:tests/**</code> - tests 디렉토리 내 모든 파일 쓰기 허용
          </li>
          <li>
            <code>bash:npm run test</code> - npm run test 명령 실행 허용
          </li>
          <li>
            <code>bash:npm run *</code> - npm run으로 시작하는 모든 명령 허용
          </li>
          <li>
            <code>read:.env</code> - .env 파일 읽기 거부 (deny list에 추가)
          </li>
          <li>
            <code>bash:rm:*</code> - rm 명령 실행 거부 (deny list에 추가)
          </li>
        </ul>
      </div>
    </div>
  );
}
