import type { Task, TaskMetadata } from '../types/task';

/**
 * Parse task markdown file content to Task object
 */
export function parseTaskMarkdown(content: string): Task {
  // Extract frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    throw new Error('Invalid task file: missing frontmatter');
  }

  const frontmatter = frontmatterMatch[1];
  const body = content.slice(frontmatterMatch[0].length).trim();

  // Parse frontmatter
  const metadata: Partial<TaskMetadata> = {};
  frontmatter.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      const keyName = key.trim() as keyof TaskMetadata;
      
      if (keyName === 'id') {
        metadata.id = value;
      } else if (keyName === 'title') {
        metadata.title = value;
      } else if (keyName === 'area') {
        metadata.area = value;
      } else if (keyName === 'assigned_agent') {
        metadata.assigned_agent = value;
      } else if (keyName === 'reviewer') {
        metadata.reviewer = value;
      } else if (keyName === 'status') {
        metadata.status = value as 'pending' | 'in_progress' | 'completed' | 'cancelled';
      } else if (keyName === 'created') {
        metadata.created = value;
      } else if (keyName === 'updated') {
        metadata.updated = value;
      }
    }
  });

  // Parse body sections
  const sections = {
    references: [] as string[],
    successCriteria: [] as string[],
    description: '',
    reviewNotes: '',
  };

  const referencesMatch = body.match(/## References\n([\s\S]*?)(?=\n## |$)/);
  if (referencesMatch) {
    sections.references = referencesMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('-'))
      .map((line) => line.trim().substring(1).trim());
  }

  const successCriteriaMatch = body.match(/## Success Criteria\n([\s\S]*?)(?=\n## |$)/);
  if (successCriteriaMatch) {
    sections.successCriteria = successCriteriaMatch[1]
      .split('\n')
      .filter((line) => line.trim().startsWith('- ['))
      .map((line) => line.trim().substring(2).trim());
  }

  const descriptionMatch = body.match(/## Description\n([\s\S]*?)(?=\n## |$)/);
  if (descriptionMatch) {
    sections.description = descriptionMatch[1].trim();
  }

  const reviewNotesMatch = body.match(/## Review Notes\n([\s\S]*?)$/);
  if (reviewNotesMatch) {
    sections.reviewNotes = reviewNotesMatch[1].trim();
  }

  return {
    ...(metadata as TaskMetadata),
    ...sections,
  };
}

/**
 * Generate task markdown content from Task object
 */
export function generateTaskMarkdown(task: Task): string {
  const frontmatter = `---
id: ${task.id}
title: ${task.title}
area: ${task.area}
assigned_agent: ${task.assigned_agent}
reviewer: ${task.reviewer}
status: ${task.status}
created: ${task.created}
updated: ${task.updated}
---`;

  const references =
    task.references.length > 0
      ? `## References\n${task.references.map((ref) => `- ${ref}`).join('\n')}\n\n`
      : '';

  const successCriteria =
    task.successCriteria.length > 0
      ? `## Success Criteria\n${task.successCriteria.map((criterion) => `- ${criterion}`).join('\n')}\n\n`
      : '';

  const description = task.description ? `## Description\n${task.description}\n\n` : '';

  const reviewNotes = task.reviewNotes ? `## Review Notes\n${task.reviewNotes}\n` : '';

  return `${frontmatter}\n\n${references}${successCriteria}${description}${reviewNotes}`.trim();
}
