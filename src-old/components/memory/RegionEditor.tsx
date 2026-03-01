import type React from 'react';
import { useEffect, useId, useState } from 'react';
import type {
  CodeBlockItem,
  DirectRefItem,
  HeadingItem,
  IndirectRefItem,
  ManagedRegion,
  MarkdownEditor,
  RegionItem,
  TextItem,
} from '../../lib/MarkdownEditor';
import styles from './RegionEditor.module.css';

interface RegionEditorProps {
  region: ManagedRegion;
  editor: MarkdownEditor | null;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onSave: () => void;
}

export const RegionEditor: React.FC<RegionEditorProps> = ({
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
  const rawContentTextareaId = useId();

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
          text: 'New Section',
        } as HeadingItem;
        break;
      case 'direct-ref':
        newItem = {
          type: 'direct-ref',
          raw: `@context/new/file.md`,
          path: '@context/new/file.md',
        } as DirectRefItem;
        break;
      case 'indirect-ref':
        newItem = {
          type: 'indirect-ref',
          raw: `@context/new/file.md\n설명을 입력하세요\n추가 설명이 필요하면 여기에 작성`,
          path: '@context/new/file.md',
          description: '설명을 입력하세요\n추가 설명이 필요하면 여기에 작성',
        } as IndirectRefItem;
        break;
      case 'code-block':
        newItem = {
          type: 'code-block',
          raw: '```bash\n# 명령어\n```',
          language: 'bash',
          content: '# 명령어',
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
      <button type="button" className={styles.regionHeader} onClick={onToggle}>
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
                <button
                  type="button"
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className={styles.buttonSmall}
                >
                  ➕ Add Item
                </button>
              </div>
            </div>

            {showAddMenu && (
              <div className={styles.addMenu}>
                <button
                  type="button"
                  onClick={() => handleAddItem('heading')}
                  className={styles.menuItem}
                >
                  📌 Heading
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('direct-ref')}
                  className={styles.menuItem}
                >
                  🔗 Direct Reference
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('indirect-ref')}
                  className={styles.menuItem}
                >
                  💡 Indirect Reference
                </button>
                <button
                  type="button"
                  onClick={() => handleAddItem('code-block')}
                  className={styles.menuItem}
                >
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
            <label htmlFor={rawContentTextareaId}>Raw Content:</label>
            <textarea
              id={rawContentTextareaId}
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
