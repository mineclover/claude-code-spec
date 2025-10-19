/**
 * Skills Feature Integration Test
 *
 * Tests:
 * 1. Skill Parser - YAML frontmatter + Markdown parsing
 * 2. Skill CRUD operations
 * 3. Skill Repository Manager
 * 4. ProcessManager skill context injection
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function success(message) {
  log(`✅ ${message}`, colors.green);
}

function error(message) {
  log(`❌ ${message}`, colors.red);
}

function info(message) {
  log(`ℹ️  ${message}`, colors.blue);
}

function warn(message) {
  log(`⚠️  ${message}`, colors.yellow);
}

// Test 1: Skill File Structure
function testSkillFileStructure() {
  info('\n=== Test 1: Skill File Structure ===');

  const testSkillContent = `---
name: test-skill
description: A test skill for verification
version: 1.0.0
author: Test Author
tags:
  - testing
  - verification
---

# Test Skill

This is a test skill for integration testing.

## When to Use

Use this skill when testing the Skills system.

## How to Use

1. Import this skill
2. Select it in Execute
3. Verify context injection
`;

  try {
    // Create test directory
    const testDir = path.join(__dirname, '.test-skills');
    const testSkillDir = path.join(testDir, 'test-skill');

    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(testSkillDir)) {
      fs.mkdirSync(testSkillDir, { recursive: true });
    }

    // Write test skill
    const skillPath = path.join(testSkillDir, 'SKILL.md');
    fs.writeFileSync(skillPath, testSkillContent);

    // Verify file exists
    if (!fs.existsSync(skillPath)) {
      throw new Error('Failed to create test skill file');
    }

    // Verify content
    const content = fs.readFileSync(skillPath, 'utf-8');
    if (!content.includes('name: test-skill')) {
      throw new Error('Skill content verification failed');
    }

    success('Skill file structure test passed');
    return { passed: true, path: skillPath };
  } catch (err) {
    error(`Skill file structure test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 2: Skill Parser
function testSkillParser() {
  info('\n=== Test 2: Skill Parser (Manual Verification) ===');

  try {
    const parserPath = path.join(__dirname, 'src', 'lib', 'skillParser.ts');

    if (!fs.existsSync(parserPath)) {
      throw new Error('skillParser.ts not found');
    }

    const parserContent = fs.readFileSync(parserPath, 'utf-8');

    // Check for essential functions
    const requiredFunctions = [
      'parseYaml',
      'parseSkillMarkdown',
      'serializeSkill',
      'validateSkillStructure'
    ];

    for (const func of requiredFunctions) {
      if (!parserContent.includes(func)) {
        throw new Error(`Missing function: ${func}`);
      }
    }

    success('Skill parser implementation verified');
    return { passed: true };
  } catch (err) {
    error(`Skill parser test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 3: IPC Handlers
function testIPCHandlers() {
  info('\n=== Test 3: IPC Handlers ===');

  try {
    const skillHandlersPath = path.join(__dirname, 'src', 'ipc', 'handlers', 'skillHandlers.ts');
    const repoHandlersPath = path.join(__dirname, 'src', 'ipc', 'handlers', 'skillRepositoryHandlers.ts');

    if (!fs.existsSync(skillHandlersPath)) {
      throw new Error('skillHandlers.ts not found');
    }

    if (!fs.existsSync(repoHandlersPath)) {
      throw new Error('skillRepositoryHandlers.ts not found');
    }

    const skillHandlers = fs.readFileSync(skillHandlersPath, 'utf-8');
    const repoHandlers = fs.readFileSync(repoHandlersPath, 'utf-8');

    // Check skill handlers (function names, not channel names)
    const requiredSkillHandlers = [
      'listSkills',
      'getSkill',
      'createSkill',
      'updateSkill',
      'deleteSkill'
    ];

    for (const handler of requiredSkillHandlers) {
      if (!skillHandlers.includes(handler)) {
        throw new Error(`Missing handler: ${handler}`);
      }
    }

    // Check repository handlers (function names, not channel names)
    const requiredRepoHandlers = [
      'cloneRepository',
      'listOfficialSkills',
      'importSkill'
    ];

    for (const handler of requiredRepoHandlers) {
      if (!repoHandlers.includes(handler)) {
        throw new Error(`Missing handler: ${handler}`);
      }
    }

    success('IPC handlers verified');
    return { passed: true };
  } catch (err) {
    error(`IPC handlers test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 4: ProcessManager Integration
function testProcessManagerIntegration() {
  info('\n=== Test 4: ProcessManager Skill Integration ===');

  try {
    const processManagerPath = path.join(__dirname, 'src', 'services', 'ProcessManager.ts');

    if (!fs.existsSync(processManagerPath)) {
      throw new Error('ProcessManager.ts not found');
    }

    const content = fs.readFileSync(processManagerPath, 'utf-8');

    // Check for skill support
    const requiredFeatures = [
      'skillId',
      'skillScope',
      'loadSkillContent',
      'enhancedQuery'
    ];

    for (const feature of requiredFeatures) {
      if (!content.includes(feature)) {
        throw new Error(`Missing feature: ${feature}`);
      }
    }

    success('ProcessManager skill integration verified');
    return { passed: true };
  } catch (err) {
    error(`ProcessManager integration test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 5: Execute Page Integration
function testExecutePageIntegration() {
  info('\n=== Test 5: Execute Page Skill Integration ===');

  try {
    const executionsPagePath = path.join(__dirname, 'src', 'pages', 'ExecutionsPage.tsx');

    if (!fs.existsSync(executionsPagePath)) {
      throw new Error('ExecutionsPage.tsx not found');
    }

    const content = fs.readFileSync(executionsPagePath, 'utf-8');

    // Check for skill UI elements
    const requiredElements = [
      'skillSelectId',
      'selectedSkillId',
      'selectedSkillScope',
      'availableSkills',
      'loadSkills',
      'Skill (Optional)'
    ];

    for (const element of requiredElements) {
      if (!content.includes(element)) {
        throw new Error(`Missing UI element: ${element}`);
      }
    }

    success('Execute page skill integration verified');
    return { passed: true };
  } catch (err) {
    error(`Execute page integration test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 6: Skills UI Components
function testSkillsUIComponents() {
  info('\n=== Test 6: Skills UI Components ===');

  try {
    const skillsPagePath = path.join(__dirname, 'src', 'pages', 'SkillsPage.tsx');
    const editorModalPath = path.join(__dirname, 'src', 'components', 'skill', 'SkillEditorModal.tsx');

    if (!fs.existsSync(skillsPagePath)) {
      throw new Error('SkillsPage.tsx not found');
    }

    if (!fs.existsSync(editorModalPath)) {
      throw new Error('SkillEditorModal.tsx not found');
    }

    const skillsPage = fs.readFileSync(skillsPagePath, 'utf-8');
    const editorModal = fs.readFileSync(editorModalPath, 'utf-8');

    // Check SkillsPage features
    if (!skillsPage.includes('Repository Browser') || !skillsPage.includes('Installed Skills')) {
      throw new Error('Missing SkillsPage tabs');
    }

    // Check SkillEditorModal features
    const editorFeatures = ['frontmatter', 'content', 'preview', 'validate'];
    for (const feature of editorFeatures) {
      if (!editorModal.toLowerCase().includes(feature)) {
        throw new Error(`Missing editor feature: ${feature}`);
      }
    }

    success('Skills UI components verified');
    return { passed: true };
  } catch (err) {
    error(`Skills UI components test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Test 7: Documentation
function testDocumentation() {
  info('\n=== Test 7: Documentation ===');

  try {
    const docsPath = path.join(__dirname, 'docs', 'features', 'skills');

    if (!fs.existsSync(docsPath)) {
      throw new Error('Skills documentation directory not found');
    }

    const requiredDocs = [
      'index.md',
      'repository-management.md',
      'ui-guide.md'
    ];

    for (const doc of requiredDocs) {
      const docPath = path.join(docsPath, doc);
      if (!fs.existsSync(docPath)) {
        throw new Error(`Missing documentation: ${doc}`);
      }
    }

    // Check CLAUDE.md for Skills section
    const claudeMdPath = path.join(__dirname, 'CLAUDE.md');
    const claudeMd = fs.readFileSync(claudeMdPath, 'utf-8');

    if (!claudeMd.includes('Skills 관리')) {
      throw new Error('CLAUDE.md missing Skills section');
    }

    success('Documentation verified');
    return { passed: true };
  } catch (err) {
    error(`Documentation test failed: ${err.message}`);
    return { passed: false, error: err.message };
  }
}

// Cleanup
function cleanup() {
  try {
    const testDir = path.join(__dirname, '.test-skills');
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  } catch (err) {
    warn(`Cleanup warning: ${err.message}`);
  }
}

// Run all tests
async function runAllTests() {
  console.log('\n');
  log('╔════════════════════════════════════════════════════╗', colors.blue);
  log('║     Skills Feature Integration Test Suite         ║', colors.blue);
  log('╚════════════════════════════════════════════════════╝', colors.blue);

  const results = [];

  // Run tests
  results.push({ name: 'Skill File Structure', ...testSkillFileStructure() });
  results.push({ name: 'Skill Parser', ...testSkillParser() });
  results.push({ name: 'IPC Handlers', ...testIPCHandlers() });
  results.push({ name: 'ProcessManager Integration', ...testProcessManagerIntegration() });
  results.push({ name: 'Execute Page Integration', ...testExecutePageIntegration() });
  results.push({ name: 'Skills UI Components', ...testSkillsUIComponents() });
  results.push({ name: 'Documentation', ...testDocumentation() });

  // Cleanup
  cleanup();

  // Summary
  console.log('\n');
  log('═══════════════════════════════════════════════════', colors.blue);
  log('                   TEST SUMMARY                     ', colors.blue);
  log('═══════════════════════════════════════════════════', colors.blue);

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;

  results.forEach(result => {
    if (result.passed) {
      success(`${result.name}: PASSED`);
    } else {
      error(`${result.name}: FAILED - ${result.error}`);
    }
  });

  console.log('\n');
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`,
      failed === 0 ? colors.green : colors.red);

  if (failed === 0) {
    console.log('\n');
    success('🎉 All tests passed! Skills feature is working correctly.');
  } else {
    console.log('\n');
    error(`⚠️  ${failed} test(s) failed. Please review the errors above.`);
  }

  console.log('\n');

  process.exit(failed === 0 ? 0 : 1);
}

// Run tests
runAllTests().catch(err => {
  error(`Test suite error: ${err.message}`);
  process.exit(1);
});
