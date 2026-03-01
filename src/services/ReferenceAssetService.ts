import * as fs from 'node:fs';
import * as path from 'node:path';
import matter from 'gray-matter';
import type {
  ReferenceAssetItem,
  ReferenceAssetReadResult,
  ReferenceAssetType,
  ReferenceProvider,
} from '../types/reference-assets';

interface ResolvePathResult {
  success: boolean;
  absolutePath?: string;
  error?: string;
}

interface ProviderConfig {
  baseDir: string;
  roots: Record<ReferenceAssetType, string[]>;
}

const PROVIDER_CONFIG: Record<ReferenceProvider, ProviderConfig> = {
  moai: {
    baseDir: 'moai-adk-upstream',
    roots: {
      hooks: ['.claude/hooks'],
      outputStyles: ['.claude/output-styles'],
      skills: ['.claude/skills'],
    },
  },
  ralph: {
    baseDir: 'ralph-tui-upstream',
    roots: {
      hooks: ['src/tui/hooks'],
      outputStyles: ['website/styles', 'assets/themes'],
      skills: ['skills'],
    },
  },
};

const HOOK_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.sh', '.js', '.ts']);
const OUTPUT_STYLE_EXTENSIONS = new Set(['.md', '.json', '.yaml', '.yml', '.css', '.toml']);

function isAllowedExtension(assetType: ReferenceAssetType, filePath: string): boolean {
  const extension = path.extname(filePath).toLowerCase();
  if (assetType === 'hooks') {
    return HOOK_EXTENSIONS.has(extension);
  }
  if (assetType === 'outputStyles') {
    return OUTPUT_STYLE_EXTENSIONS.has(extension);
  }
  return true;
}

function ensureInsideRoot(rootDir: string, targetPath: string): boolean {
  const normalizedRoot = path.normalize(path.resolve(rootDir));
  const normalizedTarget = path.normalize(path.resolve(targetPath));
  return (
    normalizedTarget === normalizedRoot ||
    normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  );
}

function readDescriptionFromSkillFile(skillFilePath: string): string | undefined {
  try {
    const raw = fs.readFileSync(skillFilePath, 'utf-8');
    const parsed = matter(raw);
    const description = parsed.data?.description;
    if (typeof description === 'string' && description.trim().length > 0) {
      return description.trim();
    }
  } catch {}
  return undefined;
}

function walkFilesRecursive(dirPath: string, results: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFilesRecursive(entryPath, results);
      continue;
    }
    if (entry.isFile()) {
      results.push(entryPath);
    }
  }
}

export class ReferenceAssetService {
  constructor(private readonly referencesRoot = path.resolve(process.cwd(), 'references')) {}

  listAssets(assetType: ReferenceAssetType, provider?: ReferenceProvider): ReferenceAssetItem[] {
    const providers: ReferenceProvider[] = provider ? [provider] : ['moai', 'ralph'];
    const items: ReferenceAssetItem[] = [];

    for (const currentProvider of providers) {
      const config = PROVIDER_CONFIG[currentProvider];
      const providerBase = path.join(this.referencesRoot, config.baseDir);
      for (const root of config.roots[assetType]) {
        const sourceRootAbsolute = path.join(providerBase, root);
        if (!fs.existsSync(sourceRootAbsolute) || !fs.statSync(sourceRootAbsolute).isDirectory()) {
          continue;
        }

        if (assetType === 'skills') {
          this.collectSkillItems(
            items,
            currentProvider,
            assetType,
            sourceRootAbsolute,
            path.relative(this.referencesRoot, sourceRootAbsolute),
          );
        } else {
          this.collectFileItems(
            items,
            currentProvider,
            assetType,
            sourceRootAbsolute,
            path.relative(this.referencesRoot, sourceRootAbsolute),
          );
        }
      }
    }

    return items.sort((a, b) => {
      if (a.provider !== b.provider) return a.provider.localeCompare(b.provider);
      return a.relativePath.localeCompare(b.relativePath);
    });
  }

  readAsset(relativePath: string): ReferenceAssetReadResult {
    try {
      const resolved = this.resolveAssetPath(relativePath);
      if (!resolved.success || !resolved.absolutePath) {
        return { success: false, error: resolved.error ?? 'Failed to resolve path' };
      }

      const content = fs.readFileSync(resolved.absolutePath, 'utf-8');
      return { success: true, content };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read reference asset',
      };
    }
  }

  getAssetAbsolutePath(relativePath: string): ResolvePathResult {
    return this.resolveAssetPath(relativePath);
  }

  private collectFileItems(
    items: ReferenceAssetItem[],
    provider: ReferenceProvider,
    type: ReferenceAssetType,
    sourceRootAbsolute: string,
    sourceRootRelative: string,
  ): void {
    const files: string[] = [];
    walkFilesRecursive(sourceRootAbsolute, files);
    for (const filePath of files) {
      if (!isAllowedExtension(type, filePath)) {
        continue;
      }
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(this.referencesRoot, filePath);
      items.push({
        id: `${provider}:${type}:${relativePath}`,
        provider,
        type,
        name: path.basename(filePath),
        relativePath,
        sourceRoot: sourceRootRelative,
        updatedAt: stats.mtimeMs,
      });
    }
  }

  private collectSkillItems(
    items: ReferenceAssetItem[],
    provider: ReferenceProvider,
    type: ReferenceAssetType,
    sourceRootAbsolute: string,
    sourceRootRelative: string,
  ): void {
    const files: string[] = [];
    walkFilesRecursive(sourceRootAbsolute, files);
    for (const filePath of files) {
      if (path.basename(filePath) !== 'SKILL.md') {
        continue;
      }
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(this.referencesRoot, filePath);
      items.push({
        id: `${provider}:${type}:${relativePath}`,
        provider,
        type,
        name: path.basename(path.dirname(filePath)),
        description: readDescriptionFromSkillFile(filePath),
        relativePath,
        sourceRoot: sourceRootRelative,
        updatedAt: stats.mtimeMs,
      });
    }
  }

  private resolveAssetPath(relativePath: string): ResolvePathResult {
    const trimmed = relativePath.trim();
    if (!trimmed) {
      return { success: false, error: 'Path is empty' };
    }

    const targetPath = path.resolve(this.referencesRoot, trimmed);
    if (!ensureInsideRoot(this.referencesRoot, targetPath)) {
      return { success: false, error: 'Path is outside references root' };
    }

    if (!fs.existsSync(targetPath) || !fs.statSync(targetPath).isFile()) {
      return { success: false, error: 'Reference file not found' };
    }

    return { success: true, absolutePath: targetPath };
  }
}
