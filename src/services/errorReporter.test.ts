import { afterEach, describe, expect, it } from 'vitest';
import type { ErrorReport } from '../lib/errorChannel';
import { errorReporter } from './errorReporter';

afterEach(() => {
  errorReporter.reset();
});

describe('errorReporter', () => {
  it('forwards a single report to every subscriber', () => {
    const seenA: ErrorReport[] = [];
    const seenB: ErrorReport[] = [];
    errorReporter.subscribe((r) => seenA.push(r));
    errorReporter.subscribe((r) => seenB.push(r));

    errorReporter.report('claudeSessions', new Error('disk full'));

    expect(seenA).toHaveLength(1);
    expect(seenB).toHaveLength(1);
    expect(seenA[0].message).toBe('disk full');
    expect(seenA[0].source).toBe('claudeSessions');
    expect(seenA[0].detail).toContain('Error: disk full');
    expect(seenA[0].at).toBeGreaterThan(0);
  });

  it('returns the report so callers can inspect it', () => {
    const report = errorReporter.report('mod', 'plain string');
    expect(report.message).toBe('plain string');
    expect(report.source).toBe('mod');
  });

  it('disposer removes the subscriber', () => {
    const seen: ErrorReport[] = [];
    const dispose = errorReporter.subscribe((r) => seen.push(r));
    errorReporter.report('mod', 'first');
    dispose();
    errorReporter.report('mod', 'second');
    expect(seen).toHaveLength(1);
    expect(seen[0].message).toBe('first');
  });

  it('isolates subscriber failures', () => {
    const seen: ErrorReport[] = [];
    errorReporter.subscribe(() => {
      throw new Error('subscriber boom');
    });
    errorReporter.subscribe((r) => seen.push(r));

    expect(() => errorReporter.report('mod', 'ok')).not.toThrow();
    expect(seen).toHaveLength(1);
  });
});
