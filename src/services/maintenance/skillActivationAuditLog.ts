import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  SkillActivationAuditEvent,
  SkillActivationStateSnapshot,
} from '../../types/tool-maintenance';

const SKILL_ACTIVATION_AUDIT_SCHEMA_VERSION = 1;
const DEFAULT_SKILL_ACTIVATION_EVENT_LIMIT = 20;
const MAX_SKILL_ACTIVATION_EVENT_LIMIT = 200;

interface SkillActivationAuditLogDocument {
  schemaVersion: number;
  events: SkillActivationAuditEvent[];
}

export interface SkillActivationAuditStore {
  append(event: SkillActivationAuditEvent): Promise<void>;
  listRecent(limit?: number): Promise<SkillActivationAuditEvent[]>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cloneSnapshot(snapshot: SkillActivationStateSnapshot): SkillActivationStateSnapshot {
  return {
    active: snapshot.active,
    path: snapshot.path,
  };
}

function cloneEvent(event: SkillActivationAuditEvent): SkillActivationAuditEvent {
  return {
    provider: event.provider,
    skillId: event.skillId,
    before: cloneSnapshot(event.before),
    after: cloneSnapshot(event.after),
    timestamp: event.timestamp,
  };
}

function normalizeStateSnapshot(input: unknown): SkillActivationStateSnapshot | null {
  if (!isRecord(input)) {
    return null;
  }

  const active = input.active;
  if (typeof active !== 'boolean') {
    return null;
  }

  const rawPath = input.path;
  const normalizedPath =
    typeof rawPath === 'string' ? rawPath.trim() : rawPath === null ? null : undefined;
  if (normalizedPath === undefined) {
    return null;
  }

  return {
    active,
    path: normalizedPath && normalizedPath.length > 0 ? normalizedPath : null,
  };
}

function normalizeSkillActivationAuditEvent(input: unknown): SkillActivationAuditEvent | null {
  if (!isRecord(input)) {
    return null;
  }

  const provider = typeof input.provider === 'string' ? input.provider.trim() : '';
  const skillId = typeof input.skillId === 'string' ? input.skillId.trim() : '';
  if (!provider || !skillId) {
    return null;
  }

  const before = normalizeStateSnapshot(input.before);
  const after = normalizeStateSnapshot(input.after);
  if (!before || !after) {
    return null;
  }

  const timestamp = input.timestamp;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || timestamp <= 0) {
    return null;
  }

  return {
    provider,
    skillId,
    before,
    after,
    timestamp,
  };
}

function normalizeSkillActivationAuditEvents(input: unknown): SkillActivationAuditEvent[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => normalizeSkillActivationAuditEvent(item))
    .filter((item): item is SkillActivationAuditEvent => item !== null)
    .sort((a, b) => b.timestamp - a.timestamp);
}

function createEmptyLogDocument(): SkillActivationAuditLogDocument {
  return {
    schemaVersion: SKILL_ACTIVATION_AUDIT_SCHEMA_VERSION,
    events: [],
  };
}

function normalizeAuditLogDocument(input: unknown): SkillActivationAuditLogDocument {
  if (!isRecord(input)) {
    return createEmptyLogDocument();
  }

  const schemaVersion =
    typeof input.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
      ? input.schemaVersion
      : SKILL_ACTIVATION_AUDIT_SCHEMA_VERSION;

  return {
    schemaVersion,
    events: normalizeSkillActivationAuditEvents(input.events),
  };
}

export function resolveSkillActivationAuditEventLimit(
  explicitLimit?: number,
  fallbackLimit = DEFAULT_SKILL_ACTIVATION_EVENT_LIMIT,
): number {
  const sourceLimit =
    typeof explicitLimit === 'number' && Number.isFinite(explicitLimit) && explicitLimit > 0
      ? Math.trunc(explicitLimit)
      : Math.trunc(fallbackLimit);

  if (!Number.isFinite(sourceLimit) || sourceLimit <= 0) {
    return DEFAULT_SKILL_ACTIVATION_EVENT_LIMIT;
  }

  return Math.min(Math.max(sourceLimit, 1), MAX_SKILL_ACTIVATION_EVENT_LIMIT);
}

export class FileSkillActivationAuditStore implements SkillActivationAuditStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly maxEntries = MAX_SKILL_ACTIVATION_EVENT_LIMIT,
  ) {}

  async append(event: SkillActivationAuditEvent): Promise<void> {
    const normalized = normalizeSkillActivationAuditEvent(event);
    if (!normalized) {
      throw new Error('Invalid skill activation audit event payload');
    }

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.readDocument();
      const maxEntries = resolveSkillActivationAuditEventLimit(this.maxEntries, this.maxEntries);
      const nextDocument: SkillActivationAuditLogDocument = {
        schemaVersion: SKILL_ACTIVATION_AUDIT_SCHEMA_VERSION,
        events: [normalized, ...current.events].slice(0, maxEntries),
      };
      await this.writeDocument(nextDocument);
    });

    return this.writeQueue;
  }

  async listRecent(
    limit = DEFAULT_SKILL_ACTIVATION_EVENT_LIMIT,
  ): Promise<SkillActivationAuditEvent[]> {
    await this.writeQueue;
    const document = await this.readDocument();
    const resolvedLimit = resolveSkillActivationAuditEventLimit(limit);
    return document.events.slice(0, resolvedLimit).map((event) => cloneEvent(event));
  }

  private async readDocument(): Promise<SkillActivationAuditLogDocument> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return normalizeAuditLogDocument(JSON.parse(raw));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return createEmptyLogDocument();
      }
      throw error;
    }
  }

  private async writeDocument(document: SkillActivationAuditLogDocument): Promise<void> {
    const normalizedPath = path.resolve(this.filePath);
    await fs.mkdir(path.dirname(normalizedPath), { recursive: true });

    const tempPath = `${normalizedPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(document, null, 2), 'utf-8');
    await fs.rename(tempPath, normalizedPath);
  }
}

export const NOOP_SKILL_ACTIVATION_AUDIT_STORE: SkillActivationAuditStore = {
  append: async () => {},
  listRecent: async () => [],
};
