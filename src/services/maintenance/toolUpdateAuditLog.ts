import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isRecord } from '../../lib/typeGuards';
import type { CliToolUpdateLogEntry } from '../../types/tool-maintenance';

const TOOL_UPDATE_AUDIT_SCHEMA_VERSION = 1;
const DEFAULT_TOOL_UPDATE_LOG_LIMIT = 20;
const MAX_TOOL_UPDATE_LOG_LIMIT = 200;

interface ToolUpdateAuditLogDocument {
  schemaVersion: number;
  entries: CliToolUpdateLogEntry[];
}

export interface ToolUpdateLogQuery {
  limit?: number;
  toolId?: string;
  batchId?: string;
}

export interface ToolUpdateAuditStore {
  append(entry: CliToolUpdateLogEntry): Promise<void>;
  listRecent(query?: ToolUpdateLogQuery): Promise<CliToolUpdateLogEntry[]>;
}

function cloneEntry(entry: CliToolUpdateLogEntry): CliToolUpdateLogEntry {
  return {
    logId: entry.logId,
    batchId: entry.batchId,
    toolId: entry.toolId,
    success: entry.success,
    command: [...entry.command],
    exitCode: entry.exitCode,
    stdout: entry.stdout,
    stderr: entry.stderr,
    startedAt: entry.startedAt,
    completedAt: entry.completedAt,
    error: entry.error,
  };
}

function normalizeCommand(input: unknown): string[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const command = input.map((item) => (typeof item === 'string' ? item.trim() : ''));
  if (command.length === 0 || command.some((item) => item.length === 0)) {
    return null;
  }

  return command;
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBatchId(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const normalized = normalizeOptionalString(value);
  return normalized ?? null;
}

function normalizeToolUpdateLogEntry(input: unknown): CliToolUpdateLogEntry | null {
  if (!isRecord(input)) {
    return null;
  }

  const logId = normalizeOptionalString(input.logId);
  const toolId = normalizeOptionalString(input.toolId);
  if (!logId || !toolId) {
    return null;
  }

  const success = input.success;
  if (typeof success !== 'boolean') {
    return null;
  }

  const command = normalizeCommand(input.command);
  if (!command) {
    return null;
  }

  const exitCode = input.exitCode;
  const normalizedExitCode =
    typeof exitCode === 'number' && Number.isFinite(exitCode) ? Math.trunc(exitCode) : null;
  if (exitCode !== null && normalizedExitCode === null) {
    return null;
  }

  if (typeof input.stdout !== 'string' || typeof input.stderr !== 'string') {
    return null;
  }

  const startedAt = input.startedAt;
  const completedAt = input.completedAt;
  if (
    typeof startedAt !== 'number' ||
    !Number.isFinite(startedAt) ||
    startedAt <= 0 ||
    typeof completedAt !== 'number' ||
    !Number.isFinite(completedAt) ||
    completedAt <= 0
  ) {
    return null;
  }

  return {
    logId,
    batchId: normalizeBatchId(input.batchId),
    toolId,
    success,
    command,
    exitCode: normalizedExitCode,
    stdout: input.stdout,
    stderr: input.stderr,
    startedAt,
    completedAt,
    error: normalizeOptionalString(input.error),
  };
}

function normalizeToolUpdateLogEntries(input: unknown): CliToolUpdateLogEntry[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => normalizeToolUpdateLogEntry(entry))
    .filter((entry): entry is CliToolUpdateLogEntry => entry !== null)
    .sort((a, b) => b.completedAt - a.completedAt);
}

function createEmptyLogDocument(): ToolUpdateAuditLogDocument {
  return {
    schemaVersion: TOOL_UPDATE_AUDIT_SCHEMA_VERSION,
    entries: [],
  };
}

function normalizeAuditLogDocument(input: unknown): ToolUpdateAuditLogDocument {
  if (!isRecord(input)) {
    return createEmptyLogDocument();
  }

  const schemaVersion =
    typeof input.schemaVersion === 'number' && Number.isFinite(input.schemaVersion)
      ? input.schemaVersion
      : TOOL_UPDATE_AUDIT_SCHEMA_VERSION;

  return {
    schemaVersion,
    entries: normalizeToolUpdateLogEntries(input.entries),
  };
}

export function resolveToolUpdateLogLimit(
  explicitLimit?: number,
  fallbackLimit = DEFAULT_TOOL_UPDATE_LOG_LIMIT,
): number {
  const sourceLimit =
    typeof explicitLimit === 'number' && Number.isFinite(explicitLimit) && explicitLimit > 0
      ? Math.trunc(explicitLimit)
      : Math.trunc(fallbackLimit);

  if (!Number.isFinite(sourceLimit) || sourceLimit <= 0) {
    return DEFAULT_TOOL_UPDATE_LOG_LIMIT;
  }

  return Math.min(Math.max(sourceLimit, 1), MAX_TOOL_UPDATE_LOG_LIMIT);
}

export class FileToolUpdateAuditStore implements ToolUpdateAuditStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath: string,
    private readonly maxEntries = MAX_TOOL_UPDATE_LOG_LIMIT,
  ) {}

  async append(entry: CliToolUpdateLogEntry): Promise<void> {
    const normalized = normalizeToolUpdateLogEntry(entry);
    if (!normalized) {
      throw new Error('Invalid tool update audit entry payload');
    }

    this.writeQueue = this.writeQueue.then(async () => {
      const current = await this.readDocument();
      const maxEntries = resolveToolUpdateLogLimit(this.maxEntries, this.maxEntries);
      const nextDocument: ToolUpdateAuditLogDocument = {
        schemaVersion: TOOL_UPDATE_AUDIT_SCHEMA_VERSION,
        entries: [normalized, ...current.entries].slice(0, maxEntries),
      };
      await this.writeDocument(nextDocument);
    });

    return this.writeQueue;
  }

  async listRecent(query: ToolUpdateLogQuery = {}): Promise<CliToolUpdateLogEntry[]> {
    await this.writeQueue;
    const document = await this.readDocument();
    const resolvedLimit = resolveToolUpdateLogLimit(query.limit);
    const normalizedToolId = normalizeOptionalString(query.toolId);
    const normalizedBatchId = normalizeOptionalString(query.batchId);

    const filtered = document.entries.filter((entry) => {
      if (normalizedToolId && entry.toolId !== normalizedToolId) {
        return false;
      }
      if (normalizedBatchId && entry.batchId !== normalizedBatchId) {
        return false;
      }
      return true;
    });

    return filtered.slice(0, resolvedLimit).map((entry) => cloneEntry(entry));
  }

  private async readDocument(): Promise<ToolUpdateAuditLogDocument> {
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

  private async writeDocument(document: ToolUpdateAuditLogDocument): Promise<void> {
    const normalizedPath = path.resolve(this.filePath);
    await fs.mkdir(path.dirname(normalizedPath), { recursive: true });

    const tempPath = `${normalizedPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(document, null, 2), 'utf-8');
    await fs.rename(tempPath, normalizedPath);
  }
}

export const NOOP_TOOL_UPDATE_AUDIT_STORE: ToolUpdateAuditStore = {
  append: async () => {},
  listRecent: async () => [],
};
