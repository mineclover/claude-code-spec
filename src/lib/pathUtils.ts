import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Convert Claude project directory name to actual file system path
 * Example: "-Users-junwoobang-project-claude-code-spec" -> "/Users/junwoobang/project/claude-code-spec"
 */
export function parseProjectPath(projectDirName: string): string {
  // Remove leading dash and replace remaining dashes with slashes
  const withoutLeadingDash = projectDirName.startsWith('-')
    ? projectDirName.slice(1)
    : projectDirName;

  // Replace dashes with path separator
  return `/${withoutLeadingDash.split('-').join('/')}`;
}

/**
 * Get all Claude project paths from ~/.claude/projects
 */
export function getClaudeProjects(): Array<{ dirName: string; actualPath: string }> {
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

  if (!fs.existsSync(claudeProjectsDir)) {
    return [];
  }

  try {
    const dirs = fs
      .readdirSync(claudeProjectsDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    return dirs.map((dirName) => ({
      dirName,
      actualPath: parseProjectPath(dirName),
    }));
  } catch (error) {
    console.error('Error reading Claude projects:', error);
    return [];
  }
}

/**
 * Find project path by matching against known Claude projects
 */
export function findProjectPath(sessionId: string): string | null {
  const projects = getClaudeProjects();

  // Try to match session ID or project name
  const match = projects.find(
    (p) => sessionId.includes(p.dirName) || p.dirName.includes(sessionId),
  );

  return match ? match.actualPath : null;
}
