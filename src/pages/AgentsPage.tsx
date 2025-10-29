import type React from 'react';
import { useCallback, useEffect, useId, useState } from 'react';
import toast from 'react-hot-toast';
import { PermissionEditor } from '../components/agent/PermissionEditor';
import { ToolSelector } from '../components/agent/ToolSelector';
import { useProject } from '../contexts/ProjectContext';
import { generateAgentMarkdown, parseAgentMarkdown, validateAgent } from '../lib/agentParser';
import type { Agent, AgentListItem, AgentMetadata } from '../types/agent';
import styles from './AgentsPage.module.css';

export const AgentsPage: React.FC = () => {
  const { projectPath } = useProject();

  // Generate unique IDs for form elements
  const sourceTypeId = useId();
  const agentNameId = useId();
  const descriptionId = useId();
  const modelId = useId();
  const colorId = useId();
  const contentId = useId();
  const [agents, setAgents] = useState<AgentListItem[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [allowedTools, setAllowedTools] = useState<string[]>([]);
  const [model, setModel] = useState<'sonnet' | 'opus' | 'haiku' | 'heroku'>('sonnet');
  const [color, setColor] = useState('blue');
  const [permissions, setPermissions] = useState<AgentMetadata['permissions']>(undefined);
  const [sourceType, setSourceType] = useState<'project' | 'user'>('project');

  // Load agents list
  const loadAgents = useCallback(async () => {
    if (!projectPath) return;

    setLoading(true);
    try {
      const agentsList = await window.agentAPI.listAgents(projectPath);
      setAgents(agentsList);
    } catch (error) {
      console.error('Failed to load agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Load selected agent
  const loadAgent = useCallback(
    async (source: 'project' | 'user', name: string) => {
      if (!projectPath) return;

      try {
        const agentContent = await window.agentAPI.getAgent(source, name, projectPath);
        if (agentContent) {
          const agent = parseAgentMarkdown(agentContent, '', source);
          setSelectedAgent(agent);
          setAgentName(agent.name);
          setDescription(agent.description);
          setContent(agent.content);
          setAllowedTools(agent.allowedTools || []);
          setModel(agent.model || 'sonnet');
          setColor(agent.color || 'blue');
          setPermissions(agent.permissions);
          setSourceType(source);
          setIsEditing(false);
          setIsCreating(false);
        } else {
          toast.error('Agent not found');
        }
      } catch (error) {
        console.error('Failed to load agent:', error);
        toast.error('Failed to load agent');
      }
    },
    [projectPath],
  );

  const handleAgentClick = (agent: AgentListItem) => {
    loadAgent(agent.source, agent.name);
  };

  const handleNewAgent = () => {
    setSelectedAgent(null);
    setAgentName('');
    setDescription('');
    setContent('');
    setAllowedTools([]);
    setModel('sonnet');
    setColor('blue');
    setPermissions(undefined);
    setSourceType('project');
    setIsEditing(true);
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!projectPath) return;

    // Validate
    const validation = validateAgent({
      name: agentName,
      description,
      allowedTools,
      permissions,
    });

    if (!validation.valid) {
      toast.error(validation.errors.join('\n'));
      return;
    }

    try {
      const agent: Agent = {
        name: agentName,
        description,
        content,
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        model,
        color,
        permissions,
        filePath: '',
        source: sourceType,
      };

      const markdown = generateAgentMarkdown(agent);

      const result = isCreating
        ? await window.agentAPI.createAgent(sourceType, agentName, markdown, projectPath)
        : await window.agentAPI.updateAgent(sourceType, agentName, markdown, projectPath);

      if (result.success) {
        toast.success(isCreating ? 'Agent created' : 'Agent updated');
        setIsEditing(false);
        setIsCreating(false);
        loadAgents();
        loadAgent(sourceType, agentName);
      } else {
        toast.error(result.error || 'Failed to save agent');
      }
    } catch (error) {
      console.error('Failed to save agent:', error);
      toast.error('Failed to save agent');
    }
  };

  const handleDelete = async () => {
    if (!projectPath || !selectedAgent) return;

    if (!confirm(`Are you sure you want to delete agent "${selectedAgent.name}"?`)) return;

    try {
      const result = await window.agentAPI.deleteAgent(
        selectedAgent.source,
        selectedAgent.name,
        projectPath,
      );
      if (result.success) {
        toast.success('Agent deleted');
        setSelectedAgent(null);
        setAgentName('');
        setDescription('');
        setContent('');
        setAllowedTools([]);
        setPermissions(undefined);
        setIsEditing(false);
        setIsCreating(false);
        loadAgents();
      } else {
        toast.error(result.error || 'Failed to delete agent');
      }
    } catch (error) {
      console.error('Failed to delete agent:', error);
      toast.error('Failed to delete agent');
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      setSelectedAgent(null);
      setAgentName('');
      setDescription('');
      setContent('');
      setAllowedTools([]);
      setModel('sonnet');
      setColor('blue');
      setPermissions(undefined);
      setIsCreating(false);
    } else if (selectedAgent) {
      // Restore original values
      setAgentName(selectedAgent.name);
      setDescription(selectedAgent.description);
      setContent(selectedAgent.content);
      setAllowedTools(selectedAgent.allowedTools || []);
      setModel(selectedAgent.model || 'sonnet');
      setColor(selectedAgent.color || 'blue');
      setPermissions(selectedAgent.permissions);
      setSourceType(selectedAgent.source);
    }
    setIsEditing(false);
  };

  if (!projectPath) {
    return (
      <div className={styles.container}>
        <div className={styles.noProject}>Please select a project to manage agents</div>
      </div>
    );
  }

  // Separate agents by source
  const projectAgents = agents.filter((a) => a.source === 'project');
  const userAgents = agents.filter((a) => a.source === 'user');

  return (
    <div className={styles.container}>
      <div className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <h3>Agents</h3>
          <button type="button" className={styles.newButton} onClick={handleNewAgent}>
            + New
          </button>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading agents...</div>
        ) : (
          <div className={styles.agentsList}>
            {/* Project Agents */}
            <div className={styles.agentsSection}>
              <h4 className={styles.sectionTitle}>Project Agents</h4>
              {projectAgents.length === 0 ? (
                <div className={styles.empty}>No project agents</div>
              ) : (
                projectAgents.map((agent) => (
                  <button
                    key={`${agent.source}-${agent.name}`}
                    type="button"
                    className={`${styles.agentItem} ${
                      selectedAgent?.name === agent.name && selectedAgent?.source === agent.source
                        ? styles.selected
                        : ''
                    }`}
                    onClick={() => handleAgentClick(agent)}
                  >
                    <div className={styles.agentItemHeader}>
                      <span className={styles.agentName}>{agent.name}</span>
                    </div>
                    <div className={styles.agentDescription}>{agent.description}</div>
                    <div className={styles.agentMeta}>
                      {agent.allowedToolsCount !== undefined && (
                        <span>Tools: {agent.allowedToolsCount}</span>
                      )}
                      {agent.hasPermissions && <span>Has permissions</span>}
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* User Agents */}
            <div className={styles.agentsSection}>
              <h4 className={styles.sectionTitle}>User Agents</h4>
              {userAgents.length === 0 ? (
                <div className={styles.empty}>No user agents</div>
              ) : (
                userAgents.map((agent) => (
                  <button
                    key={`${agent.source}-${agent.name}`}
                    type="button"
                    className={`${styles.agentItem} ${
                      selectedAgent?.name === agent.name && selectedAgent?.source === agent.source
                        ? styles.selected
                        : ''
                    }`}
                    onClick={() => handleAgentClick(agent)}
                  >
                    <div className={styles.agentItemHeader}>
                      <span className={styles.agentName}>{agent.name}</span>
                    </div>
                    <div className={styles.agentDescription}>{agent.description}</div>
                    <div className={styles.agentMeta}>
                      {agent.allowedToolsCount !== undefined && (
                        <span>Tools: {agent.allowedToolsCount}</span>
                      )}
                      {agent.hasPermissions && <span>Has permissions</span>}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className={styles.content}>
        {selectedAgent || isCreating ? (
          <>
            <div className={styles.contentHeader}>
              <h2>{isCreating ? 'New Agent' : 'Agent Details'}</h2>
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
                  <label htmlFor={sourceTypeId}>
                    Storage Level: <span className={styles.required}>*</span>
                  </label>
                  <select
                    id={sourceTypeId}
                    className={styles.select}
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value as 'project' | 'user')}
                    disabled={!isCreating}
                  >
                    <option value="project">Project (workflow/agents/)</option>
                    <option value="user">User (~/.claude/agents/)</option>
                  </select>
                  <p className={styles.hint}>
                    {sourceType === 'project'
                      ? 'Shared with team, stored in project directory'
                      : 'Personal agent, stored in user home directory'}
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={agentNameId}>
                    Name: <span className={styles.required}>*</span>
                  </label>
                  <input
                    id={agentNameId}
                    type="text"
                    className={styles.input}
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="my-agent"
                    disabled={!isCreating}
                  />
                  <p className={styles.hint}>
                    Alphanumeric, hyphens, and underscores only (cannot be changed after creation)
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={descriptionId}>
                    Description: <span className={styles.required}>*</span>
                  </label>
                  <input
                    id={descriptionId}
                    type="text"
                    className={styles.input}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Expert specialist. Use when user requests..."
                  />
                  <p className={styles.hint}>
                    Include "Use when" to define trigger conditions (Claude Code compatible)
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={modelId}>Model:</label>
                  <select
                    id={modelId}
                    className={styles.select}
                    value={model}
                    onChange={(e) =>
                      setModel(e.target.value as 'sonnet' | 'opus' | 'haiku' | 'heroku')
                    }
                  >
                    <option value="sonnet">Sonnet (Balanced)</option>
                    <option value="opus">Opus (Powerful)</option>
                    <option value="haiku">Haiku (Fast)</option>
                    <option value="heroku">Heroku (Experimental)</option>
                  </select>
                  <p className={styles.hint}>
                    Claude model for this agent (Claude Code compatible)
                  </p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={colorId}>Color:</label>
                  <select
                    id={colorId}
                    className={styles.select}
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                  >
                    <option value="blue">Blue</option>
                    <option value="purple">Purple</option>
                    <option value="green">Green</option>
                    <option value="red">Red</option>
                    <option value="yellow">Yellow</option>
                    <option value="orange">Orange</option>
                  </select>
                  <p className={styles.hint}>UI hint color (Claude Code compatible)</p>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor={contentId}>Content (Markdown):</label>
                  <textarea
                    id={contentId}
                    className={styles.textarea}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Detailed instructions for the agent..."
                    rows={8}
                  />
                </div>

                <div className={styles.formGroup}>
                  <ToolSelector
                    projectPath={projectPath}
                    selectedTools={allowedTools}
                    onToolsChange={setAllowedTools}
                  />
                </div>

                <div className={styles.formGroup}>
                  <PermissionEditor
                    permissions={permissions}
                    onPermissionsChange={setPermissions}
                  />
                  <p className={styles.hint} style={{ marginTop: '0.5rem', color: '#ff9800' }}>
                    ⚠️ Note: Claude Code does not support permissions in frontmatter. Permissions
                    will be converted to documentation in the agent body.
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.preview}>
                <div className={styles.previewSection}>
                  <h3>Basic Info</h3>
                  <div className={styles.previewItem}>
                    <strong>Name:</strong> {selectedAgent?.name}
                  </div>
                  <div className={styles.previewItem}>
                    <strong>Storage:</strong>{' '}
                    {selectedAgent?.source === 'project' ? 'Project' : 'User'}
                  </div>
                  <div className={styles.previewItem}>
                    <strong>Description:</strong> {selectedAgent?.description}
                  </div>
                  <div className={styles.previewItem}>
                    <strong>Model:</strong> {selectedAgent?.model || 'sonnet'}
                  </div>
                  <div className={styles.previewItem}>
                    <strong>Color:</strong>{' '}
                    <span
                      style={{
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        backgroundColor: selectedAgent?.color || 'blue',
                        borderRadius: '2px',
                        marginRight: '4px',
                        verticalAlign: 'middle',
                      }}
                    />{' '}
                    {selectedAgent?.color || 'blue'}
                  </div>
                </div>

                {selectedAgent?.content && (
                  <div className={styles.previewSection}>
                    <h3>Content</h3>
                    <pre className={styles.previewContent}>{selectedAgent.content}</pre>
                  </div>
                )}

                {selectedAgent?.allowedTools && selectedAgent.allowedTools.length > 0 && (
                  <div className={styles.previewSection}>
                    <h3>Allowed Tools ({selectedAgent.allowedTools.length})</h3>
                    <div className={styles.toolsList}>
                      {selectedAgent.allowedTools.map((tool) => (
                        <code key={tool} className={styles.toolTag}>
                          {tool}
                        </code>
                      ))}
                    </div>
                  </div>
                )}

                {selectedAgent?.permissions && (
                  <div className={styles.previewSection}>
                    <h3>Permissions</h3>
                    {selectedAgent.permissions.allowList &&
                      selectedAgent.permissions.allowList.length > 0 && (
                        <>
                          <h4>Allow List:</h4>
                          <ul>
                            {selectedAgent.permissions.allowList.map((pattern) => (
                              <li key={`allow-${pattern}`}>
                                <code>{pattern}</code>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    {selectedAgent.permissions.denyList &&
                      selectedAgent.permissions.denyList.length > 0 && (
                        <>
                          <h4>Deny List:</h4>
                          <ul>
                            {selectedAgent.permissions.denyList.map((pattern) => (
                              <li key={`deny-${pattern}`}>
                                <code>{pattern}</code>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          <div className={styles.placeholder}>
            <p>Select an agent to view details</p>
            <p>or create a new agent to get started</p>
          </div>
        )}
      </div>
    </div>
  );
};
