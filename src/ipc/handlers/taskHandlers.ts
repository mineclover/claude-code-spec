/**
 * Task-related IPC handlers
 */
import * as fs from 'fs/promises';
import * as path from 'path';
import type { IPCRouter } from '../IPCRouter';

const TASKS_DIR = '.claude/tasks';

interface TaskListItem {
  id: string;
  title: string;
  area: string;
  status: string;
  assigned_agent: string;
  reviewer: string;
  created: string;
  updated: string;
  filePath: string;
}

/**
 * Ensure tasks directory exists
 */
async function ensureTasksDirectory(projectPath: string): Promise<string> {
  const tasksPath = path.join(projectPath, TASKS_DIR);
  await fs.mkdir(tasksPath, { recursive: true });
  return tasksPath;
}

/**
 * Parse frontmatter from markdown content
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return {};
  }

  const frontmatter: Record<string, string> = {};
  frontmatterMatch[1].split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  });

  return frontmatter;
}

/**
 * Register task-related IPC handlers
 */
export function registerTaskHandlers(router: IPCRouter): void {
  // List all tasks in a project
  router.handle<{ projectPath: string }, TaskListItem[]>('listTasks', async ({ projectPath }) => {
    try {
      const tasksPath = await ensureTasksDirectory(projectPath);
      const files = await fs.readdir(tasksPath);
      const taskFiles = files.filter((f) => f.endsWith('.md'));

      const tasks: TaskListItem[] = [];

      for (const file of taskFiles) {
        const filePath = path.join(tasksPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const metadata = parseFrontmatter(content);

        tasks.push({
          id: metadata.id || file.replace('.md', ''),
          title: metadata.title || 'Untitled',
          area: metadata.area || '',
          status: metadata.status || 'pending',
          assigned_agent: metadata.assigned_agent || '',
          reviewer: metadata.reviewer || '',
          created: metadata.created || '',
          updated: metadata.updated || '',
          filePath: path.relative(projectPath, filePath),
        });
      }

      // Sort by updated date (newest first)
      tasks.sort((a, b) => {
        if (!a.updated) return 1;
        if (!b.updated) return -1;
        return new Date(b.updated).getTime() - new Date(a.updated).getTime();
      });

      return tasks;
    } catch (error) {
      console.error('[TaskHandlers] Failed to list tasks:', error);
      return [];
    }
  });

  // Get a single task
  router.handle<{ projectPath: string; taskId: string }, string | null>(
    'getTask',
    async ({ projectPath, taskId }) => {
      try {
        const tasksPath = await ensureTasksDirectory(projectPath);
        const filePath = path.join(tasksPath, `${taskId}.md`);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      } catch (error) {
        console.error(`[TaskHandlers] Failed to get task ${taskId}:`, error);
        return null;
      }
    },
  );

  // Create a new task
  router.handle<
    { projectPath: string; taskId: string; content: string },
    { success: boolean; error?: string }
  >('createTask', async ({ projectPath, taskId, content }) => {
    try {
      const tasksPath = await ensureTasksDirectory(projectPath);
      const filePath = path.join(tasksPath, `${taskId}.md`);

      // Check if file already exists
      try {
        await fs.access(filePath);
        return { success: false, error: 'Task already exists' };
      } catch {
        // File doesn't exist, proceed with creation
      }

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error(`[TaskHandlers] Failed to create task ${taskId}:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Update an existing task
  router.handle<
    { projectPath: string; taskId: string; content: string },
    { success: boolean; error?: string }
  >('updateTask', async ({ projectPath, taskId, content }) => {
    try {
      const tasksPath = await ensureTasksDirectory(projectPath);
      const filePath = path.join(tasksPath, `${taskId}.md`);

      await fs.writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (error) {
      console.error(`[TaskHandlers] Failed to update task ${taskId}:`, error);
      return { success: false, error: String(error) };
    }
  });

  // Delete a task
  router.handle<{ projectPath: string; taskId: string }, { success: boolean; error?: string }>(
    'deleteTask',
    async ({ projectPath, taskId }) => {
      try {
        const tasksPath = await ensureTasksDirectory(projectPath);
        const filePath = path.join(tasksPath, `${taskId}.md`);

        await fs.unlink(filePath);
        return { success: true };
      } catch (error) {
        console.error(`[TaskHandlers] Failed to delete task ${taskId}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );
}
