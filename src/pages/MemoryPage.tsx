import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { RegionEditor } from '../components/memory/RegionEditor';
import { useProject } from '../contexts/ProjectContext';
import type { ContextReference, ManagedRegion } from '../lib/MarkdownEditor';
import { MarkdownEditor } from '../lib/MarkdownEditor';
import styles from './MemoryPage.module.css';

export const MemoryPage: React.FC = () => {
  const { projectPath } = useProject();

  const [content, setContent] = useState<string>('');
  const [editor, setEditor] = useState<MarkdownEditor | null>(null);
  const [managedRegions, setManagedRegions] = useState<ManagedRegion[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [newRegionName, setNewRegionName] = useState<string>('');
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const [duplicateRefs, setDuplicateRefs] = useState<Map<string, number[]>>(new Map());
  const [invalidRefs, setInvalidRefs] = useState<ContextReference[]>([]);
  const [isReorganizeNeeded, setIsReorganizeNeeded] = useState(false);

  const claudeMdPath = projectPath ? `${projectPath}/CLAUDE.md` : null;

  // Load CLAUDE.md
  const loadClaudeMd = useCallback(async () => {
    if (!claudeMdPath || !projectPath) return;

    try {
      const mdContent = await window.fileAPI.readFile(claudeMdPath);
      setContent(mdContent);

      const md = new MarkdownEditor(mdContent);
      setEditor(md);

      const regions = md.findAllManagedRegions();
      setManagedRegions(regions);

      // Validate references
      const duplicates = md.findDuplicateReferences();
      setDuplicateRefs(duplicates);

      // Check for invalid references (file doesn't exist)
      const allRefs = md.extractContextReferences();
      const invalid: ContextReference[] = [];

      for (const ref of allRefs) {
        const filePath = MarkdownEditor.contextPathToFilePath(ref.path, projectPath);
        try {
          await window.fileAPI.readFile(filePath);
        } catch {
          invalid.push(ref);
        }
      }

      setInvalidRefs(invalid);

      // Check if reorganization is needed
      const needsReorganize = !md.areRegionsAtBottom();
      setIsReorganizeNeeded(needsReorganize);

      // Auto-expand first region
      if (regions.length > 0 && expandedRegions.size === 0) {
        setExpandedRegions(new Set([regions[0].name]));
      }
    } catch (err) {
      console.error('Failed to load CLAUDE.md:', err);
    }
  }, [claudeMdPath, projectPath, expandedRegions.size]);

  useEffect(() => {
    loadClaudeMd();
  }, [loadClaudeMd]);

  // Save CLAUDE.md
  const saveClaudeMd = useCallback(async () => {
    if (!claudeMdPath || !editor) return;

    try {
      await window.fileAPI.writeFile(claudeMdPath, editor.getContent());
      await loadClaudeMd();
    } catch (err) {
      console.error('Failed to save CLAUDE.md:', err);
    }
  }, [claudeMdPath, editor, loadClaudeMd]);

  // Create new managed region
  const handleCreateRegion = useCallback(() => {
    if (!editor || !newRegionName.trim()) return;

    const initialContent = '## Section\n\n@context/topic/file.md';

    editor.addManagedRegion(newRegionName.trim(), initialContent, 'end');
    setNewRegionName('');
    saveClaudeMd();
  }, [editor, newRegionName, saveClaudeMd]);

  // Delete region
  const handleDeleteRegion = useCallback(
    (regionName: string) => {
      if (!editor) return;
      if (!confirm(`Delete region "${regionName}"?`)) return;

      editor.deleteManagedRegion(regionName);
      if (selectedRegion === regionName) setSelectedRegion('');
      saveClaudeMd();
    },
    [editor, selectedRegion, saveClaudeMd],
  );

  // Toggle region expansion
  const toggleRegion = useCallback((regionName: string) => {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionName)) {
        next.delete(regionName);
      } else {
        next.add(regionName);
      }
      return next;
    });
  }, []);

  // Reorganize managed regions to bottom
  const handleReorganize = useCallback(() => {
    if (!editor) return;
    if (!confirm('Memory 관리 영역을 문서 하단으로 재배치하시겠습니까?')) return;

    editor.reorganizeManagedRegions();
    saveClaudeMd();
  }, [editor, saveClaudeMd]);

  // Auto-fix: remove duplicates, invalid refs, and reorganize
  const handleAutoFix = useCallback(async () => {
    if (!editor || !projectPath) return;
    if (
      !confirm('중복 참조 제거, 유효하지 않은 참조 제거, 영역 재배치를 자동으로 수행하시겠습니까?')
    )
      return;

    await editor.autoFix(projectPath);
    saveClaudeMd();
  }, [editor, projectPath, saveClaudeMd]);

  if (!projectPath) {
    return (
      <div className={styles.container}>
        <div className={styles.noProject}>프로젝트를 먼저 선택해주세요.</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1>CLAUDE.md Memory Editor</h1>
          <p className={styles.path}>{claudeMdPath}</p>
        </div>
        <div className={styles.headerActions}>
          {isReorganizeNeeded && (
            <button
              type="button"
              onClick={handleReorganize}
              className={styles.buttonWarning}
              title="Memory 영역을 문서 하단으로 재배치"
            >
              🔄 Reorganize
            </button>
          )}
          {(duplicateRefs.size > 0 || invalidRefs.length > 0 || isReorganizeNeeded) && (
            <button
              type="button"
              onClick={handleAutoFix}
              className={styles.buttonWarning}
              title="중복/유효하지 않은 참조 제거 및 영역 재배치"
            >
              ✨ Auto Fix
            </button>
          )}
          <button type="button" onClick={loadClaudeMd} className={styles.buttonSecondary}>
            Reload
          </button>
        </div>
      </div>

      {/* Reorganization Notice */}
      {isReorganizeNeeded && (
        <div className={styles.reorganizeNotice}>
          <div className={styles.noticeHeader}>
            <span className={styles.noticeIcon}>ℹ️</span>
            <h3>Memory 영역 재배치 권장</h3>
          </div>
          <p>
            Memory 관리 영역이 일반 컨텍스트와 섞여있습니다.
            <strong> Reorganize</strong> 버튼을 클릭하여 Memory 영역을 문서 하단으로 이동하면
            컨텍스트 구조가 더 명확해집니다.
          </p>
          <button type="button" onClick={handleReorganize} className={styles.button}>
            지금 재배치하기
          </button>
        </div>
      )}

      {/* Create New Region */}
      <div className={styles.createRegion}>
        <h2>Create Managed Region</h2>
        <div className={styles.createRegionForm}>
          <input
            type="text"
            placeholder="Region name (e.g., references, tools)"
            value={newRegionName}
            onChange={(e) => setNewRegionName(e.target.value)}
            className={styles.input}
          />
          <button type="button" onClick={handleCreateRegion} className={styles.button}>
            Create
          </button>
        </div>
      </div>

      {/* Validation Warnings */}
      {(duplicateRefs.size > 0 || invalidRefs.length > 0) && (
        <div className={styles.validationWarnings}>
          <h2>⚠️ Reference Issues</h2>

          {duplicateRefs.size > 0 && (
            <div className={styles.warningSection}>
              <h3>🔄 Duplicate References ({duplicateRefs.size})</h3>
              <div className={styles.warningList}>
                {Array.from(duplicateRefs.entries()).map(([path, lines]) => (
                  <div key={path} className={styles.warningItem}>
                    <code className={styles.refPath}>{path}</code>
                    <span className={styles.refLocations}>
                      Lines: {lines.map((l) => l + 1).join(', ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {invalidRefs.length > 0 && (
            <div className={styles.warningSection}>
              <h3>❌ Invalid References ({invalidRefs.length})</h3>
              <div className={styles.warningList}>
                {invalidRefs.map((ref, idx) => (
                  <div key={`invalid-${ref.path}-${idx}`} className={styles.warningItem}>
                    <code className={styles.refPath}>{ref.path}</code>
                    <span className={styles.refLocations}>Line: {ref.line + 1}</span>
                  </div>
                ))}
              </div>
              <p className={styles.hint}>
                These files do not exist in <code>docs/claude-context/</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Managed Regions */}
      <div className={styles.regionsContainer}>
        <h2>Managed Regions ({managedRegions.length})</h2>

        {managedRegions.length === 0 ? (
          <div className={styles.noRegions}>
            <p>No managed regions found in CLAUDE.md</p>
            <p className={styles.hint}>
              Managed regions are marked with:
              <br />
              <code>&lt;!-- MEMORY_START: region-name --&gt;</code>
              <br />
              <code>&lt;!-- MEMORY_END: region-name --&gt;</code>
            </p>
          </div>
        ) : (
          <div className={styles.regionsList}>
            {managedRegions.map((region) => (
              <RegionEditor
                key={region.name}
                region={region}
                editor={editor}
                isExpanded={expandedRegions.has(region.name)}
                onToggle={() => toggleRegion(region.name)}
                onDelete={() => handleDeleteRegion(region.name)}
                onSave={saveClaudeMd}
              />
            ))}
          </div>
        )}
      </div>

      {/* Full Preview */}
      <div className={styles.previewSection}>
        <h2>Full Document Preview</h2>
        <pre className={styles.preview}>{content}</pre>
      </div>
    </div>
  );
};
