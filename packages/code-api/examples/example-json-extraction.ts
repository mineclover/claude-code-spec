#!/usr/bin/env tsx
/**
 * JSON Extraction Examples - Complete Pipeline
 *
 * Demonstrates the full process from raw output to clean JSON
 */

import { ClaudeQueryAPI } from '../src/query/ClaudeQueryAPI';
import { extractJSON, extractAndValidate } from '../src/schema/jsonExtractor';
import type { ReviewResult, ReviewResults } from './types';
import { isReviewResult, isReviewResults } from './types';

async function main() {
  const api = new ClaudeQueryAPI();
  const projectPath = process.cwd();

  console.log('==================================================');
  console.log('JSON Extraction Pipeline Examples');
  console.log('==================================================\n');

  // ========================================
  // Example 1: Basic JSON Extraction
  // ========================================
  console.log('\n--- Example 1: Basic JSON Extraction ---\n');

  const rawResult1 = await api.query(
    projectPath,
    `Review the following services and rate them:
    - ProcessManager.ts
    - TaskRouter.ts

    Provide review score (1-10), name, and relevant tags.`,
    {
      outputStyle: 'structured-json',
      filterThinking: true,
      mcpConfig: '.claude/.mcp-empty.json'
    }
  );

  console.log('Raw result:');
  console.log(rawResult1.result);
  console.log('\n---\n');

  // Extract JSON
  const extracted1 = extractJSON<ReviewResults>(rawResult1.result);

  if (extracted1.success) {
    console.log('✅ JSON extraction successful!');
    console.log('Data:', JSON.stringify(extracted1.data, null, 2));
    console.log('Cleaned text length:', extracted1.cleanedText?.length || 0);
    console.log('Raw text length:', extracted1.raw?.length || 0);
  } else {
    console.log('❌ JSON extraction failed:', extracted1.error);
  }

  // ========================================
  // Example 2: Validated JSON Extraction
  // ========================================
  console.log('\n\n--- Example 2: Validated JSON Extraction ---\n');

  const validated = extractAndValidate<ReviewResult>(
    rawResult1.result,
    ['review', 'name', 'tags']
  );

  if (validated.success && validated.data) {
    console.log('✅ Validation successful!');
    console.log('All required fields present:', ['review', 'name', 'tags']);

    if (isReviewResults(validated.data)) {
      console.log('Type guard confirmed: ReviewResults');
      validated.data.forEach((item, i) => {
        console.log(`\n  [${i + 1}] ${item.name}`);
        console.log(`      Score: ${item.review}/10`);
        console.log(`      Tags: ${item.tags.join(', ')}`);
      });
    } else if (isReviewResult(validated.data)) {
      console.log('Type guard confirmed: ReviewResult (single)');
      console.log(`  Name: ${validated.data.name}`);
      console.log(`  Score: ${validated.data.review}/10`);
      console.log(`  Tags: ${validated.data.tags.join(', ')}`);
    }
  } else {
    console.log('❌ Validation failed:', validated.error);
  }

  // ========================================
  // Example 3: Direct queryJSON API
  // ========================================
  console.log('\n\n--- Example 3: Direct queryJSON API ---\n');

  const jsonResult = await api.queryJSON<ReviewResults>(
    projectPath,
    `Review these components:
    - AgentLoader.ts
    - AgentPoolManager.ts

    Rate each from 1-10 and add relevant tags.`,
    {
      requiredFields: ['review', 'name', 'tags'],
      mcpConfig: '.claude/.mcp-empty.json'
    }
  );

  if (jsonResult.success) {
    console.log('✅ queryJSON successful!');
    console.log('Data:', JSON.stringify(jsonResult.data, null, 2));

    if (jsonResult.data && isReviewResults(jsonResult.data)) {
      console.log('\nSummary:');
      const avgScore = jsonResult.data.reduce((sum, r) => sum + r.review, 0) / jsonResult.data.length;
      console.log(`  Components reviewed: ${jsonResult.data.length}`);
      console.log(`  Average score: ${avgScore.toFixed(1)}/10`);

      const allTags = new Set(jsonResult.data.flatMap(r => r.tags));
      console.log(`  Unique tags: ${Array.from(allTags).join(', ')}`);
    }
  } else {
    console.log('❌ queryJSON failed:', jsonResult.error);
    console.log('Raw:', jsonResult.raw?.substring(0, 200));
  }

  // ========================================
  // Example 4: Handling Edge Cases
  // ========================================
  console.log('\n\n--- Example 4: Edge Cases ---\n');

  // Simulate various edge case responses
  const edgeCases = [
    {
      name: 'With markdown code blocks',
      text: '```json\n{"review": 9, "name": "Test", "tags": ["good"]}\n```'
    },
    {
      name: 'With explanatory text',
      text: 'Here is the review:\n\n{"review": 8, "name": "Component", "tags": ["clean"]}\n\nThis component is well-designed.'
    },
    {
      name: 'With trailing comma',
      text: '{"review": 7, "name": "Service", "tags": ["useful",]}'
    },
    {
      name: 'Multiple objects',
      text: '{"review": 9, "name": "A", "tags": ["x"]}\n{"review": 8, "name": "B", "tags": ["y"]}'
    }
  ];

  for (const testCase of edgeCases) {
    console.log(`\nTest: ${testCase.name}`);
    const result = extractJSON<ReviewResult>(testCase.text);

    if (result.success) {
      console.log('  ✅ Extracted:', result.data);
    } else {
      console.log('  ❌ Failed:', result.error);
    }
  }

  // ========================================
  // Example 5: Type-Safe Usage
  // ========================================
  console.log('\n\n--- Example 5: Type-Safe Usage ---\n');

  const typedResult = await api.queryTypedJSON<ReviewResult>(
    projectPath,
    'Review the ClaudeQueryAPI.ts file',
    ['review', 'name', 'tags'],
    { mcpConfig: '.claude/.mcp-empty.json' }
  );

  if (typedResult.success && typedResult.data) {
    // TypeScript knows this is ReviewResult
    const { review, name, tags } = typedResult.data;

    console.log('✅ Type-safe extraction:');
    console.log(`  Name: ${name}`);
    console.log(`  Review: ${review}/10`);
    console.log(`  Tags: ${tags.join(', ')}`);

    // Type guards work properly
    if (review >= 8) {
      console.log('  → High quality component! 🌟');
    } else if (review >= 5) {
      console.log('  → Good component ✓');
    } else {
      console.log('  → Needs improvement');
    }
  } else {
    console.log('❌ Type-safe extraction failed:', typedResult.error);
  }

  console.log('\n==================================================');
  console.log('Examples Complete!');
  console.log('==================================================\n');
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
