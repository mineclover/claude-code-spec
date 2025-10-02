/**
 * MarkdownEditor - Pattern-based markdown manipulation utility
 *
 * Supports managed regions with markdown comments:
 * <!-- MEMORY_START: region-name -->
 * content...
 * <!-- MEMORY_END: region-name -->
 *
 * Region types:
 * 1. Heading2 + Bullet pattern (direct reference)
 * 2. Code block pattern (indirect reference)
 */

export interface MarkdownSection {
  heading: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface BulletItem {
  text: string;
  level: number; // 0 for -, 1 for nested bullets
  line: number;
}

export interface CodeBlockReference {
  language: string;
  content: string;
  startLine: number;
  endLine: number;
}

export interface ManagedRegion {
  name: string;
  type: 'section' | 'code' | 'mixed';
  content: string;
  startLine: number; // Line with <!-- MEMORY_START -->
  endLine: number;   // Line with <!-- MEMORY_END -->
  contentStartLine: number; // First line after START comment
  contentEndLine: number;   // Last line before END comment
}

export interface ContextReference {
  path: string;
  line: number;
  regionName?: string;
}

// Region 내 개별 항목 타입
export type RegionItemType = 
  | 'heading'      // ## 제목
  | 'direct-ref'   // @context/path (직접 참조, 로드됨)
  | 'indirect-ref' // `@context/path` - 설명 (간접 참조, 로드 안됨)
  | 'code-block'   // ```language ... ```
  | 'text';        // 일반 텍스트

export interface RegionItem {
  id: string;           // 고유 ID (line number 기반)
  type: RegionItemType;
  line: number;         // 시작 라인
  endLine: number;      // 종료 라인
  raw: string;          // 원본 텍스트
}

export interface HeadingItem extends RegionItem {
  type: 'heading';
  level: number;        // 1-6
  text: string;
}

export interface DirectRefItem extends RegionItem {
  type: 'direct-ref';
  path: string;         // @context/... 경로
}

export interface IndirectRefItem extends RegionItem {
  type: 'indirect-ref';
  path: string;         // @context/... 경로
  description: string;  // 설명
}

export interface CodeBlockItem extends RegionItem {
  type: 'code-block';
  language: string;
  content: string;
}

export interface TextItem extends RegionItem {
  type: 'text';
  content: string;
}

export interface ReferenceValidation {
  reference: ContextReference;
  exists: boolean;
  isDuplicate: boolean;
  duplicateLocations?: number[];
}

export class MarkdownEditor {
  private lines: string[];

  
  /**
   * Cache for parsed region items
   * Key: region name
   * Value: { content hash, parsed items }
   */
  private itemsCache = new Map<string, {
    contentHash: string;
    items: RegionItem[];
  }>();


  /**
   * Generate a unique ID for region items
   */
  static generateItemId(): string {
    // Use crypto.randomUUID if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // Fallback: timestamp + random
    return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Generate stable ID based on item content
   */

  /**
   * Generate stable ID based on item content
   * 
   * 항목 내용 기반의 안정적인 ID를 생성합니다 (FNV-1a 해시 알고리즘 사용).
   * 같은 내용이면 같은 ID가 생성되어 위치 변경에도 안정적입니다.
   * 
   * @param type - 항목 타입 (heading, direct-ref, indirect-ref, code-block, text)
   * @param content - 항목 내용
   * @returns 8자리 hex 해시를 포함한 ID (예: "direct-ref-a1b2c3d4")
   * 
   * @example
   * generateStableItemId('direct-ref', '@context/memory/index.md')
   * // "direct-ref-3f2a1b4c"
   */

  private static generateStableItemId(type: string, content: string): string {
    // Simple hash function (FNV-1a)
    let hash = 2166136261;
    const str = `${type}:${content}`;
    
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    
    // Convert to hex and take first 8 chars
    return `${type}-${(hash >>> 0).toString(16).substring(0, 8)}`;
  }
  constructor(content: string) {
    this.lines = content.split('\n');
  }

  /**
   * Get the current markdown content as string
   */
  getContent(): string {
    return this.lines.join('\n');
  }

  /**
   * Find a section by heading2 title
   * Returns the section with its boundaries
   */
  findSection(heading: string): MarkdownSection | null {
    const headingPattern = `## ${heading}`;
    const startLine = this.lines.findIndex(line => line.trim() === headingPattern);

    if (startLine === -1) return null;

    // Find the end of section (next ## or end of file)
    let endLine = this.lines.length - 1;
    for (let i = startLine + 1; i < this.lines.length; i++) {
      if (this.lines[i].startsWith('## ')) {
        endLine = i - 1;
        break;
      }
    }

    const content = this.lines.slice(startLine + 1, endLine + 1).join('\n');

    return {
      heading,
      content,
      startLine,
      endLine
    };
  }

  /**
   * Get all bullet items from a section
   */
  getBulletItems(section: MarkdownSection): BulletItem[] {
    const items: BulletItem[] = [];
    const sectionLines = this.lines.slice(section.startLine + 1, section.endLine + 1);

    sectionLines.forEach((line, idx) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('- ')) {
        const level = (line.length - trimmed.length) / 2; // Indentation level
        items.push({
          text: trimmed.substring(2), // Remove "- "
          level: Math.floor(level),
          line: section.startLine + 1 + idx
        });
      }
    });

