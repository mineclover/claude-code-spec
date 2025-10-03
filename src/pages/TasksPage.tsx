import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useProject } from '../contexts/ProjectContext';
import { generateTaskMarkdown, parseTaskMarkdown } from '../lib/taskParser';
import type { Task, TaskListItem } from '../types/task';
import styles from './TasksPage.module.css';

export const TasksPage: React.FC = () => {
  const { projectPath } = useProject();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskContent, setTaskContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load tasks list
  const loadTasks = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const tasksList = await window.taskAPI.listTasks(projectPath);
      setTasks(tasksList);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Load selected task
  const loadTask = useCallback(
    async (taskId: string) => {
      if (!projectPath) return;

      try {
        const content = await window.taskAPI.getTask(projectPath, taskId);
        if (content) {
          setTaskContent(content);
          setSelectedTaskId(taskId);
          setIsEditing(false);
        } else {
          toast.error('Task not found');
        }
      } catch (error) {
        console.error('Failed to load task:', error);
        toast.error('Failed to load task');
      }
    },
    [projectPath],
  );

  const handleTaskClick = (taskId: string) => {
    loadTask(taskId);
  };

  const handleNewTask = () => {
    const now = new Date().toISOString();
    const taskId = `task-${Date.now()}`;
    const newTask: Task = {
      id: taskId,
      title: 'New Task',
      area: '',
      assigned_agent: 'claude-sonnet-4',
      reviewer: '',
      status: 'pending',
      created: now,
      updated: now,
      references: [],
      successCriteria: [],
      description: '',
    };

    setTaskContent(generateTaskMarkdown(newTask));
    setSelectedTaskId(taskId);
    setIsEditing(true);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!projectPath || !selectedTaskId) return;

    try {
      // Update the 'updated' timestamp in the content
      const task = parseTaskMarkdown(taskContent);
      task.updated = new Date().toISOString();
      const updatedContent = generateTaskMarkdown(task);

      const result = isCreating
        ? await window.taskAPI.createTask(projectPath, selectedTaskId, updatedContent)
        : await window.taskAPI.updateTask(projectPath, selectedTaskId, updatedContent);

      if (result.success) {
        toast.success(isCreating ? 'Task created' : 'Task updated');
        setTaskContent(updatedContent);
        setIsEditing(false);
        setIsCreating(false);
        loadTasks();
      } else {
        toast.error(result.error || 'Failed to save task');
      }
    } catch (error) {
      console.error('Failed to save task:', error);
      toast.error('Failed to save task');
    }
  };

  const handleDelete = async () => {
    if (!projectPath || !selectedTaskId) return;

    if (!confirm('Are you sure you want to delete this task?')) return;

    try {
      const result = await window.taskAPI.deleteTask(projectPath, selectedTaskId);
      if (result.success) {
        toast.success('Task deleted');
        setSelectedTaskId(null);
        setTaskContent('');
        setIsEditing(false);
        setIsCreating(false);
        loadTasks();
      } else {
        toast.error(result.error || 'Failed to delete task');
      }
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      setSelectedTaskId(null);
      setTaskContent('');
      setIsCreating(false);
    }
    setIsEditing(false);
  };

  if (!projectPath) {
    return (
      <div className={styles.container}>
        <div className={styles.noProject}>Please select a project to manage tasks</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Tasks</h3>
          <button type="button" className={styles.newButton} onClick={handleNewTask}>
            + New
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className={styles.empty}>No tasks yet</div>
        ) : (
          <div className={styles.tasksList}>
            {tasks.map((task) => (
              <div
                key={task.id}
                className={`${styles.taskItem} ${selectedTaskId === task.id ? styles.selected : ''}`}
                onClick={() => handleTaskClick(task.id)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleTaskClick(task.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div className={styles.taskItemHeader}>
                  <span className={styles.taskTitle}>{task.title}</span>
                  <span className={`${styles.taskStatus} ${styles[task.status]}`}>
                    {task.status}
                  </span>
                </div>
                {task.area && <div className={styles.taskArea}>{task.area}</div>}
                <div className={styles.taskMeta}>
                  <span>Agent: {task.assigned_agent}</span>
                  {task.reviewer && <span>Reviewer: {task.reviewer}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.content}>
        {selectedTaskId ? (
          <>
            <div className={styles.contentHeader}>
              <h2>{isCreating ? 'New Task' : 'Task Details'}</h2>
              <div className={styles.contentActions}>
                {isEditing ? (
                  <>
                    <button type="button" className={styles.cancelButton} onClick={handleCancel}>
                      Cancel
                    </button>
                    <button type="button" className={styles.saveButton} onClick={handleSave}>
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className={styles.deleteButton}
                      onClick={handleDelete}
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      className={styles.editButton}
                      onClick={() => setIsEditing(true)}
                    >
                      Edit
                    </button>
                  </>
                )}
              </div>
            </div>

            {isEditing ? (
              <textarea
                className={styles.editor}
                value={taskContent}
                onChange={(e) => setTaskContent(e.target.value)}
                placeholder="Enter task content in markdown format..."
              />
            ) : (
              <div className={styles.preview}>
                <pre>{taskContent}</pre>
              </div>
            )}
          </>
        ) : (
          <div className={styles.placeholder}>
            <p>Select a task to view details</p>
            <p>or create a new task to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};
