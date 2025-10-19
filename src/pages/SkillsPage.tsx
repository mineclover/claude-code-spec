import type React from 'react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { SkillEditorModal } from '../components/skill/SkillEditorModal';
import { useProject } from '../contexts/ProjectContext';
import type { Skill, SkillListItem } from '../types/skill';
import type { OfficialSkill, RepositoryStatus } from '../types/skillRepository';
import styles from './SkillsPage.module.css';

type TabType = 'installed' | 'repository';
type ScopeType = 'global' | 'project';
type EditorMode = 'create' | 'edit';

export const SkillsPage: React.FC = () => {
  const { projectPath } = useProject();
  const [activeTab, setActiveTab] = useState<TabType>('installed');
  const [scope, setScope] = useState<ScopeType>('project');
  const [installedSkills, setInstalledSkills] = useState<SkillListItem[]>([]);
  const [officialSkills, setOfficialSkills] = useState<OfficialSkill[]>([]);
  const [repoStatus, setRepoStatus] = useState<RepositoryStatus | null>(null);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(false);
  const [repoLoading, setRepoLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Editor modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<EditorMode>('create');
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);

  // Load repository status
  const loadRepoStatus = useCallback(async () => {
    try {
      const status = await window.skillRepositoryAPI.getRepositoryStatus();
      setRepoStatus(status);
    } catch (error) {
      console.error('Failed to load repository status:', error);
    }
  }, []);

  // Load installed skills
  const loadInstalledSkills = useCallback(async () => {
    setLoading(true);
    try {
      const skills = await window.skillAPI.listSkills(scope, scope === 'project' ? projectPath : undefined);
      setInstalledSkills(skills);
    } catch (error) {
      console.error('Failed to load installed skills:', error);
      toast.error('Failed to load installed skills');
    } finally {
      setLoading(false);
    }
  }, [scope, projectPath]);

  // Load official skills
  const loadOfficialSkills = useCallback(async () => {
    if (!repoStatus?.exists) return;

    setRepoLoading(true);
    try {
      const skills = searchQuery
        ? await window.skillRepositoryAPI.searchOfficialSkills(searchQuery)
        : await window.skillRepositoryAPI.listOfficialSkills();
      setOfficialSkills(skills);
    } catch (error) {
      console.error('Failed to load official skills:', error);
      toast.error('Failed to load official skills');
    } finally {
      setRepoLoading(false);
    }
  }, [repoStatus?.exists, searchQuery]);

  // Clone repository
  const handleCloneRepo = async () => {
    setRepoLoading(true);
    try {
      await window.skillRepositoryAPI.cloneRepository();
      toast.success('Repository cloned successfully');
      await loadRepoStatus();
      await loadOfficialSkills();
    } catch (error) {
      console.error('Failed to clone repository:', error);
      toast.error('Failed to clone repository');
    } finally {
      setRepoLoading(false);
    }
  };

  // Update repository
  const handleUpdateRepo = async () => {
    setRepoLoading(true);
    try {
      await window.skillRepositoryAPI.updateRepository();
      toast.success('Repository updated successfully');
      await loadRepoStatus();
      await loadOfficialSkills();
    } catch (error) {
      console.error('Failed to update repository:', error);
      toast.error('Failed to update repository');
    } finally {
      setRepoLoading(false);
    }
  };

  // Load selected skill
  const loadSelectedSkill = useCallback(
    async (skillId: string, skillScope: ScopeType) => {
      try {
        const skill = await window.skillAPI.getSkill(
          skillId,
          skillScope,
          skillScope === 'project' ? projectPath : undefined
        );
        if (skill) {
          setSelectedSkill(skill);
          setSelectedSkillId(skillId);
        } else {
          toast.error('Skill not found');
        }
      } catch (error) {
        console.error('Failed to load skill:', error);
        toast.error('Failed to load skill');
      }
    },
    [projectPath]
  );

  // Import skill from repository
  const handleImportSkill = async (skillId: string) => {
    try {
      await window.skillRepositoryAPI.importSkill({
        skillId,
        scope,
        projectPath: scope === 'project' ? projectPath : undefined,
      });
      toast.success(`Imported ${skillId} successfully`);
      await loadInstalledSkills();
    } catch (error) {
      console.error('Failed to import skill:', error);
      toast.error('Failed to import skill');
    }
  };

  // Delete skill
  const handleDeleteSkill = async (skillId: string) => {
    if (!confirm(`Are you sure you want to delete ${skillId}?`)) {
      return;
    }

    try {
      await window.skillAPI.deleteSkill(skillId, scope, scope === 'project' ? projectPath : undefined);
      toast.success('Skill deleted successfully');
      setSelectedSkillId(null);
      setSelectedSkill(null);
      await loadInstalledSkills();
    } catch (error) {
      console.error('Failed to delete skill:', error);
      toast.error('Failed to delete skill');
    }
  };

  // Open editor for new skill
  const handleNewSkill = () => {
    setEditorMode('create');
    setEditingSkill(null);
    setIsEditorOpen(true);
  };

  // Open editor for editing skill
  const handleEditSkill = () => {
    if (!selectedSkill) return;
    setEditorMode('edit');
    setEditingSkill(selectedSkill);
    setIsEditorOpen(true);
  };

  // Handle editor save
  const handleEditorSave = async () => {
    await loadInstalledSkills();
    if (editingSkill) {
      await loadSelectedSkill(editingSkill.id, scope);
    }
  };

  useEffect(() => {
    loadRepoStatus();
  }, [loadRepoStatus]);

  useEffect(() => {
    if (activeTab === 'installed') {
      loadInstalledSkills();
    } else if (activeTab === 'repository') {
      loadOfficialSkills();
    }
  }, [activeTab, loadInstalledSkills, loadOfficialSkills]);

  return (
    <>
      <SkillEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleEditorSave}
        skill={editingSkill}
        scope={scope}
        projectPath={projectPath}
        mode={editorMode}
      />

      <div className={styles.container}>
        <div className={styles.header}>
          <h1>Skills</h1>
          <p>Manage Claude Code Skills - extend Claude's capabilities with custom workflows</p>
        </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === 'installed' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('installed')}
        >
          Installed Skills
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'repository' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('repository')}
        >
          Repository Browser
        </button>
      </div>

      {/* Installed Skills Tab */}
      {activeTab === 'installed' && (
        <div className={styles.content}>
          {/* Scope selector */}
          <div className={styles.toolbar}>
            <div className={styles.scopeSelector}>
              <button
                className={`${styles.scopeButton} ${scope === 'project' ? styles.active : ''}`}
                onClick={() => setScope('project')}
                disabled={!projectPath}
              >
                Project Skills
              </button>
              <button
                className={`${styles.scopeButton} ${scope === 'global' ? styles.active : ''}`}
                onClick={() => setScope('global')}
              >
                Global Skills
              </button>
            </div>
            <button className={styles.newButton} onClick={handleNewSkill}>
              + New Skill
            </button>
          </div>

          {/* Skills list */}
          <div className={styles.skillsList}>
            {loading ? (
              <div className={styles.loading}>Loading skills...</div>
            ) : installedSkills.length === 0 ? (
              <div className={styles.empty}>
                <p>No skills installed in {scope} scope</p>
                <p className={styles.hint}>Import skills from the Repository Browser</p>
              </div>
            ) : (
              installedSkills.map((skill) => (
                <div
                  key={skill.id}
                  className={`${styles.skillCard} ${selectedSkillId === skill.id ? styles.selected : ''}`}
                  onClick={() => loadSelectedSkill(skill.id, scope)}
                >
                  <div className={styles.skillHeader}>
                    <h3>{skill.name}</h3>
                    <span className={styles.scope}>{skill.scope}</span>
                  </div>
                  <p className={styles.description}>{skill.description}</p>
                  <div className={styles.skillFooter}>
                    {skill.hasFiles && <span className={styles.badge}>📎 Has files</span>}
                    {skill.updatedAt && (
                      <span className={styles.date}>
                        Updated: {new Date(skill.updatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Selected skill detail */}
          {selectedSkill && (
            <div className={styles.detail}>
              <div className={styles.detailHeader}>
                <h2>{selectedSkill.frontmatter.name}</h2>
                <div className={styles.actions}>
                  <button onClick={handleEditSkill}>Edit</button>
                  <button onClick={() => handleDeleteSkill(selectedSkill.id)}>Delete</button>
                </div>
              </div>
              <div className={styles.detailContent}>
                <pre>{selectedSkill.content}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Repository Browser Tab */}
      {activeTab === 'repository' && (
        <div className={styles.content}>
          {/* Repository status */}
          <div className={styles.repoStatus}>
            {!repoStatus?.exists ? (
              <div className={styles.repoSetup}>
                <h3>Repository Not Cloned</h3>
                <p>Clone the official skills repository to browse and import skills.</p>
                <button onClick={handleCloneRepo} disabled={repoLoading} className={styles.cloneButton}>
                  {repoLoading ? 'Cloning...' : 'Clone Repository'}
                </button>
              </div>
            ) : (
              <>
                <div className={styles.repoInfo}>
                  <div>
                    <strong>Status:</strong> ✓ Cloned ({repoStatus.skillCount} skills)
                  </div>
                  {repoStatus.lastUpdate && (
                    <div>
                      <strong>Last Update:</strong> {new Date(repoStatus.lastUpdate).toLocaleString()}
                    </div>
                  )}
                  <div>
                    <strong>Path:</strong> {repoStatus.path}
                  </div>
                </div>
                <button onClick={handleUpdateRepo} disabled={repoLoading} className={styles.updateButton}>
                  {repoLoading ? 'Updating...' : 'Update Repository'}
                </button>
              </>
            )}
          </div>

          {/* Search */}
          {repoStatus?.exists && (
            <>
              <div className={styles.search}>
                <input
                  type="text"
                  placeholder="Search skills..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {/* Official skills list */}
              <div className={styles.skillsList}>
                {repoLoading ? (
                  <div className={styles.loading}>Loading skills...</div>
                ) : officialSkills.length === 0 ? (
                  <div className={styles.empty}>
                    <p>No skills found</p>
                  </div>
                ) : (
                  officialSkills.map((skill) => (
                    <div key={skill.id} className={styles.skillCard}>
                      <div className={styles.skillHeader}>
                        <h3>{skill.name}</h3>
                        <span className={`${styles.scope} ${styles[skill.source]}`}>{skill.source}</span>
                      </div>
                      <p className={styles.description}>{skill.description}</p>
                      <div className={styles.skillFooter}>
                        {skill.files.length > 0 && (
                          <span className={styles.badge}>📎 {skill.files.length} files</span>
                        )}
                        {skill.lastCommit && (
                          <span className={styles.date}>
                            {new Date(skill.lastCommit.date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      <button
                        className={styles.importButton}
                        onClick={() => handleImportSkill(skill.id)}
                      >
                        Import to {scope}
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}
      </div>
    </>
  );
};
