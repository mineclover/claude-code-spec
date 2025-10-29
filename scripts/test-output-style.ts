#!/usr/bin/env tsx
/**
 * Output-Style Test Script
 *
 * Tests how output-style affects Claude's responses and
 * explores filtering thinking from results.
 */

import { spawn } from 'node:child_process';

interface StreamEvent {
  type: string;
  subtype?: string;
  [key: string]: any;
}

/**
 * Execute Claude with output-style
 */
async function executeWithOutputStyle(
  projectPath: string,
  query: string,
  outputStyle?: string,
): Promise<StreamEvent[]> {
  return new Promise((resolve, reject) => {
    const events: StreamEvent[] = [];

    // Build command
    const args = [
      '-p',
      outputStyle ? `/output-style ${outputStyle}\n\n${query}` : query,
      '--output-format',
      'stream-json',
      '--verbose',
    ];

    console.log(`\n🚀 Executing Claude with output-style: ${outputStyle || 'default'}`);
    console.log(`📝 Query: ${query.substring(0, 100)}...`);
    console.log(`📂 Working directory: ${projectPath}\n`);

    const child = spawn('claude', args, {
      cwd: projectPath,
      shell: true,
      env: {
        ...process.env,
        FORCE_COLOR: '0',
      },
    });

    let buffer = '';

    child.stdout.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          events.push(event);

          // Log interesting events
          if (event.type === 'message' && event.subtype === 'assistant') {
            const content = event.message?.content || [];
            for (const block of content) {
              if (block.type === 'text') {
                console.log(`💬 Assistant: ${block.text.substring(0, 200)}...`);
              } else if (block.type === 'thinking') {
                console.log(`🤔 Thinking: ${block.thinking ? 'present' : 'none'}`);
              }
            }
          } else if (event.type === 'result') {
            console.log(`✅ Result: ${event.result?.substring(0, 200)}...`);
          }
        } catch (_error) {
          // Skip invalid JSON lines
        }
      }
    });

    child.stderr.on('data', (data: Buffer) => {
      console.error(`⚠️  stderr: ${data.toString()}`);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(events);
      } else {
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Filter out thinking blocks from stream events
 */
function filterThinking(events: StreamEvent[]): StreamEvent[] {
  return events.map((event) => {
    if (event.type === 'message' && event.message?.content) {
      return {
        ...event,
        message: {
          ...event.message,
          content: event.message.content.filter((block: any) => block.type !== 'thinking'),
        },
      };
    }
    return event;
  });
}

/**
 * Extract final result from events
 */
function extractResult(events: StreamEvent[]): string | null {
  const resultEvent = events.find((e) => e.type === 'result');
  return resultEvent?.result || null;
}

/**
 * Extract all assistant messages (no thinking)
 */
function extractAssistantMessages(events: StreamEvent[]): string[] {
  const messages: string[] = [];

  for (const event of events) {
    if (event.type === 'message' && event.subtype === 'assistant') {
      const content = event.message?.content || [];
      for (const block of content) {
        if (block.type === 'text') {
          messages.push(block.text);
        }
      }
    }
  }

  return messages;
}

/**
 * Main test function
 */
async function main() {
  const projectPath = process.cwd();

  console.log('==================================================');
  console.log('Output-Style Test Suite');
  console.log('==================================================\n');

  // Test 1: Default mode (no output-style)
  console.log('\n--- Test 1: Default Mode ---');
  const defaultEvents = await executeWithOutputStyle(
    projectPath,
    'List the files in src/services directory. Be brief.',
  );

  console.log('\n📊 Default Mode Results:');
  console.log(`  Events: ${defaultEvents.length}`);
  console.log(`  Result: ${extractResult(defaultEvents)?.substring(0, 100)}...`);
  console.log(`  Messages: ${extractAssistantMessages(defaultEvents).length}`);

  // Test 2: structured-json output-style
  console.log('\n\n--- Test 2: Structured JSON Mode ---');
  const jsonEvents = await executeWithOutputStyle(
    projectPath,
    'Review these services and rate them: AgentLoader.ts, AgentPoolManager.ts, ProcessManager.ts, TaskRouter.ts',
    'structured-json',
  );

  console.log('\n📊 JSON Mode Results:');
  console.log(`  Events: ${jsonEvents.length}`);
  const jsonResult = extractResult(jsonEvents);
  console.log(`  Result: ${jsonResult?.substring(0, 300)}...`);

  // Try to parse as JSON
  if (jsonResult) {
    try {
      const parsed = JSON.parse(jsonResult);
      console.log(`  ✅ Valid JSON! Keys: ${Object.keys(parsed).join(', ')}`);
    } catch (_e) {
      console.log(`  ❌ Not valid JSON`);
    }
  }

  // Test 3: Filter thinking
  console.log('\n\n--- Test 3: Thinking Filter ---');
  const withThinking = defaultEvents.filter(
    (e) => e.type === 'message' && e.message?.content?.some((b: any) => b.type === 'thinking'),
  );
  console.log(`  Events with thinking: ${withThinking.length}`);

  const filtered = filterThinking(defaultEvents);
  const withoutThinking = filtered.filter(
    (e) => e.type === 'message' && e.message?.content?.some((b: any) => b.type === 'thinking'),
  );
  console.log(`  Events after filter: ${withoutThinking.length}`);

  console.log('\n==================================================');
  console.log('Tests Complete!');
  console.log('==================================================\n');
}

// Run tests
main().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
