const { spawn } = require('child_process');

console.log('Testing Claude CLI commands...\n');

function testCommand(query, description) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`Testing: ${description}`);
  console.log(
    `Command: claude -p "${query}" --output-format stream-json --verbose --dangerously-skip-permissions`,
  );
  console.log('='.repeat(80));

  const process = spawn(
    'claude',
    ['-p', query, '--output-format', 'stream-json', '--verbose', '--dangerously-skip-permissions'],
    {
      cwd: __dirname,
    },
  );

  let stdoutData = '';
  let stderrData = '';

  process.stdout.on('data', (chunk) => {
    const data = chunk.toString();
    stdoutData += data;
    console.log('[STDOUT]', data);
  });

  process.stderr.on('data', (chunk) => {
    const data = chunk.toString();
    stderrData += data;
    console.log('[STDERR]', data);
  });

  process.on('close', (code) => {
    console.log(`\n[CLOSE] Exit code: ${code}`);
    console.log(`\nTotal stdout length: ${stdoutData.length}`);
    console.log(`Total stderr length: ${stderrData.length}`);
  });

  process.on('error', (error) => {
    console.error('[ERROR]', error);
  });
}

// Test /todos command
testCommand('/todos', '/todos command');

// Wait 5 seconds then test /context
setTimeout(() => {
  testCommand('/context', '/context command');
}, 5000);