    return items;
  }

  /**
   * Add a bullet item to a section
   * If section doesn't exist, create it at the end
   */
  addBulletItem(sectionHeading: string, bulletText: string, level: number = 0): void {
    let section = this.findSection(sectionHeading);

    if (!section) {
      // Create new section at the end
      this.lines.push('');
      this.lines.push(`## ${sectionHeading}`);
      this.lines.push('');
      section = this.findSection(sectionHeading)!;
    }

    const indent = '  '.repeat(level);
    const bulletLine = `${indent}- ${bulletText}`;

    // Insert at the end of section, before any trailing empty lines
    let insertLine = section.endLine + 1;
    while (insertLine > section.startLine + 1 && this.lines[insertLine - 1].trim() === '') {
      insertLine--;
    }

    this.lines.splice(insertLine, 0, bulletLine);
  }

  /**
   * Update a bullet item by line number
   */
  updateBulletItem(lineNumber: number, newText: string, newLevel?: number): void {
    const line = this.lines[lineNumber];
    if (!line || !line.trimStart().startsWith('- ')) {
      throw new Error(`Line ${lineNumber} is not a bullet item`);
    }

    const currentLevel = (line.length - line.trimStart().length) / 2;
    const level = newLevel !== undefined ? newLevel : Math.floor(currentLevel);
    const indent = '  '.repeat(level);
    this.lines[lineNumber] = `${indent}- ${newText}`;
  }

  /**
   * Delete a bullet item by line number
   */
  deleteBulletItem(lineNumber: number): void {
    const line = this.lines[lineNumber];
    if (!line || !line.trimStart().startsWith('- ')) {
      throw new Error(`Line ${lineNumber} is not a bullet item`);
    }

    this.lines.splice(lineNumber, 1);
  }

  /**
   * Find all code blocks in the document
   */
  findCodeBlocks(language?: string): CodeBlockReference[] {
    const blocks: CodeBlockReference[] = [];
    let inBlock = false;
    let blockStart = -1;
    let blockLang = '';
    let blockContent: string[] = [];

    this.lines.forEach((line, idx) => {
      if (line.trim().startsWith('```')) {
        if (!inBlock) {
          // Start of code block
          inBlock = true;
          blockStart = idx;
          blockLang = line.trim().substring(3).trim();
          blockContent = [];
        } else {
          // End of code block
          if (!language || blockLang === language) {
            blocks.push({
              language: blockLang,
              content: blockContent.join('\n'),
              startLine: blockStart,
              endLine: idx
            });
          }
          inBlock = false;
        }
      } else if (inBlock) {
        blockContent.push(line);
      }
    });

    return blocks;
  }

  /**
   * Add a code block reference
   */
  addCodeBlock(language: string, content: string, afterSection?: string): void {
    const lines = content.split('\n');
    const block = [
      `\`\`\`${language}`,
      ...lines,
      '```',
      ''
    ];

    if (afterSection) {
      const section = this.findSection(afterSection);
      if (section) {
        this.lines.splice(section.endLine + 1, 0, '', ...block);
        return;
      }
    }

    // Add at the end
    this.lines.push('', ...block);
  }

