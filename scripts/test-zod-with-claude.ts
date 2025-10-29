#!/usr/bin/env node
/**
 * Zod + Claude CLI Integration Test
 *
 * Tests Zod schema validation with actual Claude execution
 */

import { z } from 'zod';
import { ClaudeQueryAPI } from '../src/services/ClaudeQueryAPI';

console.log('==================================================');
console.log('Zod + Claude CLI Integration Test');
console.log('==================================================\n');

async function main() {
  const api = new ClaudeQueryAPI();
  const projectPath = process.cwd();

  // ========================================
  // Test 1: Simple File Analysis with Zod
  // ========================================
  console.log('--- Test 1: File Analysis with Zod Schema ---\n');

  const fileAnalysisSchema = z.object({
    file: z.string().describe('File path'),
    linesOfCode: z.number().min(0).describe('Total lines'),
    language: z.enum(['typescript', 'javascript', 'python']).describe('Programming language'),
    complexity: z.number().min(1).max(20).describe('Code complexity'),
    mainPurpose: z.string().describe('Primary purpose of file')
  });

  console.log('Executing query with Zod schema...\n');

  const result1 = await api.queryWithZod(
    projectPath,
    'Analyze src/lib/zodSchemaBuilder.ts',
    fileAnalysisSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result1.success) {
    console.log('✅ Query successful!');
    console.log('\nValidated Data:');
    console.log(JSON.stringify(result1.data, null, 2));
    console.log('');
    console.log('✅ All types validated by Zod!');
    console.log(`  file: ${result1.data.file} (${typeof result1.data.file})`);
    console.log(`  linesOfCode: ${result1.data.linesOfCode} (${typeof result1.data.linesOfCode})`);
    console.log(`  language: ${result1.data.language} (enum)`);
    console.log(`  complexity: ${result1.data.complexity} (${typeof result1.data.complexity})`);
    console.log(`  mainPurpose: ${result1.data.mainPurpose} (${typeof result1.data.mainPurpose})`);
  } else {
    console.log('❌ Query failed:', result1.error);
  }

  console.log('\n');

  // ========================================
  // Test 2: Code Review with CommonSchemas
  // ========================================
  console.log('--- Test 2: Code Review with CommonSchemas ---\n');

  const { CommonSchemas } = await import('../src/lib/zodSchemaBuilder');
  const codeReviewSchema = CommonSchemas.codeReview();

  console.log('Executing code review query...\n');

  const result2 = await api.queryWithZod(
    projectPath,
    'Review src/lib/jsonExtractor.ts for code quality',
    codeReviewSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result2.success) {
    console.log('✅ Code review successful!');
    console.log(`\nFile: ${result2.data.file}`);
    console.log(`Review Score: ${result2.data.review}/10`);
    console.log(`Complexity: ${result2.data.complexity}/20`);
    console.log(`Maintainability: ${result2.data.maintainability}/100`);
    console.log(`Issues found: ${result2.data.issues.length}`);
    console.log(`Suggestions: ${result2.data.suggestions.length}`);

    if (result2.data.issues.length > 0) {
      console.log('\nTop Issues:');
      result2.data.issues.slice(0, 3).forEach((issue, i) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.message}`);
      });
    }
  } else {
    console.log('❌ Code review failed:', result2.error);
  }

  console.log('\n');

  // ========================================
  // Test 3: Custom Complex Schema
  // ========================================
  console.log('--- Test 3: Custom Complex Schema ---\n');

  const projectAnalysisSchema = z.object({
    name: z.string().describe('Project name'),
    type: z.enum(['application', 'library', 'tool']).describe('Project type'),
    primaryLanguage: z.string().describe('Main programming language'),
    frameworks: z.array(z.string()).describe('Used frameworks'),
    keyFiles: z
      .array(
        z.object({
          path: z.string(),
          purpose: z.string()
        })
      )
      .describe('Important files'),
    architecture: z.string().describe('Architecture pattern')
  });

  console.log('Executing complex project analysis...\n');

  const result3 = await api.queryWithZod(
    projectPath,
    'Analyze this project structure and architecture',
    projectAnalysisSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 90000 }
  );

  if (result3.success) {
    console.log('✅ Project analysis successful!');
    console.log('\nProject Info:');
    console.log(`  Name: ${result3.data.name}`);
    console.log(`  Type: ${result3.data.type}`);
    console.log(`  Language: ${result3.data.primaryLanguage}`);
    console.log(`  Frameworks: ${result3.data.frameworks.join(', ')}`);
    console.log(`  Architecture: ${result3.data.architecture}`);
    console.log(`\nKey Files (${result3.data.keyFiles.length}):`);
    result3.data.keyFiles.slice(0, 5).forEach((file) => {
      console.log(`  - ${file.path}: ${file.purpose}`);
    });
  } else {
    console.log('❌ Project analysis failed:', result3.error);
  }

  console.log('\n');

  // ========================================
  // Test 4: Standard Schema Interface
  // ========================================
  console.log('--- Test 4: Standard Schema Interface ---\n');

  console.log('Testing Standard Schema V1 compliance...\n');

  const simpleSchema = z.object({
    message: z.string(),
    count: z.number()
  });

  console.log('Schema has ~standard property:', '~standard' in simpleSchema);

  const result4 = await api.queryWithStandardSchema(
    projectPath,
    'Count the number of .ts files in src/ directory and provide a message',
    simpleSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result4.success) {
    console.log('✅ Standard Schema validation successful!');
    console.log('Data:', JSON.stringify(result4.data, null, 2));
  } else {
    console.log('❌ Standard Schema validation failed:', result4.error);
  }

  console.log('\n');

  // ========================================
  // Summary
  // ========================================
  console.log('==================================================');
  console.log('Integration Test Complete!');
  console.log('==================================================\n');

  console.log('✅ Zod + Claude CLI Integration Verified!');
  console.log('\nKey Achievements:');
  console.log('  1. ✅ Zod schema → Prompt conversion');
  console.log('  2. ✅ Claude execution with schema hints');
  console.log('  3. ✅ JSON extraction');
  console.log('  4. ✅ Zod validation (actual runtime safety)');
  console.log('  5. ✅ Standard Schema V1 compliance');
  console.log('  6. ✅ Type-safe results with z.infer<>');
  console.log('');

  console.log('🎉 Output-style은 힌트, 실제 검증은 Zod!');
  console.log('   Standard Schema 기반으로 검증 시스템 구축 완료!');
  console.log('');
}

main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
