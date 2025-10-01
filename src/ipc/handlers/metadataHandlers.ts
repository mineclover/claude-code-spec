/**
 * Metadata IPC Handlers
 * Handles document metadata operations (reviews, improvements, tags)
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IPCRouter } from '../IPCRouter';
import type { DocumentMetadata, DocumentReview, DocumentImprovement } from '../../types/metadata';

const META_DIR = '/Users/junwoobang/project/claude-code-spec/docs/claude-context-meta';

// Convert file path to metadata file name
function getMetaFileName(filePath: string): string {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  return `${hash}.json`;
}

async function getMetaFilePath(filePath: string): Promise<string> {
  await fs.mkdir(META_DIR, { recursive: true });
  return path.join(META_DIR, getMetaFileName(filePath));
}

async function loadMetadata(filePath: string): Promise<DocumentMetadata | null> {
  try {
    const metaFilePath = await getMetaFilePath(filePath);
    const content = await fs.readFile(metaFilePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist, return default metadata
    return null;
  }
}

async function saveMetadata(metadata: DocumentMetadata): Promise<void> {
  const metaFilePath = await getMetaFilePath(metadata.filePath);
  await fs.writeFile(metaFilePath, JSON.stringify(metadata, null, 2), 'utf-8');
}

function createDefaultMetadata(filePath: string): DocumentMetadata {
  return {
    filePath,
    tags: [],
    reviews: [],
    improvements: [],
    searchKeywords: [],
    lastUpdated: Date.now(),
    rating: 0,
  };
}

export function registerMetadataHandlers(router: IPCRouter): void {
  // Get metadata for a document
  router.handle('get', async (_event, filePath: string) => {
    try {
      const metadata = await loadMetadata(filePath);
      return metadata || createDefaultMetadata(filePath);
    } catch (error) {
      console.error(`Error loading metadata for ${filePath}:`, error);
      return createDefaultMetadata(filePath);
    }
  });

  // Save complete metadata
  router.handle('save', async (_event, metadata: DocumentMetadata) => {
    try {
      metadata.lastUpdated = Date.now();
      await saveMetadata(metadata);
      return { success: true };
    } catch (error) {
      console.error(`Error saving metadata:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Add a review
  router.handle('add-review', async (_event, filePath: string, review: Omit<DocumentReview, 'id' | 'timestamp'>) => {
    try {
      let metadata = await loadMetadata(filePath) || createDefaultMetadata(filePath);

      const newReview: DocumentReview = {
        ...review,
        id: `review-${Date.now()}`,
        timestamp: Date.now(),
      };

      metadata.reviews.push(newReview);

      // Recalculate average rating
      const totalRating = metadata.reviews.reduce((sum, r) => sum + r.rating, 0);
      metadata.rating = totalRating / metadata.reviews.length;

      await saveMetadata(metadata);
      return { success: true, review: newReview };
    } catch (error) {
      console.error(`Error adding review:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Add an improvement
  router.handle('add-improvement', async (_event, filePath: string, improvement: Omit<DocumentImprovement, 'id' | 'timestamp'>) => {
    try {
      let metadata = await loadMetadata(filePath) || createDefaultMetadata(filePath);

      const newImprovement: DocumentImprovement = {
        ...improvement,
        id: `improve-${Date.now()}`,
        timestamp: Date.now(),
      };

      metadata.improvements.push(newImprovement);
      await saveMetadata(metadata);
      return { success: true, improvement: newImprovement };
    } catch (error) {
      console.error(`Error adding improvement:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Update tags
  router.handle('update-tags', async (_event, filePath: string, tags: string[]) => {
    try {
      let metadata = await loadMetadata(filePath) || createDefaultMetadata(filePath);
      metadata.tags = tags;
      await saveMetadata(metadata);
      return { success: true };
    } catch (error) {
      console.error(`Error updating tags:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Update search keywords
  router.handle('update-keywords', async (_event, filePath: string, keywords: string[]) => {
    try {
      let metadata = await loadMetadata(filePath) || createDefaultMetadata(filePath);
      metadata.searchKeywords = keywords;
      await saveMetadata(metadata);
      return { success: true };
    } catch (error) {
      console.error(`Error updating keywords:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Update improvement status
  router.handle('update-improvement-status', async (_event, filePath: string, improvementId: string, status: 'pending' | 'in-progress' | 'completed') => {
    try {
      let metadata = await loadMetadata(filePath);
      if (!metadata) {
        return { success: false, error: 'Metadata not found' };
      }

      const improvement = metadata.improvements.find(i => i.id === improvementId);
      if (!improvement) {
        return { success: false, error: 'Improvement not found' };
      }

      improvement.status = status;
      await saveMetadata(metadata);
      return { success: true };
    } catch (error) {
      console.error(`Error updating improvement status:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Search documents by tags or keywords
  router.handle('search', async (_event, query: string) => {
    try {
      const files = await fs.readdir(META_DIR);
      const results: Array<{ filePath: string; metadata: DocumentMetadata }> = [];

      for (const file of files) {
        if (!file.endsWith('.json') || file.startsWith('.')) continue;

        const content = await fs.readFile(path.join(META_DIR, file), 'utf-8');
        const metadata: DocumentMetadata = JSON.parse(content);

        const searchString = [
          ...metadata.tags,
          ...metadata.searchKeywords,
          metadata.filePath,
        ].join(' ').toLowerCase();

        if (searchString.includes(query.toLowerCase())) {
          results.push({ filePath: metadata.filePath, metadata });
        }
      }

      return results;
    } catch (error) {
      console.error(`Error searching metadata:`, error);
      return [];
    }
  });
}
