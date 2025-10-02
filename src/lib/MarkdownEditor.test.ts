import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownEditor } from './MarkdownEditor';
import type { RegionItem, HeadingItem, DirectRefItem, IndirectRefItem, CodeBlockItem } from './MarkdownEditor';

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

\`@context/optional.md\` - Optional reference
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
      editor.addRegionItem('test-region', {
        type: 'direct-ref',
        path: '@context/new.md',
        raw: '@context/new.md'
      }, 'start');

      // Find same item by ID (content-based)
      const newItems = editor.parseRegionItems('test-region');
      const sameItem = newItems.find(i =>
        i.type === 'direct-ref' &&
        (i as DirectRefItem).path === originalItem.path
      );

      expect(sameItem).toBeDefined();
      expect(sameItem!.id).toBe(originalId);
    });
  });

  describe('Multi-line item handling', () => {
    it('should correctly update code block (multi-line item)', () => {
      const items = editor.parseRegionItems('test-region');
      const codeBlock = items.find(i => i.type === 'code-block') as CodeBlockItem;

      editor.updateRegionItem('test-region', codeBlock.id, {
        content: 'npm run build'
      });

      const updated = editor.parseRegionItems('test-region');
      const updatedBlock = updated.find(i => i.type === 'code-block') as CodeBlockItem;

      expect(updatedBlock.content).toBe('npm run build');

      // Old content should not remain
      const content = editor.getContent();
      expect(content).not.toContain('npm run dev');
    });

    it('should correctly delete code block (multi-line item)', () => {
      const items = editor.parseRegionItems('test-region');
      const codeBlock = items.find(i => i.type === 'code-block') as CodeBlockItem;

      editor.deleteRegionItem('test-region', codeBlock.id);

      const updated = editor.parseRegionItems('test-region');
      expect(updated.find(i => i.type === 'code-block')).toBeUndefined();

      // All lines of code block should be removed
      const content = editor.getContent();
      expect(content).not.toContain('```bash');
      expect(content).not.toContain('npm run dev');
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
      const refs = items.filter(i => i.type === 'direct-ref');

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
        raw: 'New text'
      });

      const items2 = editor.parseRegionItems('test-region');

      // Different reference = cache invalidated
      expect(items1).not.toBe(items2);
      expect(items2.length).toBe(items1.length + 1);
    });
  });
});