  /**
   * Update a code block by line number (start line)
   */
  updateCodeBlock(startLine: number, newContent: string, newLanguage?: string): void {
    const line = this.lines[startLine];
    if (!line || !line.trim().startsWith('```')) {
      throw new Error(`Line ${startLine} is not a code block start`);
    }

    // Find end of block
    let endLine = startLine + 1;
    while (endLine < this.lines.length && !this.lines[endLine].trim().startsWith('```')) {
      endLine++;
    }

    if (endLine >= this.lines.length) {
      throw new Error('Code block not properly closed');
    }

    const language = newLanguage || this.lines[startLine].trim().substring(3).trim();
    const contentLines = newContent.split('\n');
    const newBlock = [
      `\`\`\`${language}`,
      ...contentLines,
      '```'
    ];

    this.lines.splice(startLine, endLine - startLine + 1, ...newBlock);
  }

  /**
   * Delete a code block by start line number
   */
  deleteCodeBlock(startLine: number): void {
    const line = this.lines[startLine];
    if (!line || !line.trim().startsWith('```')) {
      throw new Error(`Line ${startLine} is not a code block start`);
    }

    // Find end of block
    let endLine = startLine + 1;
    while (endLine < this.lines.length && !this.lines[endLine].trim().startsWith('```')) {
      endLine++;
    }

    if (endLine >= this.lines.length) {
      throw new Error('Code block not properly closed');
    }

    // Delete including the closing ``` and any following empty line
    const deleteCount = endLine - startLine + 1;
    const nextLine = this.lines[endLine + 1];
    const extraDelete = nextLine && nextLine.trim() === '' ? 1 : 0;

    this.lines.splice(startLine, deleteCount + extraDelete);

    // Also remove preceding empty line if it exists
    if (startLine > 0 && this.lines[startLine - 1].trim() === '') {
      this.lines.splice(startLine - 1, 1);
    }
  }

  /**
   * Create or ensure a section exists at a specific position
   */
  ensureSection(heading: string, position: 'start' | 'end' | { after: string } = 'end'): MarkdownSection {
    const existing = this.findSection(heading);
    if (existing) return existing;

    // Create new section
    const newSection = [``, `## ${heading}`, ``];

    if (position === 'start') {
      this.lines.splice(0, 0, ...newSection);
    } else if (position === 'end') {
      this.lines.push(...newSection);
    } else {
      const afterSection = this.findSection(position.after);
      if (afterSection) {
        this.lines.splice(afterSection.endLine + 1, 0, ...newSection);
      } else {
        this.lines.push(...newSection);
      }
    }

    return this.findSection(heading)!;
  }

  /**
   * Find all managed regions marked with <!-- MEMORY_START/END -->
   */
  findAllManagedRegions(): ManagedRegion[] {
    const regions: ManagedRegion[] = [];
    const startPattern = /<!--\s*MEMORY_START:\s*(\S+)\s*-->/;
    const endPattern = /<!--\s*MEMORY_END:\s*(\S+)\s*-->/;

    let i = 0;
    while (i < this.lines.length) {
      const line = this.lines[i];
      const startMatch = line.match(startPattern);

      if (startMatch) {
        const regionName = startMatch[1];
        const startLine = i;
        const contentStartLine = i + 1;

        // Find matching end
        let endLine = -1;
        for (let j = i + 1; j < this.lines.length; j++) {
          const endMatch = this.lines[j].match(endPattern);
          if (endMatch && endMatch[1] === regionName) {
            endLine = j;
            break;
          }
        }

        if (endLine !== -1) {
          const contentEndLine = endLine - 1;
          const content = this.lines.slice(contentStartLine, endLine).join('\n');

          // Determine type
          let type: 'section' | 'code' | 'mixed' = 'mixed';
          const hasSection = content.includes('## ');
          const hasCode = content.includes('```');
          if (hasSection && !hasCode) type = 'section';
          else if (!hasSection && hasCode) type = 'code';

          regions.push({
            name: regionName,
            type,
            content,
            startLine,
            endLine,
            contentStartLine,
            contentEndLine,
          });

          i = endLine + 1;
        } else {
          i++;
        }
      } else {
        i++;
      }
    }

    return regions;
  }

