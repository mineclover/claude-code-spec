/**
 * Test script to verify getUserQuestions functionality
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const projectPath = '/Users/junwoobang/project/claude-code-spec';
const sessionId = '2e3d94ab-a4c0-4c5b-aaff-07dedd37f39e';

// Convert path to dash format
const pathToDashFormat = (fsPath) => {
  return `-${fsPath.replace(/^\//, '').replace(/\//g, '-')}`;
};

// Get session file path
const getClaudeProjectDir = (projectPath) => {
  const dashName = pathToDashFormat(projectPath);
  return path.join(os.homedir(), '.claude', 'projects', dashName);
};

// Read session log
const readSessionLog = (projectPath, sessionId) => {
  const projectDir = getClaudeProjectDir(projectPath);
  const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);

  if (!fs.existsSync(sessionFile)) {
    console.warn(`Session file not found: ${sessionFile}`);
    return [];
  }

  try {
    const content = fs.readFileSync(sessionFile, 'utf-8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line));
  } catch (error) {
    console.error('Failed to read session log:', error);
    return [];
  }
};

// Get user questions from session log
const getUserQuestions = (projectPath, sessionId) => {
  const entries = readSessionLog(projectPath, sessionId);

  return entries.filter((entry) => {
    // Check if entry has a message with role 'user'
    if (entry.message && typeof entry.message === 'object') {
      const message = entry.message;
      return message.role === 'user';
    }
    return false;
  });
};

// Test the function
console.log('=== Testing getUserQuestions ===\n');
console.log(`Project: ${projectPath}`);
console.log(`Session ID: ${sessionId}\n`);

const userQuestions = getUserQuestions(projectPath, sessionId);

console.log(`Total entries in session: ${readSessionLog(projectPath, sessionId).length}`);
console.log(`User questions found: ${userQuestions.length}\n`);

console.log('=== User Questions ===\n');

let actualUserQuestions = 0;
userQuestions.forEach((entry, _idx) => {
  const content = entry.message.content;

  // Skip tool results
  if (typeof content === 'string' && content.startsWith('[{"tool_use_id')) {
    return;
  }

  // Skip system messages
  if (typeof content === 'string' && content.startsWith('Caveat:')) {
    return;
  }

  // Skip command messages
  if (typeof content === 'string' && content.includes('<command-name>')) {
    return;
  }

  // Skip empty stdout
  if (typeof content === 'string' && content === '<local-command-stdout></local-command-stdout>') {
    return;
  }

  actualUserQuestions++;
  console.log(`\n[Question ${actualUserQuestions}]`);
  console.log(`Type: ${entry.type}`);
  console.log(
    `Content: ${typeof content === 'string' ? content.substring(0, 200) : JSON.stringify(content).substring(0, 200)}`,
  );
  console.log('---');
});

console.log(
  `\n\nActual user questions (excluding tool results and system messages): ${actualUserQuestions}`,
);
