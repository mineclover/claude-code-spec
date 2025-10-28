/**
 * Test script to verify improved getUserQuestions functionality
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

// IMPROVED: Get user questions from session log (excluding tool results)
const getUserQuestions = (projectPath, sessionId) => {
  const entries = readSessionLog(projectPath, sessionId);

  return entries.filter((entry) => {
    // Check if entry has a message with role 'user'
    if (entry.message && typeof entry.message === 'object') {
      const message = entry.message;

      if (message.role !== 'user') {
        return false;
      }

      // Exclude tool results - they start with [{"tool_use_id" or [{"type":"tool_result"
      if (typeof message.content === 'string') {
        const content = message.content.trim();

        // Skip tool results
        if (
          content.startsWith('[{') &&
          (content.includes('tool_use_id') || content.includes('tool_result'))
        ) {
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

      // If content is not a string, include it (could be structured content)
      return true;
    }
    return false;
  });
};

// Test the function
console.log('=== Testing IMPROVED getUserQuestions ===\n');
console.log(`Project: ${projectPath}`);
console.log(`Session ID: ${sessionId}\n`);

const userQuestions = getUserQuestions(projectPath, sessionId);

console.log(`Total entries in session: ${readSessionLog(projectPath, sessionId).length}`);
console.log(`Filtered user questions: ${userQuestions.length}\n`);

console.log('=== Actual User Questions (Tool Results Excluded) ===\n');

userQuestions.forEach((entry, idx) => {
  const content = entry.message.content;
  console.log(`\n[Question ${idx + 1}]`);
  console.log(
    `Content: ${typeof content === 'string' ? content.substring(0, 300) : JSON.stringify(content).substring(0, 300)}`,
  );
  console.log('---');
});

console.log(`\n✅ Total actual user questions: ${userQuestions.length}`);
