#!/usr/bin/env node

/**
 * Task status tracking utility for Mile Quest
 * Usage: node task-status.js [command] [args]
 * 
 * Commands:
 *   status <task-id>     - Check status of a task
 *   update <task-id>     - Update task status
 *   sprint               - Show current sprint progress
 *   blocked              - Show blocked tasks
 */

const fs = require('fs');
const path = require('path');

// Task definitions from task-specifications.md
const TASKS = {
  // Sprint 0 tasks
  'BE-001': { sprint: 0, developer: 'backend', description: 'Set up Lambda project structure' },
  'BE-002': { sprint: 0, developer: 'backend', description: 'Configure API Gateway' },
  'BE-003': { sprint: 0, developer: 'backend', description: 'Implement health check endpoint' },
  'BE-004': { sprint: 0, developer: 'backend', description: 'Create error handling middleware' },
  'BE-005': { sprint: 0, developer: 'backend', description: 'Set up logging infrastructure' },
  
  'FE-001': { sprint: 0, developer: 'frontend', description: 'Initialize Next.js project' },
  'FE-002': { sprint: 0, developer: 'frontend', description: 'Configure TypeScript and ESLint' },
  'FE-003': { sprint: 0, developer: 'frontend', description: 'Set up Tailwind CSS' },
  'FE-004': { sprint: 0, developer: 'frontend', description: 'Create base layout components' },
  'FE-005': { sprint: 0, developer: 'frontend', description: 'Implement routing structure' },
  
  'DB-001': { sprint: 0, developer: 'database', description: 'Deploy RDS PostgreSQL instance' },
  'DB-002': { sprint: 0, developer: 'database', description: 'Run initial Prisma migrations' },
  'DB-003': { sprint: 0, developer: 'database', description: 'Create development seed data' },
  'DB-004': { sprint: 0, developer: 'database', description: 'Set up database backup procedures' },
  
  'INT-001': { sprint: 0, developer: 'integration', description: 'Create AWS service abstractions' },
  'INT-002': { sprint: 0, developer: 'integration', description: 'Implement Cognito wrapper service' },
  'INT-003': { sprint: 0, developer: 'integration', description: 'Create Pusher abstraction layer' },
  'INT-004': { sprint: 0, developer: 'integration', description: 'Set up SES email service wrapper' },
  'INT-005': { sprint: 0, developer: 'integration', description: 'Create environment configuration' },
};

// Task status file
const STATUS_FILE = path.join(__dirname, '..', 'docs', 'task-status.json');

// Load current status
function loadStatus() {
  if (fs.existsSync(STATUS_FILE)) {
    return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  }
  return {};
}

// Save status
function saveStatus(status) {
  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

// Command handlers
const commands = {
  status: (taskId) => {
    if (!taskId) {
      console.error('Usage: task-status status <task-id>');
      process.exit(1);
    }
    
    const task = TASKS[taskId.toUpperCase()];
    if (!task) {
      console.error(`Unknown task: ${taskId}`);
      process.exit(1);
    }
    
    const status = loadStatus();
    const taskStatus = status[taskId.toUpperCase()] || { status: 'not-started' };
    
    console.log(`\nTask: ${taskId.toUpperCase()}`);
    console.log(`Description: ${task.description}`);
    console.log(`Sprint: ${task.sprint}`);
    console.log(`Developer: ${task.developer}`);
    console.log(`Status: ${taskStatus.status}`);
    if (taskStatus.notes) {
      console.log(`Notes: ${taskStatus.notes}`);
    }
    if (taskStatus.completedAt) {
      console.log(`Completed: ${new Date(taskStatus.completedAt).toLocaleDateString()}`);
    }
  },
  
  update: (taskId) => {
    if (!taskId) {
      console.error('Usage: task-status update <task-id>');
      process.exit(1);
    }
    
    const task = TASKS[taskId.toUpperCase()];
    if (!task) {
      console.error(`Unknown task: ${taskId}`);
      process.exit(1);
    }
    
    // For now, just mark as complete with current timestamp
    const status = loadStatus();
    status[taskId.toUpperCase()] = {
      status: 'complete',
      completedAt: new Date().toISOString(),
      notes: process.argv[4] || ''
    };
    
    saveStatus(status);
    console.log(`✅ Task ${taskId.toUpperCase()} marked as complete`);
  },
  
  sprint: () => {
    const status = loadStatus();
    const currentSprint = 0; // Sprint 0 for now
    
    const sprintTasks = Object.entries(TASKS).filter(([_, task]) => task.sprint === currentSprint);
    const completed = sprintTasks.filter(([id]) => status[id]?.status === 'complete').length;
    
    console.log(`\nSprint ${currentSprint} Progress`);
    console.log(`${'='.repeat(40)}`);
    console.log(`Total tasks: ${sprintTasks.length}`);
    console.log(`Completed: ${completed}`);
    console.log(`Progress: ${Math.round(completed / sprintTasks.length * 100)}%`);
    console.log();
    
    // Group by developer
    const byDeveloper = {};
    sprintTasks.forEach(([id, task]) => {
      if (!byDeveloper[task.developer]) {
        byDeveloper[task.developer] = [];
      }
      byDeveloper[task.developer].push({
        id,
        ...task,
        completed: status[id]?.status === 'complete'
      });
    });
    
    Object.entries(byDeveloper).forEach(([dev, tasks]) => {
      const completed = tasks.filter(t => t.completed).length;
      console.log(`\n${dev.charAt(0).toUpperCase() + dev.slice(1)} Developer: ${completed}/${tasks.length} tasks`);
      tasks.forEach(task => {
        const icon = task.completed ? '✅' : '⏳';
        console.log(`  ${icon} ${task.id}: ${task.description}`);
      });
    });
  },
  
  blocked: () => {
    // Define task dependencies
    const dependencies = {
      'BE-003': ['DB-001'],
      'BE-101': ['INT-002'],
      'BE-102': ['INT-002'],
      // Add more dependencies as needed
    };
    
    const status = loadStatus();
    console.log('\nBlocked Tasks');
    console.log(`${'='.repeat(40)}`);
    
    let hasBlocked = false;
    Object.entries(dependencies).forEach(([taskId, deps]) => {
      const blocked = deps.some(dep => status[dep]?.status !== 'complete');
      if (blocked && status[taskId]?.status !== 'complete') {
        hasBlocked = true;
        const task = TASKS[taskId];
        console.log(`\n🔴 ${taskId}: ${task.description}`);
        console.log(`   Blocked by: ${deps.filter(dep => status[dep]?.status !== 'complete').join(', ')}`);
      }
    });
    
    if (!hasBlocked) {
      console.log('\n✅ No tasks currently blocked!');
    }
  }
};

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || !commands[command]) {
  console.log('Usage: task-status [command] [args]');
  console.log('\nCommands:');
  console.log('  status <task-id>  - Check status of a task');
  console.log('  update <task-id>  - Mark task as complete');
  console.log('  sprint            - Show current sprint progress');
  console.log('  blocked           - Show blocked tasks');
  process.exit(1);
}

commands[command](...args);