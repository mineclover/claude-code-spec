/**
 * Final test for getUserQuestions - should only show actual user questions
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectPath = '/Users/junwoobang/project/claude-code-spec';
const sessionId = '2e3d94ab-a4c0-4c5b-aaff-07dedd37f39e';

const pathToDashFormat = (fsPath) => {
  return `-${fsPath.replace(/^\//, '').replace(/\//g, '-')}`;
};

const getClaudeProjectDir = (projectPath) => {
  const dashName = pathToDashFormat(projectPath);
  return path.join(os.homedir(), '.claude', 'projects', dashName);
};

const readSessionLog = (projectPath, sessionId) => {
  const projectDir = getClaudeProjectDir(projectPath);
  const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFile)) {
    return [];
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    return [];
  }
};

// FINAL: Improved getUserQuestions
const getUserQuestions = (projectPath, sessionId) => {
  const entries = readSessionLog(projectPath, sessionId);

  return entries.filter((entry) => {
    if (entry.message && typeof entry.message === 'object') {
      const message = entry.message;

      if (message.role !== 'user') {
        return false;
      }

      // Only process string content
      if (typeof message.content !== 'string') {
        return false;
      }

      const content = message.content.trim();

      // Skip anything that starts with [{ - these are tool results or structured data
      if (content.startsWith('[{')) {
        return false;
      }

      // Skip system messages
      if (content.startsWith('Caveat:')) {
        return false;
      }

      // Skip command messages
      if (content.includes('<command-name>') || content.includes('<command-message>')) {
        return false;
      }

      // Skip empty stdout
      if (content === '<local-command-stdout></local-command-stdout>') {
        return false;
      }

      return true;
    }
    return false;
  });
};

console.log('=== FINAL TEST: getUserQuestions ===\n');
console.log(`Session: ${sessionId}\n`);

const userQuestions = getUserQuestions(projectPath, sessionId);

console.log(`✅ Total actual user questions: ${userQuestions.length}\n`);
console.log('=== User Questions ===\n');

userQuestions.forEach((entry, idx) => {
  console.log(`[${idx + 1}] ${entry.message.content.substring(0, 150)}`);
  console.log('');
});
