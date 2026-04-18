/**
 * FingerprintService - computes the static prefix fingerprint.
 *
 * "Static" = what the execution will feed into the CLI prefix, as best we can
 * determine before the process starts. Each contributing component gets its
 * own sub-hash so drift against the observed fingerprint (from system/init)
 * can be localized.
 *
 * Component definitions:
 *   - claudeMd            : project <root>/CLAUDE.md + user ~/.claude/CLAUDE.md
 *   - imports             : files referenced by @path/to/file.md tokens found
 *                           in the CLAUDE.md files (best-effort, 1-hop)
 *   - skills              : <root>/.claude/skills/* /SKILL.md plus user-level
 *   - agents              : <root>/.claude/agents/**.md plus user-level
 *   - mcpResolved         : canonical JSON of the MCP config at mcpConfigPath
 *                           (empty when MCP disabled)
 *   - systemPromptVersion : fixed marker for now; upgraded when we detect CLI
 *                           version from spawn output
 *
 * The service is pure with respect to the file system: it only reads, never
 * mutates.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sha256Hex, sha256OfCanonicalJson, sha256OfNamedContents } from '../lib/prefixHashing';
import type { StaticComponentHashes, StaticFingerprint } from '../types/prefix-fingerprint';

/** Regex capturing @-imports. Matches `@` followed by a non-whitespace path. */
const IMPORT_TOKEN = /(?:^|\s)@([^\s`]+)/g;

/** Current fingerprint schema marker; bump if component set changes. */
const FINGERPRINT_SCHEMA_VERSION = 'v1';

export interface StaticFingerprintInput {
  projectPath: string;
  /** Path to a resolved --mcp-config file; null/undefined when MCP is off. */
  mcpConfigPath?: string | null;
  /** Optional override for user home. Exposed for tests. */
  homeDir?: string;
}

export class FingerprintService {
  computeStatic(input: StaticFingerprintInput): StaticFingerprint {
    const home = input.homeDir ?? os.homedir();

    const claudeMdPaths = this.discoverClaudeMdPaths(input.projectPath, home);
    const claudeMdContents = claudeMdPaths.map((p) => this.readFileSafe(p));
    const claudeMdHash = sha256OfNamedContents(
      claudeMdPaths.map((p, i) => ({ id: p, content: claudeMdContents[i] ?? '' })),
    );

    const importPaths = this.collectImportPaths(claudeMdPaths, claudeMdContents);
    const imports = importPaths.map((p) => ({ id: p, content: this.readFileSafe(p) }));
    const importsHash = sha256OfNamedContents(imports);

    const skillIds = this.enumerateSkills(input.projectPath, home);
    const skills = skillIds.map((p) => ({ id: p, content: this.readFileSafe(p) }));
    const skillsHash = sha256OfNamedContents(skills);

    const agentIds = this.enumerateAgents(input.projectPath, home);
    const agents = agentIds.map((p) => ({ id: p, content: this.readFileSafe(p) }));
    const agentsHash = sha256OfNamedContents(agents);

    const mcpConfigPath = input.mcpConfigPath ?? null;
    const mcpResolvedHash = this.hashMcpConfig(mcpConfigPath);

    const systemPromptVersionHash = sha256Hex(FINGERPRINT_SCHEMA_VERSION);

    const components: StaticComponentHashes = {
      claudeMd: claudeMdHash,
      imports: importsHash,
      skills: skillsHash,
      agents: agentsHash,
      mcpResolved: mcpResolvedHash,
      systemPromptVersion: systemPromptVersionHash,
    };

    const total = sha256OfCanonicalJson(components);

    return {
      kind: 'static',
      total,
      components,
      sources: {
        claudeMdPath: claudeMdPaths[0] ?? null,
        importPaths,
        skillIds,
        agentIds,
        mcpConfigPath,
      },
      computedAt: Date.now(),
    };
  }

  private discoverClaudeMdPaths(projectPath: string, home: string): string[] {
    const candidates = [
      path.join(projectPath, 'CLAUDE.md'),
      path.join(projectPath, '.claude', 'CLAUDE.md'),
      path.join(home, '.claude', 'CLAUDE.md'),
    ];
    return candidates.filter((p) => this.fileExists(p));
  }

  private collectImportPaths(claudeMdPaths: string[], contents: string[]): string[] {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (let i = 0; i < claudeMdPaths.length; i++) {
      const host = claudeMdPaths[i];
      const body = contents[i] ?? '';
      const hostDir = path.dirname(host);
      for (const match of body.matchAll(IMPORT_TOKEN)) {
        const raw = match[1];
        if (!raw) continue;
        const normalized = this.normalizeImportPath(raw, hostDir);
        if (!normalized || seen.has(normalized)) continue;
        if (!this.fileExists(normalized)) continue;
        seen.add(normalized);
        ordered.push(normalized);
      }
    }
    ordered.sort();
    return ordered;
  }

  private normalizeImportPath(raw: string, hostDir: string): string | null {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    // Strip trailing punctuation common in prose (periods, commas, quotes, backticks).
    const cleaned = trimmed.replace(/[.,;:'"`)\]]+$/, '');
    if (!cleaned) return null;
    if (cleaned.startsWith('~/')) {
      return path.join(os.homedir(), cleaned.slice(2));
    }
    if (path.isAbsolute(cleaned)) {
      return cleaned;
    }
    return path.resolve(hostDir, cleaned);
  }

  private enumerateSkills(projectPath: string, home: string): string[] {
    const roots = [
      path.join(projectPath, '.claude', 'skills'),
      path.join(home, '.claude', 'skills'),
    ];
    const found: string[] = [];
    for (const root of roots) {
      if (!this.dirExists(root)) continue;
      for (const dir of this.readDirSafe(root)) {
        const skillFile = path.join(root, dir, 'SKILL.md');
        if (this.fileExists(skillFile)) {
          found.push(skillFile);
        }
      }
    }
    found.sort();
    return found;
  }

  private enumerateAgents(projectPath: string, home: string): string[] {
    const roots = [
      path.join(projectPath, '.claude', 'agents'),
      path.join(home, '.claude', 'agents'),
    ];
    const found: string[] = [];
    for (const root of roots) {
      if (!this.dirExists(root)) continue;
      this.walkMarkdown(root, found);
    }
    found.sort();
    return found;
  }

  private walkMarkdown(dir: string, accumulator: string[]): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkMarkdown(full, accumulator);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        accumulator.push(full);
      }
    }
  }

  private hashMcpConfig(mcpConfigPath: string | null): string {
    if (!mcpConfigPath) return '';
    try {
      const raw = fs.readFileSync(mcpConfigPath, 'utf-8');
      const parsed = JSON.parse(raw) as unknown;
      return sha256OfCanonicalJson(parsed);
    } catch {
      return '';
    }
  }

  private fileExists(p: string): boolean {
    try {
      return fs.statSync(p).isFile();
    } catch {
      return false;
    }
  }

  private dirExists(p: string): boolean {
    try {
      return fs.statSync(p).isDirectory();
    } catch {
      return false;
    }
  }

  private readDirSafe(p: string): string[] {
    try {
      return fs.readdirSync(p);
    } catch {
      return [];
    }
  }

  private readFileSafe(p: string): string {
    try {
      return fs.readFileSync(p, 'utf-8');
    } catch {
      return '';
    }
  }
}

export const fingerprintService = new FingerprintService();
