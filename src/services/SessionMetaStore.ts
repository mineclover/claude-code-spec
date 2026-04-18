/**
 * SessionMetaStore - read/write sidecar metadata files paired with CLI logs.
 *
 * Sidecar path: `<claudeProjectDir>/<cliSessionId>.meta.json`
 *
 * The CLI owns the `<cliSessionId>.jsonl` log file and appends to it while the
 * process is running; we must not touch that file. The sidecar lives next to
 * it and holds anything the app derived from events (fingerprint, cache
 * metrics, resolved MCP config). One sidecar per CLI session id.
 *
 * Writes are atomic (write-then-rename) so readers never see a half-written
 * file. Reads are tolerant of missing files and return null.
 */

import fs from 'node:fs';
import path from 'node:path';
import type { SessionMeta } from '../types/prefix-fingerprint';
import { getClaudeProjectDir } from './claudeSessions';
import { errorReporter } from './errorReporter';

export interface WriteSessionMetaParams {
  projectPath: string;
  cliSessionId: string;
  meta: SessionMeta;
}

export class SessionMetaStore {
  resolveSidecarPath(projectPath: string, cliSessionId: string): string {
    const dir = getClaudeProjectDir(projectPath);
    return path.join(dir, `${cliSessionId}.meta.json`);
  }

  write(params: WriteSessionMetaParams): string | null {
    const { projectPath, cliSessionId, meta } = params;
    const target = this.resolveSidecarPath(projectPath, cliSessionId);
    const dir = path.dirname(target);

    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      console.error(`[SessionMetaStore] mkdir failed for ${dir}:`, err);
      errorReporter.report('sessionMetaStore.mkdir', err);
      return null;
    }

    const tmp = `${target}.tmp-${process.pid}-${Date.now()}`;
    try {
      fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), 'utf-8');
      fs.renameSync(tmp, target);
      return target;
    } catch (err) {
      console.error(`[SessionMetaStore] write failed for ${target}:`, err);
      errorReporter.report('sessionMetaStore.write', err);
      try {
        fs.unlinkSync(tmp);
      } catch {}
      return null;
    }
  }

  read(projectPath: string, cliSessionId: string): SessionMeta | null {
    const target = this.resolveSidecarPath(projectPath, cliSessionId);
    return this.readFromPath(target);
  }

  readFromPath(filePath: string): SessionMeta | null {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(raw) as SessionMeta;
    } catch {
      return null;
    }
  }

  /**
   * Given a claude project directory, returns a map of cliSessionId ->
   * SessionMeta for every sidecar that parses. Missing sidecars are omitted
   * silently. Used by batch listers to join cache metrics onto session lists.
   */
  readAllInProjectDir(claudeProjectDir: string): Map<string, SessionMeta> {
    const result = new Map<string, SessionMeta>();
    let entries: string[];
    try {
      entries = fs.readdirSync(claudeProjectDir);
    } catch {
      return result;
    }
    for (const entry of entries) {
      if (!entry.endsWith('.meta.json')) continue;
      const full = path.join(claudeProjectDir, entry);
      const meta = this.readFromPath(full);
      if (meta) {
        result.set(meta.sessionId, meta);
      }
    }
    return result;
  }
}

export const sessionMetaStore = new SessionMetaStore();
