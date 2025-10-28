import type React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import { AgentSelector } from '../components/task/AgentSelector';
import { WorkAreaSelector } from '../components/task/WorkAreaSelector';
import { useProject } from '../contexts/ProjectContext';
import { generateTaskMarkdown, parseTaskMarkdown } from '../lib/taskParser';
import type { Task, TaskListItem } from '../types/task';
import styles from './TasksPage.module.css';

export const TasksPage: React.FC = () => {
  const { projectPath } = useProject();
  
  // Generate unique IDs for form elements
  const titleId = useId();
  const reviewerId = useId();
  const statusId = useId();
  const descriptionId = useId();
  const [tasks, setTasks] = useState<TaskListItem[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskContent, setTaskContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state for individual fields
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('');
  const [assignedAgent, setAssignedAgent] = useState('claude-sonnet-4');
  const [reviewer, setReviewer] = useState('');
  const [status, setStatus] = useState<Task['status']>('pending');
  const [description, setDescription] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [successCriteria, setSuccessCriteria] = useState<string[]>([]);
  const [newReference, setNewReference] = useState('');
  const [newCriterion, setNewCriterion] = useState('');

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
          const task = parseTaskMarkdown(content);
          setTaskContent(content);
          setSelectedTaskId(taskId);
          setTitle(task.title);
          setArea(task.area);
          setAssignedAgent(task.assigned_agent);
          setReviewer(task.reviewer);
          setStatus(task.status);
          setDescription(task.description);
          setReferences(task.references || []);
          setSuccessCriteria(task.successCriteria || []);
          setIsEditing(false);
          setIsCreating(false);
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
    const taskId = `task-${Date.now()}`;
    setSelectedTaskId(taskId);
    setTitle('New Task');
    setArea('');
    setAssignedAgent('claude-sonnet-4');
    setReviewer('');
    setStatus('pending');
    setDescription('');
    setReferences([]);
    setSuccessCriteria([]);
    setIsEditing(true);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!projectPath || !selectedTaskId) return;

    // Validation
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const now = new Date().toISOString();
      const task: Task = {
        id: selectedTaskId,
        title,
        area,
        assigned_agent: assignedAgent,
        reviewer,
        status,
        created: isCreating ? now : parseTaskMarkdown(taskContent).created,
        updated: now,
        references,
        successCriteria,
        description,
      };

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
        loadTask(selectedTaskId);
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
      setTitle('');
      setArea('');
      setAssignedAgent('claude-sonnet-4');
      setReviewer('');
      setStatus('pending');
      setDescription('');
      setReferences([]);
      setSuccessCriteria([]);
      setIsCreating(false);
    } else if (selectedTaskId) {
      // Restore from taskContent
      const task = parseTaskMarkdown(taskContent);
      setTitle(task.title);
      setArea(task.area);
      setAssignedAgent(task.assigned_agent);
      setReviewer(task.reviewer);
      setStatus(task.status);
      setDescription(task.description);
      setReferences(task.references || []);
      setSuccessCriteria(task.successCriteria || []);
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
              <button
                key={task.id}
                type="button"
                className={`${styles.taskItem} ${selectedTaskId === task.id ? styles.selected : ''}`}
                onClick={() => handleTaskClick(task.id)}
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
              </button>
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
                    <button type="button" className={styles.deleteButton} onClick={handleDelete}>
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
              <div className={styles.editor}>
                <div className={styles.formGroup}>
                  <label htmlFor={titleId}>
                    Title: <span className={styles.required}>*</span>
                  </label>
                  <input
                    id={titleId}
                    type="text"
                    className={styles.input}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Task title"
                  />
                </div>

                <div className={styles.formGroup}>
                  {projectPath && (
                    <WorkAreaSelector
                      projectPath={projectPath}
                      selectedArea={area}
                      onAreaChange={setArea}
                    />
                  )}
                </div>

                <div className={styles.formGroup}>
                  {projectPath && (
                    <AgentSelector
                      projectPath={projectPath}
                      selectedAgent={assignedAgent}
                      onAgentChange={setAssignedAgent}
                    />
                  )}
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={reviewerId}>Reviewer:</label>
                  <input
                    id={reviewerId}
                    type="text"
                    className={styles.input}
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    placeholder="e.g., claude-opus-4 or human:john@example.com"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={statusId}>Status:</label>
                  <select
                    id={statusId}
                    className={styles.select}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Task['status'])}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={descriptionId}>Description:</label>
                  <textarea
                    id={descriptionId}
                    className={styles.textarea}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task description..."
                    rows={6}
                  />
                </div>

                <div className={styles.formGroup}>
                  <fieldset>
                    <legend>References:</legend>
                    <div className={styles.listItems}>
                      {references.map((ref, index) => (
                        <div key={`ref-${ref}-${index}`} className={styles.listItem}>
                          <span>{ref}</span>
                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() => setReferences(references.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.addItem}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="File path or URL"
                        value={newReference}
                        onChange={(e) => setNewReference(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newReference.trim()) {
                            e.preventDefault();
                            setReferences([...references, newReference.trim()]);
                            setNewReference('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={styles.addButton}
                        onClick={() => {
                          if (newReference.trim()) {
                            setReferences([...references, newReference.trim()]);
                            setNewReference('');
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </fieldset>
                </div>

                <div className={styles.formGroup}>
                  <fieldset>
                    <legend>Success Criteria:</legend>
                    <div className={styles.listItems}>
                      {successCriteria.map((criterion, index) => (
                        <div key={`criterion-${criterion}-${index}`} className={styles.listItem}>
                          <span>{criterion}</span>
                          <button
                            type="button"
                            className={styles.removeButton}
                            onClick={() =>
                              setSuccessCriteria(successCriteria.filter((_, i) => i !== index))
                            }
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className={styles.addItem}>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="Success criterion"
                        value={newCriterion}
                        onChange={(e) => setNewCriterion(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newCriterion.trim()) {
                            e.preventDefault();
                            setSuccessCriteria([...successCriteria, newCriterion.trim()]);
                            setNewCriterion('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={styles.addButton}
                        onClick={() => {
                          if (newCriterion.trim()) {
                            setSuccessCriteria([...successCriteria, newCriterion.trim()]);
                            setNewCriterion('');
                          }
                        }}
                      >
                        + Add
                      </button>
                    </div>
                  </fieldset>
                </div>
              </div>
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
