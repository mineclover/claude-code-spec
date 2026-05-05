import type { ProjectAggregate } from '@context-action/session-core';
import type { ProjectListItem } from '../data/dataSource';

interface Props {
  projects: ProjectListItem[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  aggregate: ProjectAggregate;
}

function fmtPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ProjectAggregateBar({
  projects,
  activeProjectId,
  onSelectProject,
  aggregate,
}: Props) {
  return (
    <div className="agg-bar">
      <nav className="project-tabs" aria-label="projects">
        {projects.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`project-tab ${p.id === activeProjectId ? 'active' : ''}`}
            onClick={() => onSelectProject(p.id)}
          >
            <span className="path mono">{p.path}</span>
            <span className="count dim"> · {p.sessionCount}</span>
          </button>
        ))}
      </nav>
      <div className="agg-stats">
        <div className="agg-cell">
          <div className="agg-lbl">sessions</div>
          <div className="agg-val">{aggregate.sessionCount}</div>
        </div>
        <div className="agg-cell">
          <div className="agg-lbl">prefix groups</div>
          <div className="agg-val">{aggregate.groupCount}</div>
        </div>
        <div className="agg-cell">
          <div className="agg-lbl">avg cache hit</div>
          <div className="agg-val accent">{fmtPct(aggregate.avgCacheHitRatio)}</div>
        </div>
        <div className="agg-cell">
          <div className="agg-lbl">total cost</div>
          <div className="agg-val">${aggregate.totalCostUsd.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}
