import { beforeEach, describe, expect, it } from 'vitest';
import type {
  AllRegionsJSON,
  CodeBlockItem,
  DirectRefItem,
  HeadingItem,
  IndirectRefItem,
  RegionJSON,
  TextItem,
} from './MarkdownEditor';
import { MarkdownEditor } from './MarkdownEditor';

describe('MarkdownEditor - Managed Regions', () => {
  let editor: MarkdownEditor;

  beforeEach(() => {
    const content = `# Test Document

Some content here.

<!-- MEMORY_START: test-region -->
## Section 1

@context/file1.md
@context/file2.md

\`\`\`bash
npm run dev
\`\`\`

\`@context/optional.md\`
- Optional reference
- 필요 시 참조하세요
<!-- MEMORY_END: test-region -->

More content.
`;
    editor = new MarkdownEditor(content);
  });

  describe('parseRegionItems', () => {
    it('should parse all item types correctly', () => {
      const items = editor.parseRegionItems('test-region');

      expect(items).toHaveLength(5);
      expect(items[0].type).toBe('heading');
      expect(items[1].type).toBe('direct-ref');
      expect(items[2].type).toBe('direct-ref');
      expect(items[3].type).toBe('code-block');
      expect(items[4].type).toBe('indirect-ref');
    });

    it('should generate stable IDs based on content', () => {
      const items1 = editor.parseRegionItems('test-region');
      const items2 = editor.parseRegionItems('test-region');

      // Same content = same IDs
      items1.forEach((item, i) => {
        expect(item.id).toBe(items2[i].id);
      });
    });

    it('should use cache for repeated calls', () => {
      const items1 = editor.parseRegionItems('test-region');
      const items2 = editor.parseRegionItems('test-region');

      // Should return same array reference (from cache)
      expect(items1).toBe(items2);
    });
  });

  describe('ID stability', () => {
    it('should maintain ID after content insertion before', () => {
      const items = editor.parseRegionItems('test-region');
      const originalItem = items[1]; // second direct-ref
      const originalId = originalItem.id;

      // Add item at start
      editor.addRegionItem(
        'test-region',
        {
          type: 'direct-ref',
          path: '@context/new.md',
          raw: '@context/new.md',
        } as DirectRefItem,
        'start',
      );

      // Find same item by ID (content-based)
      const newItems = editor.parseRegionItems('test-region');
      const sameItem = newItems.find(
        (i) =>
          i.type === 'direct-ref' &&
          (i as DirectRefItem).path === (originalItem as DirectRefItem).path,
      );

      expect(sameItem).toBeDefined();
      expect(sameItem?.id).toBe(originalId);
    });
  });

  describe('Multi-line item handling', () => {
    it('should correctly update code block (multi-line item)', () => {
      const items = editor.parseRegionItems('test-region');
      const codeBlock = items.find((i) => i.type === 'code-block') as CodeBlockItem;

      editor.updateRegionItem('test-region', codeBlock.id, {
        content: 'npm run build',
      } as Partial<CodeBlockItem>);

      const updated = editor.parseRegionItems('test-region');
      const updatedBlock = updated.find((i) => i.type === 'code-block') as CodeBlockItem;

      expect(updatedBlock.content).toBe('npm run build');

      // Old content should not remain
      const content = editor.getContent();
      expect(content).not.toContain('npm run dev');
    });

    it('should correctly delete code block (multi-line item)', () => {
      const items = editor.parseRegionItems('test-region');
      const codeBlock = items.find((i) => i.type === 'code-block') as CodeBlockItem;

      editor.deleteRegionItem('test-region', codeBlock.id);

      const updated = editor.parseRegionItems('test-region');
      expect(updated.find((i) => i.type === 'code-block')).toBeUndefined();

      // All lines of code block should be removed
      const content = editor.getContent();
      expect(content).not.toContain('```bash');
      expect(content).not.toContain('npm run dev');
    });

    it('should parse multi-line indirect reference', () => {
      const items = editor.parseRegionItems('test-region');
      const indirectRef = items.find((i) => i.type === 'indirect-ref') as IndirectRefItem;

      expect(indirectRef).toBeDefined();
      expect(indirectRef.path).toBe('@context/optional.md');
      expect(indirectRef.description).toBe('Optional reference\n필요 시 참조하세요');
      expect(indirectRef.line).toBeDefined();
      expect(indirectRef.endLine).toBeGreaterThan(indirectRef.line);
    });

    it('should correctly update multi-line indirect reference', () => {
      const items = editor.parseRegionItems('test-region');
      const indirectRef = items.find((i) => i.type === 'indirect-ref') as IndirectRefItem;

      editor.updateRegionItem('test-region', indirectRef.id, {
        description: '새로운 설명\n두 번째 줄\n세 번째 줄',
      } as Partial<IndirectRefItem>);

      const updated = editor.parseRegionItems('test-region');
      const updatedRef = updated.find((i) => i.type === 'indirect-ref') as IndirectRefItem;

      expect(updatedRef.description).toBe('새로운 설명\n두 번째 줄\n세 번째 줄');

      // Old description should not remain
      const content = editor.getContent();
      expect(content).not.toContain('Optional reference');
      expect(content).toContain('새로운 설명');
    });

    it('should parse indirect reference with empty lines between path and description', () => {
      const contentWithEmptyLines = `<!-- MEMORY_START: test-empty -->
\`@context/file.md\`

- 설명 첫 줄
- 설명 둘째 줄
<!-- MEMORY_END: test-empty -->`;

      const testEditor = new MarkdownEditor(contentWithEmptyLines);
      const items = testEditor.parseRegionItems('test-empty');
      const indirectRef = items.find((i) => i.type === 'indirect-ref') as IndirectRefItem;

      expect(indirectRef).toBeDefined();
      expect(indirectRef.path).toBe('@context/file.md');
      expect(indirectRef.description).toBe('설명 첫 줄\n설명 둘째 줄');
    });
  });

  describe('Auto Fix', () => {
    it('should remove duplicate references', () => {
      const duplicateContent = `<!-- MEMORY_START: test -->
@context/file.md
@context/file.md
@context/other.md
<!-- MEMORY_END: test -->`;

      const dupEditor = new MarkdownEditor(duplicateContent);
      dupEditor.removeDuplicateReferences();

      const items = dupEditor.parseRegionItems('test');
      const refs = items.filter((i) => i.type === 'direct-ref');

      expect(refs).toHaveLength(2); // Only unique refs remain
      expect((refs[0] as DirectRefItem).path).toBe('@context/file.md');
      expect((refs[1] as DirectRefItem).path).toBe('@context/other.md');
    });
  });

  describe('Performance (Memoization)', () => {
    it('should use cache and avoid re-parsing', () => {
      const items1 = editor.parseRegionItems('test-region');
      const items2 = editor.parseRegionItems('test-region');

      // Same reference = cached
      expect(items1).toBe(items2);
    });

    it('should invalidate cache after modification', () => {
      const items1 = editor.parseRegionItems('test-region');

      editor.addRegionItem('test-region', {
        type: 'text',
        content: 'New text',
        raw: 'New text',
      } as TextItem);

      const items2 = editor.parseRegionItems('test-region');

      // Different reference = cache invalidated
      expect(items1).not.toBe(items2);
      expect(items2.length).toBe(items1.length + 1);
    });
  });

  describe('JSON Data Handling', () => {
    it('should export region to JSON format', () => {
      const json: RegionJSON = editor.regionToJSON('test-region');

      expect(json.name).toBe('test-region');
      expect(json.items).toBeInstanceOf(Array);
      expect(json.items.length).toBeGreaterThan(0);

      // Check item structure
      const firstItem = json.items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('type');
      expect(firstItem).toHaveProperty('line');
    });

    it('should update region from JSON data', () => {
      const _originalJSON: RegionJSON = editor.regionToJSON('test-region');

      // Modify JSON: remove all items and add new ones
      const newJSON = {
        items: [
          { type: 'heading', level: 2, text: 'New Section' } as HeadingItem,
          { type: 'direct-ref', path: '@context/new.md' } as DirectRefItem,
          { type: 'code-block', language: 'bash', content: 'echo "test"' } as CodeBlockItem,
        ],
      };

      editor.updateRegionFromJSON('test-region', newJSON);

      const updatedItems = editor.parseRegionItems('test-region');
      expect(updatedItems).toHaveLength(3);
      expect(updatedItems[0].type).toBe('heading');
      expect(updatedItems[1].type).toBe('direct-ref');
      expect(updatedItems[2].type).toBe('code-block');
    });

    it('should export all regions as JSON', () => {
      const allJSON: AllRegionsJSON = editor.exportAllRegionsJSON();

      expect(allJSON).toHaveProperty('regions');
      expect(allJSON.regions).toBeInstanceOf(Array);
      expect(allJSON.regions.length).toBeGreaterThan(0);

      const firstRegion = allJSON.regions[0];
      expect(firstRegion).toHaveProperty('name');
      expect(firstRegion).toHaveProperty('items');
    });

    it('should reorder items via JSON', () => {
      const json: RegionJSON = editor.regionToJSON('test-region');
      const items = json.items;

      // Reverse order
      const reorderedJSON = {
        items: items.reverse(),
      };

      editor.updateRegionFromJSON('test-region', reorderedJSON);

      const newItems = editor.parseRegionItems('test-region');
      expect(newItems[0].type).toBe(items[0].type);
      expect(newItems[newItems.length - 1].type).toBe(items[items.length - 1].type);
    });

    it('should handle JSON with partial item data', () => {
      const partialJSON = {
        items: [
          { type: 'heading', level: 3, text: 'Partial Section' } as HeadingItem,
          { type: 'text', content: 'Some text' } as TextItem,
        ],
      };

      editor.updateRegionFromJSON('test-region', partialJSON);

      const items = editor.parseRegionItems('test-region');
      expect(items).toHaveLength(2);
    });
  });
});
