import type React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import { useProject } from '../contexts/ProjectContext';
import type {
  CodeBlockItem,
  DirectRefItem,
  HeadingItem,
  IndirectRefItem,
  ManagedRegion,
  RegionItem,
  TextItem,
  ContextReference,
} from '../lib/MarkdownEditor';
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

// Region Editor Component
interface RegionEditorProps {
  region: ManagedRegion;
  editor: MarkdownEditor | null;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: () => void;
}

const RegionEditor: React.FC<RegionEditorProps> = ({
  region,
  editor,
  isExpanded,
  onToggle,
  onDelete,
  onSave,
}) => {
  const [editContent, setEditContent] = useState(region.content);
  const [items, setItems] = useState<RegionItem[]>([]);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showJSONView, setShowJSONView] = useState(false);
  const [jsonData, setJsonData] = useState<string>('');

  useEffect(() => {
    setEditContent(region.content);
    if (editor) {
      const regionItems = editor.parseRegionItems(region.name);
      setItems(regionItems);

      // Update JSON data
      const json = editor.regionToJSON(region.name);
      setJsonData(JSON.stringify(json, null, 2));
    }
  }, [region, editor]);

  const handleSave = () => {
    if (!editor) return;
    editor.updateManagedRegionContent(region.name, editContent);
    onSave();
  };

  const handleDeleteItem = (itemId: string) => {
    if (!editor) return;
    if (!confirm('이 항목을 삭제하시겠습니까?')) return;

    editor.deleteRegionItem(region.name, itemId);
    onSave();
  };

  const handleAddItem = (type: 'heading' | 'direct-ref' | 'indirect-ref' | 'code-block') => {
    if (!editor) return;

    let newItem: Omit<RegionItem, 'id' | 'line' | 'endLine'>;

    switch (type) {
      case 'heading':
        newItem = {
          type: 'heading',
          raw: `## New Section`,
          level: 2,
          text: 'New Section'
        } as HeadingItem;
        break;
      case 'direct-ref':
        newItem = {
          type: 'direct-ref',
          raw: `@context/new/file.md`,
          path: '@context/new/file.md'
        } as DirectRefItem;
        break;
      case 'indirect-ref':
        newItem = {
          type: 'indirect-ref',
          raw: `@context/new/file.md\n설명을 입력하세요\n추가 설명이 필요하면 여기에 작성`,
          path: '@context/new/file.md',
          description: '설명을 입력하세요\n추가 설명이 필요하면 여기에 작성'
        } as IndirectRefItem;
        break;
      case 'code-block':
        newItem = {
          type: 'code-block',
          raw: '```bash\n# 명령어\n```',
          language: 'bash',
          content: '# 명령어'
        } as CodeBlockItem;
        break;
    }

    editor.addRegionItem(region.name, newItem, 'end');
    setShowAddMenu(false);
    onSave();
  };

  const handleMoveItem = (itemId: string, direction: 'up' | 'down') => {
    if (!editor) return;

    const currentIndex = items.findIndex((item) => item.id === itemId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    // Create new items array with swapped positions
    const newItems = [...items];
    [newItems[currentIndex], newItems[newIndex]] = [newItems[newIndex], newItems[currentIndex]];

    // Update region from JSON
    editor.updateRegionFromJSON(region.name, { items: newItems });
    onSave();
  };

  const handleSaveJSON = () => {
    if (!editor) return;

    try {
      const parsedJSON = JSON.parse(jsonData);
      editor.updateRegionFromJSON(region.name, parsedJSON);
      setShowJSONView(false);
      onSave();
    } catch (err) {
      alert(`Invalid JSON: ${(err as Error).message}`);
    }
  };

  const handleExportJSON = () => {
    if (!editor) return;

    const json = editor.regionToJSON(region.name);
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${region.name}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getItemIcon = (type: string) => {
    switch (type) {
      case 'heading':
        return '📌';
      case 'direct-ref':
        return '🔗';
      case 'indirect-ref':
        return '💡';
      case 'code-block':
        return '💻';
      default:
        return '📝';
    }
  };

  return (
    <div className={styles.regionCard}>
      <button 
        type="button"
        className={styles.regionHeader} 
        onClick={onToggle}
      >
        <div className={styles.regionHeaderLeft}>
          <span className={styles.regionIcon}>📋</span>
          <span className={styles.regionName}>{region.name}</span>
          <span className={styles.regionLines}>
            Lines {region.startLine + 1}-{region.endLine + 1}
          </span>
        </div>
        <div className={styles.regionHeaderRight}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className={styles.buttonDanger}
          >
            Delete
          </button>
          <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
        </div>
      </button>

      {isExpanded && (
        <div className={styles.regionContent}>
          {/* Structured Items View */}
          <div className={styles.itemsList}>
            <div className={styles.itemsHeader}>
              <h4>Region Items ({items.length})</h4>
              <div>
                <button
                  type="button"
                  onClick={() => setShowJSONView(!showJSONView)}
                  className={styles.buttonSmall}
                >
                  {showJSONView ? '📝 List View' : '{ } JSON View'}
                </button>
                <button type="button" onClick={handleExportJSON} className={styles.buttonSmall}>
                  💾 Export JSON
                </button>
                <button type="button" onClick={() => setShowAddMenu(!showAddMenu)} className={styles.buttonSmall}>
                  ➕ Add Item
                </button>
              </div>
            </div>

            {showAddMenu && (
              <div className={styles.addMenu}>
                <button type="button" onClick={() => handleAddItem('heading')} className={styles.menuItem}>
                  📌 Heading
                </button>
                <button type="button" onClick={() => handleAddItem('direct-ref')} className={styles.menuItem}>
                  🔗 Direct Reference
                </button>
                <button type="button" onClick={() => handleAddItem('indirect-ref')} className={styles.menuItem}>
                  💡 Indirect Reference
                </button>
                <button type="button" onClick={() => handleAddItem('code-block')} className={styles.menuItem}>
                  💻 Code Block
                </button>
              </div>
            )}

            {!showJSONView &&
              items.map((item, idx) => (
                <div key={item.id} className={styles.itemCard}>
                  <div className={styles.itemHeader}>
                    <div className={styles.itemInfo}>
                      <span className={styles.itemIcon}>{getItemIcon(item.type)}</span>
                      <span className={styles.itemType}>{item.type}</span>
                      <span className={styles.itemLine}>Line {item.line + 1}</span>
                    </div>
                    <div className={styles.itemActions}>
                      <button
                        type="button"
                        onClick={() => handleMoveItem(item.id, 'up')}
                        disabled={idx === 0}
                        className={styles.buttonSmall}
                        title="Move up"
                      >
                        ⬆️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveItem(item.id, 'down')}
                        disabled={idx === items.length - 1}
                        className={styles.buttonSmall}
                        title="Move down"
                      >
                        ⬇️
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className={styles.buttonDangerSmall}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className={styles.itemContent}>
                    {item.type === 'heading' && (
                      <h4 className={styles.headingText}>{(item as HeadingItem).text}</h4>
                    )}
                    {item.type === 'direct-ref' && (
                      <div className={styles.refItem}>
                        <code>{(item as DirectRefItem).path}</code>
                      </div>
                    )}
                    {item.type === 'indirect-ref' && (
                      <div className={styles.indirectRefItem}>
                        <code className={styles.refPath}>{(item as IndirectRefItem).path}</code>
                        <div className={styles.refDescList}>
                          {(item as IndirectRefItem).description.split('\n').map((line, idx) => (
                            <div key={`desc-${item.id}-${idx}`} className={styles.refDescLine}>
                              • {line}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {item.type === 'code-block' && (
                      <div className={styles.codeItem}>
                        <div className={styles.codeLang}>{(item as CodeBlockItem).language}</div>
                        <pre className={styles.codeContent}>{(item as CodeBlockItem).content}</pre>
                      </div>
                    )}
                    {item.type === 'text' && (
                      <div className={styles.textItem}>{(item as TextItem).content}</div>
                    )}
                  </div>
                </div>
              ))}

            {showJSONView && (
              <div className={styles.jsonEditor}>
                <div className={styles.jsonEditorHeader}>
                  <h4>JSON Data Editor</h4>
                  <button type="button" onClick={handleSaveJSON} className={styles.button}>
                    💾 Save JSON
                  </button>
                </div>
                <textarea
                  value={jsonData}
                  onChange={(e) => setJsonData(e.target.value)}
                  className={styles.textarea}
                  rows={20}
                  style={{ fontFamily: 'monospace', fontSize: '12px' }}
                />
                <p className={styles.hint}>
                  Edit items array to add, remove, or reorder items. Changes will be applied to
                  markdown when saved.
                </p>
              </div>
            )}
          </div>

          {/* Raw Content Editor */}
          <div className={styles.rawEditor}>
            <label>Raw Content:</label>
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className={styles.textarea}
              rows={10}
            />
            <button type="button" onClick={handleSave} className={styles.button}>
              Save Changes
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
