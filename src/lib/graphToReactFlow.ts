/**
 * Utility to convert Task graph to ReactFlow format
 *
 * Phase 3: Visualization
 */

import type { Edge, Node } from 'reactflow';
import type { Task } from '../types/task';
import type { TaskProgress } from '../services/LangGraphEngine';

export interface TaskNodeData {
  task: Task;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress?: TaskProgress;
}

/**
 * Get node color based on status
 */
export function getNodeColor(status: TaskNodeData['status']): string {
  switch (status) {
    case 'pending':
      return '#e2e8f0'; // gray
    case 'running':
      return '#3b82f6'; // blue
    case 'completed':
      return '#10b981'; // green
    case 'failed':
      return '#ef4444'; // red
    default:
      return '#e2e8f0';
  }
}

/**
 * Get node border color based on status
 */
export function getNodeBorderColor(status: TaskNodeData['status']): string {
  switch (status) {
    case 'pending':
      return '#cbd5e0';
    case 'running':
      return '#2563eb';
    case 'completed':
      return '#059669';
    case 'failed':
      return '#dc2626';
    default:
      return '#cbd5e0';
  }
}

/**
 * Convert tasks to ReactFlow nodes
 */
export function tasksToNodes(
  tasks: Task[],
  taskProgress: Record<string, TaskProgress> = {},
): Node<TaskNodeData>[] {
  // Calculate positions using a simple hierarchical layout
  const levels = analyzeDependencies(tasks);
  const nodes: Node<TaskNodeData>[] = [];

  const levelWidth = 300;
  const levelHeight = 150;
  const nodeWidth = 250;

  levels.forEach((level, levelIndex) => {
    level.forEach((task, taskIndex) => {
      const progress = taskProgress[task.id];
      const status = getTaskStatus(task, progress);

      const x = levelIndex * levelWidth;
      const y = taskIndex * levelHeight;

      nodes.push({
        id: task.id,
        type: 'default',
        position: { x, y },
        data: {
          task,
          status,
          progress,
        },
        style: {
          background: getNodeColor(status),
          border: `2px solid ${getNodeBorderColor(status)}`,
          borderRadius: '8px',
          padding: '12px',
          width: nodeWidth,
          fontSize: '14px',
          color: '#1a202c',
        },
      });
    });
  });

  return nodes;
}

/**
 * Convert task dependencies to ReactFlow edges
 */
export function tasksToEdges(tasks: Task[]): Edge[] {
  const edges: Edge[] = [];

  for (const task of tasks) {
    if (task.dependencies && task.dependencies.length > 0) {
      for (const depId of task.dependencies) {
        edges.push({
          id: `${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'smoothstep',
          animated: false,
          style: {
            stroke: '#94a3b8',
            strokeWidth: 2,
          },
        });
      }
    }
  }

  return edges;
}

/**
 * Get task status from progress
 */
function getTaskStatus(task: Task, progress?: TaskProgress): TaskNodeData['status'] {
  if (!progress) {
    return task.status === 'completed' ? 'completed' : 'pending';
  }

  switch (progress.status) {
    case 'running':
      return 'running';
    case 'completed':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

/**
 * Analyze task dependencies and group by execution level
 */
function analyzeDependencies(tasks: Task[]): Task[][] {
  const taskMap = new Map<string, Task>();
  const levels: Task[][] = [];
  const taskLevels = new Map<string, number>();

  // Build task map
  for (const task of tasks) {
    taskMap.set(task.id, task);
  }

  // Calculate level for each task
  const calculateLevel = (taskId: string, visited = new Set<string>()): number => {
    if (taskLevels.has(taskId)) {
      return taskLevels.get(taskId)!;
    }

    if (visited.has(taskId)) {
      console.warn(`Circular dependency detected involving task: ${taskId}`);
      return 0;
    }

    visited.add(taskId);
    const task = taskMap.get(taskId);

    if (!task) {
      console.warn(`Task not found: ${taskId}`);
      return 0;
    }

    // If no dependencies, level is 0
    if (!task.dependencies || task.dependencies.length === 0) {
      taskLevels.set(taskId, 0);
      return 0;
    }

    // Calculate level based on dependencies
    let maxDepLevel = -1;
    for (const depId of task.dependencies) {
      const depLevel = calculateLevel(depId, new Set(visited));
      maxDepLevel = Math.max(maxDepLevel, depLevel);
    }

    const level = maxDepLevel + 1;
    taskLevels.set(taskId, level);
    return level;
  };

  // Calculate levels for all tasks
  for (const task of tasks) {
    calculateLevel(task.id);
  }

  // Group tasks by level
  for (const task of tasks) {
    const level = taskLevels.get(task.id) || 0;
    if (!levels[level]) {
      levels[level] = [];
    }
    levels[level].push(task);
  }

  return levels;
}

/**
 * Update nodes with new task progress
 */
export function updateNodesWithProgress(
  nodes: Node<TaskNodeData>[],
  taskProgress: Record<string, TaskProgress>,
): Node<TaskNodeData>[] {
  return nodes.map((node) => {
    const progress = taskProgress[node.id];
    if (!progress) return node;

    const status = getTaskStatus(node.data.task, progress);

    return {
      ...node,
      data: {
        ...node.data,
        status,
        progress,
      },
      style: {
        ...node.style,
        background: getNodeColor(status),
        border: `2px solid ${getNodeBorderColor(status)}`,
      },
    };
  });
}