  /**
   * Find a specific managed region by name
   */
  findManagedRegion(name: string): ManagedRegion | null {
    const regions = this.findAllManagedRegions();
    return regions.find(r => r.name === name) || null;
  }

  /**
   * Add a new managed region
   */
  addManagedRegion(
    name: string,
    content: string,
    position: 'start' | 'end' | { after: string } = 'end'
  ): void {
    const regionLines = [
      `<!-- MEMORY_START: ${name} -->`,
      ...content.split('\n'),
      `<!-- MEMORY_END: ${name} -->`,
      ''
    ];

    if (position === 'start') {
      this.lines.splice(0, 0, '', ...regionLines);
    } else if (position === 'end') {
      this.lines.push('', ...regionLines);
    } else {
      const afterSection = this.findSection(position.after);
      if (afterSection) {
        this.lines.splice(afterSection.endLine + 1, 0, '', ...regionLines);
      } else {
        this.lines.push('', ...regionLines);
      }
    }
  }

  /**
   * Update content within a managed region
   */
  updateManagedRegionContent(name: string, newContent: string): void {
    const region = this.findManagedRegion(name);
    if (!region) {
      throw new Error(`Managed region '${name}' not found`);
    }

    const newContentLines = newContent.split('\n');
    const deleteCount = region.contentEndLine - region.contentStartLine + 1;

    this.lines.splice(region.contentStartLine, deleteCount, ...newContentLines);

    // Invalidate cache
    this.itemsCache.delete(name);
  }

  /**
   * Delete a managed region
   */
  deleteManagedRegion(name: string): void {
    const region = this.findManagedRegion(name);
    if (!region) {
      throw new Error(`Managed region '${name}' not found`);
    }

    // Delete from start comment to end comment, including trailing empty line if exists
    let deleteCount = region.endLine - region.startLine + 1;
    const nextLine = this.lines[region.endLine + 1];
    if (nextLine && nextLine.trim() === '') {
      deleteCount++;
    }

    this.lines.splice(region.startLine, deleteCount);

    // Also remove preceding empty line if it exists
    if (region.startLine > 0 && this.lines[region.startLine - 1].trim() === '') {
      this.lines.splice(region.startLine - 1, 1);
    }
  }

  /**
   * Get sections within a managed region
   */
  getSectionsInRegion(regionName: string): MarkdownSection[] {
    const region = this.findManagedRegion(regionName);
    if (!region) return [];

    const sections: MarkdownSection[] = [];
    const regionLines = this.lines.slice(region.contentStartLine, region.contentEndLine + 1);

    regionLines.forEach((line, idx) => {
      if (line.startsWith('## ')) {
        const heading = line.substring(3).trim();
        const absoluteLineNumber = region.contentStartLine + idx;

        // Find section end within region
        let sectionEndLine = region.contentEndLine;
        for (let i = idx + 1; i < regionLines.length; i++) {
          if (regionLines[i].startsWith('## ')) {
            sectionEndLine = region.contentStartLine + i - 1;
            break;
          }
        }

        const content = this.lines.slice(absoluteLineNumber + 1, sectionEndLine + 1).join('\n');
        sections.push({
          heading,
          content,
          startLine: absoluteLineNumber,
          endLine: sectionEndLine,
        });
      }
    });

    return sections;
  }

  /**
   * Get code blocks within a managed region
   */
  getCodeBlocksInRegion(regionName: string): CodeBlockReference[] {
    const region = this.findManagedRegion(regionName);
    if (!region) return [];

    const blocks: CodeBlockReference[] = [];
    let inBlock = false;
    let blockStart = -1;
    let blockLang = '';
    let blockContent: string[] = [];

    for (let i = region.contentStartLine; i <= region.contentEndLine; i++) {
      const line = this.lines[i];

      if (line.trim().startsWith('```')) {
        if (!inBlock) {
          inBlock = true;
          blockStart = i;
          blockLang = line.trim().substring(3).trim();
          blockContent = [];
        } else {
          blocks.push({
            language: blockLang,
            content: blockContent.join('\n'),
            startLine: blockStart,
            endLine: i,
          });
          inBlock = false;
        }
      } else if (inBlock) {
        blockContent.push(line);
      }
    }

    return blocks;
  }

