/**
 * Sanity test: the mock adapter produces SessionMetaView shapes that the
 * session-core aggregators accept. Acts as a regression guard against future
 * type drift between the package and the app.
 */

import {
  aggregateSessionMetas,
  groupByFingerprint,
} from '@context-action/session-core';
import { describe, expect, it } from 'vitest';
import { BranchUnsupportedError } from '../../shared/dataSource';
import { MockSessionDataSource } from './mockDataSource';

describe('MockSessionDataSource', () => {
  const ds = new MockSessionDataSource();

  it('describes itself as a readonly mock adapter', () => {
    expect(ds.describe()).toEqual({ adapter: 'mock', readonly: true });
  });

  it('lists projects with aggregated session counts', async () => {
    const projects = await ds.listProjects();
    expect(projects.length).toBeGreaterThan(0);
    for (const p of projects) {
      expect(p.id).toMatch(/^proj-/);
      expect(p.path).toMatch(/^\//);
    }
  });

  it('emits sessions with usable cacheHitRatio', async () => {
    const projects = await ds.listProjects();
    const first = projects[0];
    if (!first) throw new Error('no projects');
    const sessions = await ds.listSessions(first.id);
    expect(sessions.length).toBeGreaterThan(0);
    for (const s of sessions) {
      expect(s.metrics.cacheHitRatio).toBeGreaterThanOrEqual(0);
      expect(s.metrics.cacheHitRatio).toBeLessThanOrEqual(1);
    }
  });

  it('feeds aggregateSessionMetas without type errors', async () => {
    const projects = await ds.listProjects();
    const all = (
      await Promise.all(projects.map((p) => ds.listSessions(p.id)))
    ).flat();
    const agg = aggregateSessionMetas(all);
    expect(agg.sessionCount).toBe(all.length);
    expect(agg.groupCount).toBeGreaterThan(0);
    expect(groupByFingerprint(all).size).toBe(agg.groupCount);
  });

  it('throws BranchUnsupportedError on branch()', async () => {
    await expect(
      ds.branch({ sessionId: 'whatever' }),
    ).rejects.toBeInstanceOf(BranchUnsupportedError);
  });

  it('returns a non-null mock outline for any sessionId', async () => {
    const o = await ds.getOutline('S-anything');
    expect(o).not.toBeNull();
    expect(o!.steps.length).toBeGreaterThan(0);
    expect(o!.segments.length).toBeGreaterThan(0);
    // The mock seeds descriptions on most steps so the renderer can
    // demo the description tag rail without a real fork.
    const tagged = o!.steps.filter((s) => !!s.description);
    expect(tagged.length).toBeGreaterThan(0);
  });

  it('throws BranchUnsupportedError on annotateOutline()', async () => {
    await expect(ds.annotateOutline('S-1')).rejects.toBeInstanceOf(
      BranchUnsupportedError,
    );
  });

  it('subscribeOutlineProgress returns a no-op unsubscribe', () => {
    const unsubscribe = ds.subscribeOutlineProgress(() => undefined);
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();
  });
});
