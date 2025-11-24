/**
 * LangGraph POC Test Script
 * Direct test of LangGraphEngine without GUI
 */

const { processManager } = require('@context-action/code-api');
const { LangGraphEngine } = require('./src/services/LangGraphEngine');
const { AgentTracker } = require('./src/services/AgentTracker');
const { CentralDatabase } = require('./src/services/CentralDatabase');

async function testLangGraphPOC() {
  console.log('🧪 Starting LangGraph POC Test\n');
  console.log('═'.repeat(60));

  // 1. Initialize services
  console.log('\n📦 Step 1: Initializing services...');
  const database = new CentralDatabase();
  await database.initialize();
  console.log('✅ CentralDatabase initialized');

  const agentTracker = new AgentTracker(processManager, database);
  agentTracker.startHealthCheck();
  console.log('✅ AgentTracker initialized');

  const engine = new LangGraphEngine(processManager, agentTracker);
  console.log('✅ LangGraphEngine initialized');

  // 2. Create test tasks
  console.log('\n📝 Step 2: Creating test tasks...');
  const testTasks = [
    {
      id: 'test-task-001',
      title: 'List TypeScript Files',
      description: 'List all TypeScript files in the src/ directory',
      assigned_agent: 'claude-sonnet-4',
      status: 'pending',
      area: 'Test',
    },
    {
      id: 'test-task-002',
      title: 'Count Files',
      description: 'Count the total number of files found in the previous task',
      assigned_agent: 'claude-sonnet-4',
      status: 'pending',
      area: 'Test',
      dependencies: ['test-task-001'],
    },
  ];

  console.log(`✅ Created ${testTasks.length} test tasks:`);
  testTasks.forEach((task) => {
    console.log(`   - ${task.id}: ${task.title}`);
  });

  // 3. Start workflow
  console.log('\n⚙️  Step 3: Starting workflow...');
  const workflowId = `test-${Date.now()}`;
  const projectPath = process.cwd();

  console.log(`   Workflow ID: ${workflowId}`);
  console.log(`   Project Path: ${projectPath}`);
  console.log('\n⏳ Executing workflow (this may take 1-2 minutes)...\n');

  try {
    const startTime = Date.now();
    const finalState = await engine.startWorkflow(workflowId, projectPath, testTasks);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // 4. Display results
    console.log('\n' + '═'.repeat(60));
    console.log('🎉 Workflow Completed!\n');
    console.log(`⏱️  Duration: ${duration}s`);
    console.log(`✅ Completed Tasks: ${finalState.completedTasks.length}`);
    console.log(`❌ Failed Tasks: ${finalState.failedTasks.length}`);

    console.log('\n📊 Task Results:');
    console.log('─'.repeat(60));
    for (const taskId of finalState.completedTasks) {
      console.log(`\n✅ ${taskId}:`);
      const result = finalState.results[taskId];
      if (result) {
        console.log(`   Status: ${result.success ? 'Success' : 'Failed'}`);
        console.log(`   Events: ${result.events?.length || 0} events captured`);
      }
    }

    for (const taskId of finalState.failedTasks) {
      console.log(`\n❌ ${taskId}:`);
      const result = finalState.results[taskId];
      if (result) {
        console.log(`   Error: ${result.error || 'Unknown error'}`);
      }
    }

    console.log('\n📋 Workflow Logs:');
    console.log('─'.repeat(60));
    finalState.logs.forEach((log, idx) => {
      console.log(`${idx + 1}. ${log}`);
    });

    // 5. Verify state persistence
    console.log('\n🔍 Step 4: Verifying state persistence...');
    const retrievedState = await engine.getWorkflowState(workflowId);
    if (retrievedState) {
      console.log('✅ State successfully retrieved from checkpoint');
      console.log(`   Workflow ID: ${retrievedState.workflowId}`);
      console.log(`   Completed Tasks: ${retrievedState.completedTasks.length}`);
    } else {
      console.log('❌ Failed to retrieve state');
    }

    // 6. Check AgentTracker integration
    console.log('\n🔍 Step 5: Checking AgentTracker integration...');
    const allTracked = await agentTracker.getAllTracked();
    const ourExecutions = allTracked.filter((e) => e.sessionId.startsWith(workflowId));
    console.log(`✅ Found ${ourExecutions.length} tracked executions`);
    ourExecutions.forEach((exec) => {
      console.log(`   - ${exec.sessionId}: ${exec.status}`);
    });

    console.log('\n' + '═'.repeat(60));
    console.log('✅ POC Test Completed Successfully!');
    console.log('═'.repeat(60) + '\n');

    // Cleanup
    agentTracker.stopHealthCheck();
    process.exit(0);
  } catch (error) {
    console.error('\n' + '═'.repeat(60));
    console.error('❌ Workflow Failed!');
    console.error('═'.repeat(60));
    console.error('\n Error:', error.message);
    console.error('\n Stack:', error.stack);

    agentTracker.stopHealthCheck();
    process.exit(1);
  }
}

// Run test
testLangGraphPOC().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
