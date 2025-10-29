#!/usr/bin/env tsx
/**
 * ClaudeQueryAPI Usage Example
 *
 * Demonstrates how to use the API-style query executor
 */

import { ClaudeQueryAPI } from '../src/query/ClaudeQueryAPI';

async function main() {
  const api = new ClaudeQueryAPI();
  const projectPath = process.cwd();

  console.log('==================================================');
  console.log('ClaudeQueryAPI Example');
  console.log('==================================================\n');

  // Example 1: Simple query with default style
  console.log('\n--- Example 1: Default Query ---');
  const result1 = await api.query(
    projectPath,
    'What files are in the src/services directory? List them briefly.',
    {
      filterThinking: true,
      mcpConfig: '.claude/.mcp-empty.json',
    },
  );

  console.log('Result:', result1.result);
  console.log('Cost:', `$${result1.metadata.totalCost.toFixed(4)}`);
  console.log('Duration:', `${result1.metadata.durationMs}ms`);
  console.log('Turns:', result1.metadata.numTurns);

  // Example 2: Structured JSON output
  console.log('\n\n--- Example 2: Structured JSON Query ---');
  const result2 = await api.query(
    projectPath,
    `Review and rate these services based on code quality:
    - AgentLoader.ts
    - AgentPoolManager.ts
    - ProcessManager.ts
    - TaskRouter.ts

    Rate each from 1-10 and provide relevant tags.`,
    {
      outputStyle: 'structured-json',
      filterThinking: true,
      mcpConfig: '.claude/.mcp-empty.json',
    },
  );

  console.log('Raw Result:');
  console.log(result2.result);

  // Try to parse as JSON
  try {
    const parsed = JSON.parse(result2.result);
    console.log('\n✅ Parsed JSON:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch {
    console.log('\n❌ Failed to parse as JSON');
  }

  console.log('\nMetadata:');
  console.log('  Cost:', `$${result2.metadata.totalCost.toFixed(4)}`);
  console.log('  Duration:', `${result2.metadata.durationMs}ms`);
  console.log('  Turns:', result2.metadata.numTurns);
  console.log('  Output Style:', result2.metadata.outputStyle);

  // Example 3: With thinking blocks (unfiltered)
  console.log('\n\n--- Example 3: Query with Thinking Blocks ---');
  const result3 = await api.query(projectPath, 'Explain the TaskRouter class briefly.', {
    filterThinking: false, // Keep thinking blocks
    mcpConfig: '.claude/.mcp-empty.json',
  });

  console.log('Messages count:', result3.messages.length);
  console.log(`Result: ${result3.result.substring(0, 200)}...`);

  // Check for thinking in events
  const hasThinking = result3.events.some(
    (e) => e.type === 'message' && e.message?.content?.some((b: any) => b.type === 'thinking'),
  );
  console.log('Contains thinking blocks:', hasThinking);

  console.log('\n==================================================');
  console.log('Examples Complete!');
  console.log('==================================================\n');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