  /**
   * Extract all @context/ references from the document
   */
  extractContextReferences(): ContextReference[] {
    const references: ContextReference[] = [];
    const pattern = /@context\/[^\s\n]+\.md/g;

    this.lines.forEach((line, idx) => {
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          references.push({
            path: match,
            line: idx,
          });
        });
      }
    });

    return references;
  }

  /**
   * Extract @context/ references from a specific region
   */
  extractReferencesFromRegion(regionName: string): ContextReference[] {
    const region = this.findManagedRegion(regionName);
    if (!region) return [];

    const references: ContextReference[] = [];
    const pattern = /@context\/[^\s\n]+\.md/g;

    for (let i = region.contentStartLine; i <= region.contentEndLine; i++) {
      const line = this.lines[i];
      const matches = line.match(pattern);
      if (matches) {
        matches.forEach((match) => {
          references.push({
            path: match,
            line: i,
            regionName,
          });
        });
      }
    }

    return references;
  }

  /**
   * Check for duplicate references across the document
   */
  findDuplicateReferences(): Map<string, number[]> {
    const references = this.extractContextReferences();
    const pathMap = new Map<string, number[]>();

    references.forEach((ref) => {
      const lines = pathMap.get(ref.path) || [];
      lines.push(ref.line);
      pathMap.set(ref.path, lines);
    });

    // Filter only duplicates
    const duplicates = new Map<string, number[]>();
    pathMap.forEach((lines, path) => {
      if (lines.length > 1) {
        duplicates.set(path, lines);
      }
    });

    return duplicates;
  }

  /**
   * Get all unique references (no duplicates)
   */
  getUniqueReferences(): ContextReference[] {
    const references = this.extractContextReferences();
    const seen = new Set<string>();
    const unique: ContextReference[] = [];

    references.forEach((ref) => {
      if (!seen.has(ref.path)) {
        seen.add(ref.path);
        unique.push(ref);
      }
    });

    return unique;
  }

  /**
   * Parse region content into structured items
   */

  /**
   * Parse region content into structured items
   * 
   * Region 내 콘텐츠를 구조화된 항목으로 파싱합니다.
   * 각 항목은 content hash 기반의 안정적인 ID를 가집니다.
   * 
   * @param regionName - Region 이름
   * @returns 파싱된 항목 배열
   * 
   * @example
   * const items = editor.parseRegionItems('references');
   * // [
   * //   { id: 'heading-a1b2c3d4', type: 'heading', text: 'References', ... },
   * //   { id: 'direct-ref-e5f6g7h8', type: 'direct-ref', path: '@context/...', ... }
   * // ]
   */

  parseRegionItems(regionName: string): RegionItem[] {
    const region = this.findManagedRegion(regionName);
    if (!region) return [];

    // Calculate content hash for cache key
    const contentLines = this.lines.slice(region.contentStartLine, region.contentEndLine + 1);
    const content = contentLines.join('\n');
    const contentHash = MarkdownEditor.generateStableItemId('cache', content);

    // Check cache
    const cached = this.itemsCache.get(regionName);
    if (cached && cached.contentHash === contentHash) {
      return cached.items;
    }

    // Parse items
    const items: RegionItem[] = [];
    const lines = contentLines;
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const globalLine = region.contentStartLine + i;

      // Skip empty lines
      if (line.trim() === '') {
        i++;
        continue;
      }

      // Heading (## Title)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const text = headingMatch[2];
        items.push({
          id: MarkdownEditor.generateStableItemId('heading', text),
          type: 'heading',
          level: headingMatch[1].length,
          text,
          line: globalLine,
          endLine: globalLine,
          raw: line,
        } as HeadingItem);
        i++;
        continue;
      }

      // Direct reference (@context/path)
      const directRefMatch = line.match(/^\s*(@context\/[^\s`]+)\s*$/);
      if (directRefMatch) {
        const path = directRefMatch[1];
        items.push({
          id: MarkdownEditor.generateStableItemId('direct-ref', path),
          type: 'direct-ref',
          path,
          line: globalLine,
          endLine: globalLine,
          raw: line,
        } as DirectRefItem);
        i++;
        continue;
      }

      // Indirect reference (`@context/path` - description)
      const indirectRefMatch = line.match(/^\s*`(@context\/[^`]+)`\s*-\s*(.+)$/);
      if (indirectRefMatch) {
        const path = indirectRefMatch[1];
        const description = indirectRefMatch[2];
        const content = `${path}:${description}`;
        items.push({
          id: MarkdownEditor.generateStableItemId('indirect-ref', content),
          type: 'indirect-ref',
          path,
          description,
          line: globalLine,
          endLine: globalLine,
          raw: line,
        } as IndirectRefItem);
        i++;
        continue;
      }

      // Code block (```language ... ```)
      const codeBlockStartMatch = line.match(/^```(\w*)$/);
      if (codeBlockStartMatch) {
        const language = codeBlockStartMatch[1] || 'text';
        const startLine = globalLine;
        const codeLines: string[] = [];
        i++;

        while (i < lines.length) {
          const codeLine = lines[i];
          if (codeLine.trim() === '```') {
            // End of code block
            const content = codeLines.join('\n');
            items.push({
              id: MarkdownEditor.generateStableItemId('code-block', `${language}:${content}`),
              type: 'code-block',
              language,
              content,
              line: startLine,
              endLine: region.contentStartLine + i,
              raw: `\`\`\`${language}\n${content}\n\`\`\``,
            } as CodeBlockItem);
            i++;
            break;
          }
          codeLines.push(codeLine);
          i++;
        }
        continue;
      }

      // Text (fallback)
      items.push({
        id: MarkdownEditor.generateStableItemId('text', line),
        type: 'text',
        content: line,
        line: globalLine,
        endLine: globalLine,
        raw: line,
      } as TextItem);
      i++;
    }

    // Update cache
    this.itemsCache.set(regionName, { contentHash, items });

    return items;
  }

  /**
   * Add a new item to region at specified position
   */

  /**
   * Add a new item to region at specified position
   * 
   * Region에 새 항목을 추가합니다. 여러 줄 항목(code block)도 올바르게 처리됩니다.
   * 
   * @param regionName - Region 이름
   * @param item - 추가할 항목 (id, line, endLine 제외)
   * @param position - 삽입 위치 ('start', 'end', 또는 라인 번호)
   * 
   * @throws {Error} Region을 찾을 수 없는 경우
   * 
   * @example
   * editor.addRegionItem('tools', {
   *   type: 'code-block',
   *   language: 'bash',
   *   content: 'npm run dev'
   * }, 'end');
   */

  addRegionItem(
    regionName: string,
    item: Omit<RegionItem, 'id' | 'line' | 'endLine'>,
    position: 'start' | 'end' | number = 'end'
  ): void {
    const region = this.findManagedRegion(regionName);
    if (!region) throw new Error(`Region '${regionName}' not found`);

    let insertLine: number;
    
    if (position === 'start') {
      insertLine = region.contentStartLine;
    } else if (position === 'end') {
      insertLine = region.contentEndLine + 1;
    } else {
      insertLine = position;
    }

    const linesToInsert = this.itemToMarkdown(item);
    this.lines.splice(insertLine, 0, ...linesToInsert);

    // Invalidate cache
    this.itemsCache.delete(regionName);
  }

  /**
   * Update an existing item in region
   */

  /**
   * Update an existing item in region
   * 
   * Region 내 기존 항목을 업데이트합니다. 여러 줄 항목의 경우 이전 줄을 모두 제거하고 새 내용으로 교체합니다.
   * 
   * @param regionName - Region 이름
   * @param itemId - 항목 ID (content hash 기반)
   * @param newItem - 업데이트할 내용 (일부 필드만 가능)
   * 
   * @throws {Error} Region 또는 항목을 찾을 수 없는 경우
   * 
   * @example
   * editor.updateRegionItem('tools', 'code-block-a1b2c3d4', {
   *   content: 'npm run build'
   * });
   */

  updateRegionItem(
    regionName: string,
    itemId: string,
    newItem: Partial<Omit<RegionItem, 'id' | 'line' | 'endLine'>>
  ): void {
    const items = this.parseRegionItems(regionName);
    const item = items.find(i => i.id === itemId);
    
    if (!item) throw new Error(`Item '${itemId}' not found in region '${regionName}'`);

    const updated = { ...item, ...newItem };
    const newLines = this.itemToMarkdown(updated);
    
    // Replace lines (delete old lines and insert new ones)
    const deleteCount = item.endLine - item.line + 1;
    this.lines.splice(item.line, deleteCount, ...newLines);

    // Invalidate cache
    this.itemsCache.delete(regionName);
  }

  /**
   * Delete an item from region
   */

  /**
   * Delete an item from region
   * 
   * Region에서 항목을 삭제합니다. 여러 줄 항목도 모두 제거됩니다.
   * 
   * @param regionName - Region 이름
   * @param itemId - 삭제할 항목 ID
   * 
   * @throws {Error} Region 또는 항목을 찾을 수 없는 경우
   * 
   * @example
   * editor.deleteRegionItem('tools', 'code-block-a1b2c3d4');
   */

  deleteRegionItem(regionName: string, itemId: string): void {
    const items = this.parseRegionItems(regionName);
    const item = items.find(i => i.id === itemId);
    
    if (!item) throw new Error(`Item '${itemId}' not found in region '${regionName}'`);

    const deleteCount = item.endLine - item.line + 1;
    this.lines.splice(item.line, deleteCount);

    // Invalidate cache
    this.itemsCache.delete(regionName);
  }

  /**
   * Convert item to markdown string
   */
  private itemToMarkdown(item: Partial<RegionItem>): string[] {
    switch (item.type) {
      case 'heading':
        const heading = item as HeadingItem;
        return [`${'#'.repeat(heading.level)} ${heading.text}`];
      
      case 'direct-ref':
        const directRef = item as DirectRefItem;
        return [directRef.path];
      
      case 'indirect-ref':
        const indirectRef = item as IndirectRefItem;
        return [`\`${indirectRef.path}\` - ${indirectRef.description}`];
      
      case 'code-block':
        const codeBlock = item as CodeBlockItem;
        return [
          `\`\`\`${codeBlock.language}`,
          ...codeBlock.content.split('\n'),
          '```'
        ];
      
      case 'text':
        const text = item as TextItem;
        return [text.content];
      
      default:
        return item.raw ? [item.raw] : [''];
    }
  }

  /**
   * Remove duplicate context references from all managed regions
   * Keeps only the first occurrence of each reference
   */

  /**
   * Remove duplicate context references from all managed regions
   * 
   * 모든 Managed Region에서 중복된 직접 참조를 제거합니다.
   * 첫 번째 출현만 유지하고 이후 중복은 삭제됩니다.
   * 
   * @example
   * // Before: @context/file.md가 여러 번 나타남
   * // After: 첫 번째만 유지
   * editor.removeDuplicateReferences();
   */

  removeDuplicateReferences(): void {
    const regions = this.findAllManagedRegions();
    const seenRefs = new Set<string>();

    for (const region of regions) {
      const items = this.parseRegionItems(region.name);
      const itemsToRemove: string[] = [];

      for (const item of items) {
        if (item.type === 'direct-ref') {
          const directRef = item as DirectRefItem;
          if (seenRefs.has(directRef.path)) {
            itemsToRemove.push(item.id);
          } else {
            seenRefs.add(directRef.path);
          }
        }
      }

      // Remove duplicate items
      for (const itemId of itemsToRemove) {
        this.deleteRegionItem(region.name, itemId);
      }
    }
  }

  /**
   * Remove invalid context references (files that don't exist)
   * @param projectRoot - Project root directory to resolve file paths
   */

  /**
   * Remove invalid context references (files that don't exist)
   * 
   * 존재하지 않는 파일을 참조하는 항목을 제거합니다.
   * 
   * @param projectRoot - 프로젝트 루트 디렉토리 (파일 경로 해석용)
   * 
   * @example
   * await editor.removeInvalidReferences('/path/to/project');
   */

  async removeInvalidReferences(projectRoot: string): Promise<void> {
    const regions = this.findAllManagedRegions();

    for (const region of regions) {
      const items = this.parseRegionItems(region.name);
      const itemsToRemove: string[] = [];

      for (const item of items) {
        if (item.type === 'direct-ref') {
          const directRef = item as DirectRefItem;
          const filePath = MarkdownEditor.contextPathToFilePath(directRef.path, projectRoot);
          
          try {
            await window.fileAPI.readFile(filePath);
            // File exists, keep it
          } catch {
            // File doesn't exist, mark for removal
            itemsToRemove.push(item.id);
          }
        }
      }

      // Remove invalid items
      for (const itemId of itemsToRemove) {
        this.deleteRegionItem(region.name, itemId);
      }
    }
  }

  /**
   * Auto-fix all issues: remove duplicates, remove invalid refs, reorganize regions
   * @param projectRoot - Project root directory to resolve file paths
   */

  /**
   * Auto-fix all issues: remove duplicates, remove invalid refs, reorganize regions
   * 
   * 자동 수정을 실행합니다:
   * 1. 중복 참조 제거
   * 2. 유효하지 않은 참조 제거
   * 3. Region을 문서 하단으로 재배치
   * 
   * @param projectRoot - 프로젝트 루트 디렉토리
   * 
   * @example
   * await editor.autoFix('/path/to/project');
   */

  async autoFix(projectRoot: string): Promise<void> {
    // 1. Remove duplicate references
    this.removeDuplicateReferences();
    
    // 2. Remove invalid references
    await this.removeInvalidReferences(projectRoot);
    
    // 3. Reorganize regions to bottom
    if (!this.areRegionsAtBottom()) {
      this.reorganizeManagedRegions();
    }
  }

  /**
   * Convert @context/ path to actual file path
   * @context/memory/index.md -> docs/claude-context/memory/index.md
   */
  static contextPathToFilePath(contextPath: string, projectRoot: string): string {
    const relativePath = contextPath.replace('@context/', 'docs/claude-context/');
    return `${projectRoot}/${relativePath}`;
  }

  /**
   * Reorganize all managed regions to the bottom of the document
   * This separates general content from Memory-managed content
   */
  reorganizeManagedRegions(): void {
    const regions = this.findAllManagedRegions();
    if (regions.length === 0) return;

    // Store region data (with full comments)
    const regionData: Array<{ name: string; lines: string[] }> = [];

    regions.forEach((region) => {
      const lines = this.lines.slice(region.startLine, region.endLine + 1);
      regionData.push({
        name: region.name,
        lines,
      });
    });

    // Delete regions from original positions (in reverse order to maintain line numbers)
    for (let i = regions.length - 1; i >= 0; i--) {
      const region = regions[i];

      // Calculate delete count including trailing empty line
      let deleteCount = region.endLine - region.startLine + 1;
      const nextLine = this.lines[region.endLine + 1];
      if (nextLine && nextLine.trim() === '') {
        deleteCount++;
      }

      this.lines.splice(region.startLine, deleteCount);

      // Remove preceding empty line if exists
      if (region.startLine > 0 && this.lines[region.startLine - 1]?.trim() === '') {
        this.lines.splice(region.startLine - 1, 1);
      }
    }

    // Remove trailing empty lines
    while (this.lines.length > 0 && this.lines[this.lines.length - 1].trim() === '') {
      this.lines.pop();
    }

    // Add separator section
    const separator = [
      '',
      '---',
      '',
      '## Memory 관리 영역',
      '',
      '아래 영역들은 Memory Editor를 통해 관리됩니다.',
      '',
    ];

    this.lines.push(...separator);

    // Add all regions at the bottom
    regionData.forEach((data, index) => {
      if (index > 0) {
        this.lines.push(''); // Empty line between regions
      }
      this.lines.push(...data.lines);
    });

    // Ensure file ends with newline
    if (this.lines[this.lines.length - 1] !== '') {
      this.lines.push('');
    }
  }

  /**
   * Check if managed regions are already at the bottom
   */
  areRegionsAtBottom(): boolean {
    const regions = this.findAllManagedRegions();
    if (regions.length === 0) return true;

    const firstRegionStart = regions[0].startLine;
    const lastRegionEnd = regions[regions.length - 1].endLine;

    // Check if there's any non-empty content after the last region
    for (let i = lastRegionEnd + 1; i < this.lines.length; i++) {
      if (this.lines[i].trim() !== '') {
        return false;
      }
    }

    // Check if there's the separator before regions
    const separatorPattern = /^## Memory 관리 영역$/;
    for (let i = Math.max(0, firstRegionStart - 10); i < firstRegionStart; i++) {
      if (separatorPattern.test(this.lines[i])) {
        return true;
      }
    }

    return false;
  }
}
