/**
 * Sessions Page
 * Inline project/session browser with multi-CLI tool support
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pagination } from '../components/common/Pagination';
import { ProgressBar } from '../components/common/ProgressBar';
import { McpResolvedChip } from '../components/mcp/McpResolvedChip';
import { ClassifiedLogEntry } from '../components/sessions/ClassifiedLogEntry';
import { McpOverrideComparisonTable } from '../components/sessions/McpOverrideComparisonTable';
import { ProjectSummaryCard } from '../components/sessions/ProjectSummaryCard';
import { TrendSparkline } from '../components/sessions/TrendSparkline';
import { useProject } from '../contexts/ProjectContext';
import { useToolContext } from '../contexts/ToolContext';
import {
  aggregateSessionMetas,
  compareMcpOverrides,
  trendByTime,
} from '../lib/session/aggregate';
import { entryDomId, parseAddress } from '../lib/session/address';
import { classifyEntry } from '../lib/sessionClassifier';
import type {
  ClaudeProjectInfo,
  ClaudeSessionEntry,
  ClaudeSessionInfo,
  SessionLoadProgress,
} from '../types/api/sessions';
import type { SessionMetaView } from '../types/prefix-fingerprint';
import styles from './SessionsPage.module.css';

/** Stable hue for a fingerprint hex string. Same hash always -> same color. */
function hashToHue(hex: string): number {
  let h = 0;
  for (let i = 0; i < hex.length; i++) {
    h = (h * 31 + hex.charCodeAt(i)) >>> 0;
  }
  return h % 360;
}

