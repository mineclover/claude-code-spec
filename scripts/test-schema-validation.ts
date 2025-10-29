#!/usr/bin/env tsx
/**
 * Schema Validation Test
 *
 * Tests dynamic schema injection and validation
 */

import { ClaudeQueryAPI } from '../src/services/ClaudeQueryAPI';
import {
  buildSchemaPrompt,
  CommonSchemas,
  schema,
  string,
  number,
  array,
  enumField
} from '../src/lib/schemaBuilder';

async function main() {
  const api = new ClaudeQueryAPI();
  const projectPath = process.cwd();

  console.log('==================================================');
  console.log('Schema Validation Tests');
  console.log('==================================================\n');

  // ========================================
  // Test 1: Built Schema Prompt
  // ========================================
  console.log('\n--- Test 1: Schema Prompt Builder ---\n');

  const codeReviewSchema = CommonSchemas.codeReview();
  const prompt = buildSchemaPrompt(codeReviewSchema, 'Analyze src/services/TaskRouter.ts');

  console.log('Generated Prompt:');
  console.log('---');
  console.log(prompt);
  console.log('---\n');

  // ========================================
  // Test 2: Simple Custom Schema
  // ========================================
  console.log('\n--- Test 2: Custom Schema Query ---\n');

  const customSchema = schema({
    file: string('File path analyzed'),
    linesOfCode: number('Total lines', { min: 0 }),
    language: enumField(['typescript', 'javascript', 'python'], 'Programming language'),
    hasTests: string('Whether tests exist'),
    dependencies: array('string', 'External dependencies')
  });

  console.log('Schema:', JSON.stringify(customSchema, null, 2));
  console.log('\nExecuting query with schema...\n');

  const result1 = await api.queryWithSchema(
    projectPath,
    'Analyze src/services/ClaudeQueryAPI.ts',
    customSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result1.success) {
    console.log('✅ Schema query successful!');
    console.log('Data:', JSON.stringify(result1.data, null, 2));
  } else {
    console.log('❌ Schema query failed:', result1.error);
    console.log('Raw output:', result1.raw?.substring(0, 500));
  }

  // ========================================
  // Test 3: Code Review Schema (CommonSchemas)
  // ========================================
  console.log('\n\n--- Test 3: Code Review with CommonSchema ---\n');

  const result2 = await api.queryWithSchema(
    projectPath,
    'Analyze src/lib/jsonExtractor.ts for code quality',
    CommonSchemas.codeReview(),
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result2.success && result2.data) {
    console.log('✅ Code review successful!');
    console.log(`\nFile: ${result2.data.file}`);
    console.log(`Review Score: ${result2.data.review}/10`);
    console.log(`Complexity: ${result2.data.complexity}/20`);
    console.log(`Maintainability: ${result2.data.maintainability}/100`);
    console.log(`\nIssues found: ${result2.data.issues?.length || 0}`);
    console.log(`Suggestions: ${result2.data.suggestions?.length || 0}`);

    if (result2.data.issues && result2.data.issues.length > 0) {
      console.log('\nTop Issues:');
      result2.data.issues.slice(0, 3).forEach((issue: any, i: number) => {
        console.log(`  ${i + 1}. [${issue.severity}] ${issue.message}`);
      });
    }
  } else {
    console.log('❌ Code review failed:', result2.error);
  }

  // ========================================
  // Test 4: Agent Stats Schema
  // ========================================
  console.log('\n\n--- Test 4: Agent Stats Schema ---\n');

  const result3 = await api.queryWithSchema(
    projectPath,
    `Report statistics for a hypothetical agent named "code-reviewer":
    - Status: busy
    - Tasks completed: 15
    - Current task: "review-pr-123"
    - Uptime: 3600000 ms
    - Performance: avgDuration 5000ms, avgCost 0.02`,
    CommonSchemas.agentStats(),
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (result3.success && result3.data) {
    console.log('✅ Agent stats successful!');
    console.log(JSON.stringify(result3.data, null, 2));
  } else {
    console.log('❌ Agent stats failed:', result3.error);
  }

  // ========================================
  // Test 5: Multiple Files Analysis
  // ========================================
  console.log('\n\n--- Test 5: Multiple Files (Array Response) ---\n');

  const multiFileSchema = schema({
    analyses: array('object', 'Array of file analyses')
  });

  const result4 = await api.queryWithSchema(
    projectPath,
    `Analyze these files and return an array in the "analyses" field:
    - src/services/ProcessManager.ts
    - src/services/TaskRouter.ts

    For each file, provide:
    - file: string (file path)
    - review: number (1-10)
    - complexity: number (1-20)`,
    multiFileSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 90000 }
  );

  if (result4.success && result4.data) {
    console.log('✅ Multiple files analysis successful!');
    console.log(JSON.stringify(result4.data, null, 2));

    if (Array.isArray(result4.data.analyses)) {
      console.log(`\nAnalyzed ${result4.data.analyses.length} files`);
      result4.data.analyses.forEach((item: any) => {
        console.log(`  - ${item.file}: ${item.review}/10 (complexity: ${item.complexity})`);
      });
    }
  } else {
    console.log('❌ Multiple files analysis failed:', result4.error);
  }

  // ========================================
  // Test 6: Schema Validation Failure
  // ========================================
  console.log('\n\n--- Test 6: Schema Validation Failure Test ---\n');

  // Create schema with strict constraints
  const strictSchema = schema({
    score: number('Must be 1-10', { min: 1, max: 10 }),
    status: enumField(['active', 'inactive'], 'Must be active or inactive'),
    name: string('Required field')
  });

  console.log('Schema with constraints:', JSON.stringify(strictSchema, null, 2));
  console.log('\nAsking Claude to intentionally violate constraints...\n');

  const result5 = await api.queryWithSchema(
    projectPath,
    `Provide test data:
    - score: 999 (intentionally out of range)
    - status: "invalid" (not in enum)
    - name: "Test"`,
    strictSchema,
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (!result5.success) {
    console.log('✅ Validation correctly failed!');
    console.log('Error:', result5.error);
  } else {
    console.log('⚠️  Validation should have failed but passed');
    console.log('Data:', result5.data);
  }

  // ========================================
  // Test 7: Comparison with Old Method
  // ========================================
  console.log('\n\n--- Test 7: Old vs New Method ---\n');

  console.log('Old Method (structured-json with fixed schema):');
  const oldResult = await api.queryJSON(
    projectPath,
    'Review src/lib/schemaBuilder.ts',
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (oldResult.success) {
    console.log('  ✅ Result:', JSON.stringify(oldResult.data, null, 2));
    console.log('  → Fixed schema: review, name, tags');
  }

  console.log('\nNew Method (dynamic schema):');
  const newResult = await api.queryWithSchema(
    projectPath,
    'Review src/lib/schemaBuilder.ts',
    schema({
      file: string('File path'),
      qualityScore: number('Quality 1-10', { min: 1, max: 10 }),
      features: array('string', 'Key features'),
      recommendation: string('Recommendation')
    }),
    { mcpConfig: '.claude/.mcp-empty.json', timeout: 60000 }
  );

  if (newResult.success) {
    console.log('  ✅ Result:', JSON.stringify(newResult.data, null, 2));
    console.log('  → Custom schema: file, qualityScore, features, recommendation');
  }

  console.log('\n==================================================');
  console.log('Schema Validation Tests Complete!');
  console.log('==================================================\n');
}

main().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
