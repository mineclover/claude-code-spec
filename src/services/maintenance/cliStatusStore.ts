/**
 * CLI Status Store
 * Persists discovered CLI tool state (versions, custom commands) to cli-status.json.
 * The file is user-accessible and editable.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { isRecord } from '../../lib/typeGuards';
import type { CliStatusDocument, CliToolStatus, CommandSpec } from '../../types/tool-maintenance';

const CLI_STATUS_SCHEMA_VERSION = 1;

function normalizeCommandSpec(raw: unknown): CommandSpec | undefined {
  if (!isRecord(raw)) return undefined;
  const command = typeof raw.command === 'string' ? raw.command.trim() : '';
  if (!command) return undefined;
  const args =
    Array.isArray(raw.args) && raw.args.every((a) => typeof a === 'string') ? raw.args : [];
  return { command, args };
}

function normalizeToolStatus(raw: unknown): CliToolStatus {
  if (!isRecord(raw)) return {};

  const status: CliToolStatus = {};

  if (typeof raw.lastKnownVersion === 'string' && raw.lastKnownVersion.trim()) {
    status.lastKnownVersion = raw.lastKnownVersion.trim();
  }

  if (
    typeof raw.lastCheckedAt === 'number' &&
    Number.isFinite(raw.lastCheckedAt) &&
    raw.lastCheckedAt > 0
  ) {
    status.lastCheckedAt = raw.lastCheckedAt;
  }

  if (isRecord(raw.customCommands)) {
    const customCommands: NonNullable<CliToolStatus['customCommands']> = {};
    let hasCustom = false;

    const versionCommand = normalizeCommandSpec(raw.customCommands.versionCommand);
    if (versionCommand) {
      customCommands.versionCommand = versionCommand;
      hasCustom = true;
    }

    const updateCommand = normalizeCommandSpec(raw.customCommands.updateCommand);
    if (updateCommand) {
      customCommands.updateCommand = updateCommand;
      hasCustom = true;
    }

    if (hasCustom) {
      status.customCommands = customCommands;
    }
  }

  return status;
}

function normalizeDocument(raw: unknown): CliStatusDocument {
  const empty: CliStatusDocument = { schemaVersion: CLI_STATUS_SCHEMA_VERSION, tools: {} };
  if (!isRecord(raw)) return empty;

  const schemaVersion =
    typeof raw.schemaVersion === 'number' && Number.isFinite(raw.schemaVersion)
      ? raw.schemaVersion
      : CLI_STATUS_SCHEMA_VERSION;

  const tools: Record<string, CliToolStatus> = {};
  if (isRecord(raw.tools)) {
    for (const [toolId, toolRaw] of Object.entries(raw.tools)) {
      tools[toolId] = normalizeToolStatus(toolRaw);
    }
  }

  return { schemaVersion, tools };
}

export interface CliStatusStore {
  readAll(): Promise<CliStatusDocument>;
  writeAll(doc: CliStatusDocument): Promise<void>;
  setToolStatus(toolId: string, status: Partial<CliToolStatus>): Promise<void>;
  getFilePath(): string;
}

export class FileCliStatusStore implements CliStatusStore {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  getFilePath(): string {
    return this.filePath;
  }

  async readAll(): Promise<CliStatusDocument> {
    return this.readDocument();
  }

  async writeAll(doc: CliStatusDocument): Promise<void> {
    this.writeQueue = this.writeQueue.then(() => this.writeDocument(doc));
    return this.writeQueue;
  }

  async setToolStatus(toolId: string, status: Partial<CliToolStatus>): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      const doc = await this.readDocument();
      const existing = doc.tools[toolId] ?? {};
      doc.tools[toolId] = { ...existing, ...status };
      await this.writeDocument(doc);
    });
    return this.writeQueue;
  }

  private async readDocument(): Promise<CliStatusDocument> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      return normalizeDocument(JSON.parse(raw));
    } catch (error) {
      const err = error as NodeJS.ErrnoException;
      if (err.code === 'ENOENT') {
        return { schemaVersion: CLI_STATUS_SCHEMA_VERSION, tools: {} };
      }
      throw error;
    }
  }

  private async writeDocument(doc: CliStatusDocument): Promise<void> {
    const normalizedPath = path.resolve(this.filePath);
    await fs.mkdir(path.dirname(normalizedPath), { recursive: true });
    const tempPath = `${normalizedPath}.tmp-${process.pid}-${Date.now()}`;
    await fs.writeFile(tempPath, JSON.stringify(doc, null, 2), 'utf-8');
    await fs.rename(tempPath, normalizedPath);
  }
}