function formatCacheRatio(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

export function SessionsPage() {
  const { projectPath, updateProject } = useProject();
  const { selectedToolId } = useToolContext();
  const [projects, setProjects] = useState<ClaudeProjectInfo[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [projectPage, setProjectPage] = useState(0);
  const [sessions, setSessions] = useState<
    Omit<ClaudeSessionInfo, 'cwd' | 'firstUserMessage' | 'hasData'>[]
  >([]);
  const [totalSessions, setTotalSessions] = useState(0);
  const [sessionPage, setSessionPage] = useState(0);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<ClaudeSessionEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState<string | undefined>();
  const [sessionMetas, setSessionMetas] = useState<Record<string, SessionMetaView>>({});
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaProgress, setMetaProgress] = useState<string | undefined>();

  const PAGE_SIZE = 10;

  // Subscribe to load progress events. Both the initial project-list scan and
  // the derived session analysis fire through this channel; we keep a
  // dedicated meta-progress string so the Sessions header can show it while
  // the top-level Projects scan is idle.
  useEffect(() => {
    const cleanup = window.sessionsAPI.onLoadProgress((progress: SessionLoadProgress) => {
      if (progress.phase === 'done') {
        setProgressMessage(undefined);
        setMetaProgress(undefined);
      } else {
        setProgressMessage(progress.message);
        setMetaProgress(progress.message);
      }
    });
    return cleanup;
  }, []);

  // Reset state when tool changes
  useEffect(() => {
    setProjects([]);
    setTotalProjects(0);
    setProjectPage(0);
    setSessions([]);
    setTotalSessions(0);
    setSessionPage(0);
    setSelectedSession(null);
    setSessionLog([]);
  }, []);

  // Load projects
  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.sessionsAPI.getAllProjectsByTool(
        selectedToolId,
        projectPage,
        PAGE_SIZE,
      );
      setProjects(result.projects);
      setTotalProjects(result.total);
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedToolId, projectPage]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Load sessions when a project is selected
  const loadSessions = useCallback(async () => {
    if (!projectPath) {
      setSessions([]);
      return;
    }
    try {
      const result = await window.sessionsAPI.getSessionsByTool(
        selectedToolId,
        projectPath,
        sessionPage,
        PAGE_SIZE,
      );
      setSessions(result.sessions);
      setTotalSessions(result.total);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [selectedToolId, projectPath, sessionPage]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Load unified session views (sidecar when present, derived from JSONL
  // otherwise) for the selected project. Only Claude toolId is supported for
  // now; other providers don't have fingerprinting yet.
  const loadSessionMetas = useCallback(async () => {
    if (!projectPath || selectedToolId !== 'claude') {
      setSessionMetas({});
      return;
    }
    setMetaLoading(true);
    try {
      const views = await window.sessionsAPI.getProjectSessionViews(projectPath);
      setSessionMetas(views);
    } catch (error) {
      console.error('Failed to load session views:', error);
      setSessionMetas({});
    } finally {
      setMetaLoading(false);
      setMetaProgress(undefined);
    }
  }, [projectPath, selectedToolId]);

  useEffect(() => {
    loadSessionMetas();
  }, [loadSessionMetas]);

  // Count distinct fingerprint groups on the current page.
  const groupCount = useMemo(() => {
    const hashes = new Set<string>();
    for (const s of sessions) {
      const meta = sessionMetas[s.sessionId];
      if (meta?.fingerprintHash) {
        hashes.add(meta.fingerprintHash);
      }
    }
    return hashes.size;
  }, [sessions, sessionMetas]);

  // Project-wide aggregates derived from the full session views map (not the
  // current page). Computed client-side so no extra IPC traffic.
  const allViews = useMemo(() => Object.values(sessionMetas), [sessionMetas]);
  const projectAggregate = useMemo(() => aggregateSessionMetas(allViews), [allViews]);
  const cacheTrend = useMemo(
    () => trendByTime(allViews, 5, 'cacheHitRatio'),
    [allViews],
  );
  const overrideComparisons = useMemo(() => compareMcpOverrides(allViews), [allViews]);

  const handleSelectProject = (project: ClaudeProjectInfo) => {
    updateProject(project.projectPath, project.projectDirName);
    setSessionPage(0);
    setSelectedSession(null);
    setSessionLog([]);
  };

  const handleSelectSession = async (sessionId: string) => {
    if (!projectPath) return;
    setSelectedSession(sessionId);
    try {
      const log = await window.sessionsAPI.readLogByTool(selectedToolId, projectPath, sessionId);
      setSessionLog(log);
    } catch (error) {
      console.error('Failed to read session log:', error);
    }
  };

  const formatDate = (ts: number) => new Date(ts).toLocaleString();
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={styles.container}>
      {/* Projects column */}
      <div className={styles.projectsPanel}>
        <div className={styles.panelHeader}>
          <h3>Projects ({totalProjects})</h3>
          <button type="button" className={styles.refreshBtn} onClick={loadProjects}>
            Refresh
          </button>
        </div>
        {loading ? (
          <div className={styles.loading}>
            <ProgressBar visible={true} message={progressMessage} />
          </div>
        ) : (
          <>
            <div className={styles.list}>
              {projects.map((p) => (
                <button
                  key={p.projectDirName}
                  type="button"
                  className={`${styles.listItem} ${
                    projectPath === p.projectPath ? styles.selected : ''
                  }`}
                  onClick={() => handleSelectProject(p)}
                >
                  <div className={styles.itemTitle}>
                    {p.projectPath.split('/').filter(Boolean).pop()}
                  </div>
                  <div className={styles.itemMeta}>{p.sessions.length} sessions</div>
                </button>
              ))}
            </div>
            {totalProjects > PAGE_SIZE && (
              <Pagination
                currentPage={projectPage}
                totalItems={totalProjects}
                pageSize={PAGE_SIZE}
                onPageChange={setProjectPage}
              />
            )}
          </>
        )}
      </div>

      {/* Sessions column */}
      <div className={styles.sessionsPanel}>
        <div className={styles.panelHeader}>
          <h3>
            Sessions
            {projectPath && ` (${totalSessions})`}
          </h3>
          <div className={styles.sessionsHeaderRight}>
            {metaLoading && metaProgress && (
              <span className={styles.metaProgress} title={metaProgress}>
                {metaProgress}
              </span>
            )}
            {groupCount > 0 && (
              <>
                <span className={styles.groupsSummary}>
                  {groupCount} {groupCount === 1 ? 'group' : 'groups'}
                </span>
                <span
                  className={styles.legendIcon}
                  title={
                    'Dot = prefix fingerprint group\n' +
                    '  • same color  = same model + tool set (cache-eligible together)\n' +
                    '  • solid fill  = sidecar (app-driven, high fidelity)\n' +
                    '  • hollow ring = derived from JSONL\n' +
                    '  • dashed      = no metadata\n' +
                    'Fewer groups = cache-friendlier.'
                  }
                >
                  ?
                </span>
              </>
            )}
          </div>
        </div>
        {projectPath ? (
          <>
            {allViews.length > 0 && (
              <>
                <ProjectSummaryCard aggregate={projectAggregate} />
                <TrendSparkline points={cacheTrend} metric="cacheHitRatio" />
                <McpOverrideComparisonTable comparisons={overrideComparisons} />
              </>
            )}
            <div className={styles.list}>
              {sessions.map((s) => {
                const meta = sessionMetas[s.sessionId];
                const fpHash = meta?.fingerprintHash;
                const dotStyle = fpHash
                  ? { background: `hsl(${hashToHue(fpHash)}, 60%, 55%)` }
                  : undefined;
                const hitRatio = meta?.metrics?.cacheHitRatio ?? 0;
                const drift = meta?.drift?.detected === true;
                const derived = meta?.source === 'derived';
                const dotClass = derived ? styles.fpDotDerived : styles.fpDot;
                return (
                  <button
                    key={s.sessionId}
                    type="button"
                    className={`${styles.listItem} ${
                      selectedSession === s.sessionId ? styles.selected : ''
                    }`}
                    onClick={() => handleSelectSession(s.sessionId)}
                  >
                    <div className={styles.itemRow}>
                      {fpHash ? (
                        <span
                          className={dotClass}
                          style={dotStyle}
                          title={`Fingerprint: ${fpHash.substring(0, 12)} (${meta?.source ?? 'unknown'})`}
                        />
                      ) : (
                        <span className={styles.fpDotEmpty} title="No metadata" />
                      )}
                      <div className={styles.itemBody}>
                        <div className={styles.itemTitle}>{s.sessionId.substring(0, 8)}...</div>
                        <div className={styles.itemMeta}>
                          {formatDate(s.lastModified)} | {formatSize(s.fileSize)}
                        </div>
                        {meta && (
                          <div className={styles.badges}>
                            <span
                              className={`${styles.badge} ${hitRatio > 0.5 ? styles.badgeHot : ''}`}
                              title="Cache hit ratio (read / (read + input))"
                            >
                              cache {formatCacheRatio(hitRatio)}
                            </span>
                            {meta.model && (
                              <span className={styles.badge} title="Model used">
                                {meta.model.replace(/^claude-/, '')}
                              </span>
                            )}
                            {meta.mcpResolved && (
                              <McpResolvedChip mcp={meta.mcpResolved} />
                            )}
                            {drift && (
                              <span
                                className={`${styles.badge} ${styles.badgeDrift}`}
                                title={
                                  meta.drift?.differingComponents?.join(', ') ?? 'drift detected'
                                }
                              >
                                drift
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {totalSessions > PAGE_SIZE && (
              <Pagination
                currentPage={sessionPage}
                totalItems={totalSessions}
                pageSize={PAGE_SIZE}
                onPageChange={setSessionPage}
              />
            )}
          </>
        ) : (
          <div className={styles.placeholder}>Select a project</div>
        )}
      </div>

      {/* Session detail column */}
      <div className={styles.detailPanel}>
        <div className={styles.panelHeader}>
          <h3>Session Log</h3>
          {selectedSession && sessionLog.length > 0 && <JumpToAddress />}
        </div>
        {selectedSession && sessionMetas[selectedSession]?.mcpResolved && (
          <McpResolvedChip
            mcp={sessionMetas[selectedSession].mcpResolved!}
            variant="detail"
          />
        )}
        {selectedSession && sessionLog.length > 0 ? (
          <ClassifiedLogList
            entries={sessionLog}
            toolId={selectedToolId}
            selectedSession={selectedSession}
          />
        ) : (
          <div className={styles.placeholder}>
            {selectedSession ? 'No log entries' : 'Select a session'}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Small input + button that jumps to a `#N` or `#N.k` address inside the
 * currently rendered session log. Scrolls the matching DOM node into view and
 * briefly flashes its background.
 */
function JumpToAddress(): React.JSX.Element {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseAddress(value);
    if (!parsed) {
      setError('Use #N or #N.k');
      return;
    }
    const target = document.getElementById(
      entryDomId(parsed.entryIndex, parsed.blockIndex),
    );
    if (!target) {
      setError('Not found');
      return;
    }
    setError(null);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add(highlightClass);
    window.setTimeout(() => target.classList.remove(highlightClass), 1600);
  };

  return (
    <form className={styles.jumpForm} onSubmit={submit}>
      <input
        type="text"
        className={styles.jumpInput}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Jump to #N.k"
        aria-label="Jump to address"
      />
      <button type="submit" className={styles.jumpBtn}>
        Go
      </button>
      {error && <span className={styles.jumpError}>{error}</span>}
    </form>
  );
}

// Imported via CSS Modules so the highlight animation lives next to its
// definition. Re-exported as a string here to apply imperatively after a
// successful jump.
const highlightClass = 'session-entry-highlight';

/**
 * Filter categories for the Session Log. Each classified entry produces a
 * set of tags and is shown when any of its tags is in `enabled`.
 */
const FILTER_CATEGORIES: Array<{ key: string; label: string }> = [
  { key: 'messages', label: 'Messages' },
  { key: 'sub-agents', label: 'Sub-agents' },
  { key: 'tools', label: 'Tools' },
  { key: 'thinking', label: 'Thinking' },
  { key: 'system', label: 'System' },
  { key: 'hooks', label: 'Hooks' },
];

function tagsFor(ce: import('../lib/sessionClassifier').ClassifiedEntry): string[] {
  const tags: string[] = [];
  if (ce.hookSummary) tags.push('hooks');
  if (ce.speaker === 'sub-agent') tags.push('sub-agents');
  if (ce.outputType === 'thinking') tags.push('thinking');
  if (ce.outputType === 'tool-call' || ce.outputType === 'tool-output') tags.push('tools');
  if (ce.speaker === 'human' || (ce.speaker === 'agent' && ce.outputType === 'answer'))
    tags.push('messages');
  if (ce.speaker === 'system' && !ce.hookSummary) tags.push('system');
  return tags;
}

/** Memoized list of classified log entries with filter chips. */
function ClassifiedLogList({
  entries,
  toolId,
  selectedSession,
}: {
  entries: ClaudeSessionEntry[];
  toolId: string;
  selectedSession: string;
}) {
  const [enabled, setEnabled] = useState<Set<string>>(
    () => new Set(FILTER_CATEGORIES.map((c) => c.key)),
  );

  // Classify once, but carry the original JSONL line number so addresses stay
  // stable even when entries are filtered.
  const classified = useMemo(
    () => entries.map((e, i) => ({ ce: classifyEntry(e, toolId), index: i + 1 })),
    [entries, toolId],
  );

  const visible = useMemo(
    () =>
      classified.filter(({ ce }) => {
        const tags = tagsFor(ce);
        if (tags.length === 0) return true; // never hide truly uncategorized
        return tags.some((t) => enabled.has(t));
      }),
    [classified, enabled],
  );

  const toggle = (key: string) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const { ce } of classified) {
      for (const t of tagsFor(ce)) {
        out[t] = (out[t] ?? 0) + 1;
      }
    }
    return out;
  }, [classified]);

  return (
    <div className={styles.logWrapper}>
      <div className={styles.filterChips}>
        {FILTER_CATEGORIES.map((cat) => {
          const active = enabled.has(cat.key);
          const count = counts[cat.key] ?? 0;
          return (
            <button
              key={cat.key}
              type="button"
              className={`${styles.filterChip} ${active ? styles.filterChipActive : ''}`}
              onClick={() => toggle(cat.key)}
              disabled={count === 0}
              title={`${cat.label}: ${count} entries`}
            >
              {cat.label}
              <span className={styles.filterChipCount}>{count}</span>
            </button>
          );
        })}
        <span className={styles.filterMeta}>
          {visible.length}/{classified.length} shown
        </span>
      </div>
      <div className={styles.logContent}>
        {visible.map(({ ce, index }) => (
          <ClassifiedLogEntry
            key={String(ce.rawEntry.leafUuid ?? `${selectedSession}-${index}`)}
            entry={ce}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

