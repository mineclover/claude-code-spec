import * as os from 'node:os';
import * as path from 'node:path';

const ENV_TEMPLATE_REGEX = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export function resolvePathTemplate(
  input: string,
  env: NodeJS.ProcessEnv = process.env,
  homeDir = os.homedir(),
): string {
  const resolved = input.replace(ENV_TEMPLATE_REGEX, (_token, variableName: string) => {
    const value = env[variableName];
    return typeof value === 'string' ? value : '';
  });

  if (resolved === '~') {
    return homeDir;
  }
  if (resolved.startsWith('~/')) {
    return path.join(homeDir, resolved.slice(2));
  }
  return resolved;
}

export function normalizeDir(input: string, env: NodeJS.ProcessEnv = process.env): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  return resolvePathTemplate(trimmed, env);
}

export function defaultDisabledRoot(installRoot: string): string {
  const base = path.basename(installRoot);
  if (base.endsWith('skills')) {
    return path.join(path.dirname(installRoot), `${base}-disabled`);
  }
  return `${installRoot}-disabled`;
}
