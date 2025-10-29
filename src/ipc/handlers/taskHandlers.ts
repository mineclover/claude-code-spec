/**
 * Task-related IPC handlers
 */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import matter from 'gray-matter';
import { agentPoolManager } from '../../main/app-context';
import { processManager } from '@context-action/code-api';
import type { Task } from '../../services/TaskRouter';
import { TaskRouter } from '../../services/TaskRouter';
import type { IPCRouter } from '../IPCRouter';

const TASKS_DIR = 'workflow/tasks';

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
  router.handle<[string], TaskListItem[]>('listTasks', async (_event, projectPath) => {
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
  router.handle<[string, string], string | null>('getTask', async (_event, projectPath, taskId) => {
    try {
      const tasksPath = await ensureTasksDirectory(projectPath);
      const filePath = path.join(tasksPath, `${taskId}.md`);
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error(`[TaskHandlers] Failed to get task ${taskId}:`, error);
      return null;
    }
  });

  // Create a new task
  router.handle<[string, string, string], { success: boolean; error?: string }>(
    'createTask',
    async (_event, projectPath, taskId, content) => {
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
    },
  );

  // Update an existing task
  router.handle<[string, string, string], { success: boolean; error?: string }>(
    'updateTask',
    async (_event, projectPath, taskId, content) => {
      try {
        const tasksPath = await ensureTasksDirectory(projectPath);
        const filePath = path.join(tasksPath, `${taskId}.md`);

        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
      } catch (error) {
        console.error(`[TaskHandlers] Failed to update task ${taskId}:`, error);
        return { success: false, error: String(error) };
      }
    },
  );

  // Delete a task
  router.handle<[string, string], { success: boolean; error?: string }>(
    'deleteTask',
    async (_event, projectPath, taskId) => {
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

  // Execute a task with assigned agent
  router.handle<
    [{ projectPath: string; taskId: string }],
    { success: boolean; sessionId?: string; error?: string }
  >('executeTask', async (_event, { projectPath, taskId }) => {
    try {
      const tasksPath = await ensureTasksDirectory(projectPath);
      const filePath = path.join(tasksPath, `${taskId}.md`);

      // Load and parse task file
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = matter(content);
      const metadata = parsed.data;

      // Create Task object
      const task: Task = {
        id: taskId,
        title: metadata.title || 'Untitled',
        description: parsed.content,
        area: metadata.area || '',
        assigned_agent: metadata.assigned_agent || '',
        reviewer: metadata.reviewer,
        status: metadata.status || 'pending',
        references: metadata.references,
        successCriteria: metadata.success_criteria,
        projectPath,
      };

      // Validate assigned agent
      if (!task.assigned_agent) {
        return { success: false, error: 'Task must have an assigned_agent' };
      }

      // Load agent definitions if not already loaded
      await agentPoolManager.loadAgentDefinitions(projectPath);

      // Check if agent exists
      if (!agentPoolManager.hasAgentDefinition(task.assigned_agent)) {
        return {
          success: false,
          error: `Agent '${task.assigned_agent}' not found. Available agents: ${agentPoolManager.getAgentNames().join(', ')}`,
        };
      }

      // Create TaskRouter and route task
      const taskRouter = new TaskRouter(agentPoolManager, processManager);
      const sessionId = await taskRouter.routeTask(task);

      return { success: true, sessionId };
    } catch (error) {
      console.error(`[TaskHandlers] Failed to execute task ${taskId}:`, error);
      return { success: false, error: String(error) };
    }
  });
}
