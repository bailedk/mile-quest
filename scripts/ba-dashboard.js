#!/usr/bin/env node
/**
 * Business Analyst Management Dashboard
 * Comprehensive view of project status, developer workload, and blockers
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ANSI color codes for better visibility
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function separator(char = '=', length = 70) {
  console.log(char.repeat(length));
}

function getSprintProgress(sprint) {
  try {
    const output = execSync(`node scripts/backlog-utils.js sprint ${sprint}`, { encoding: 'utf8' });
    const match = output.match(/Overall Progress: (\d+)\/(\d+) tasks \((\d+)%\)/);
    if (match) {
      return {
        completed: parseInt(match[1]),
        total: parseInt(match[2]),
        percentage: parseInt(match[3])
      };
    }
  } catch (e) {
    return { completed: 0, total: 0, percentage: 0 };
  }
}

function getAgentTaskCount(agentNum) {
  try {
    const backlogPath = path.join(__dirname, `../docs/agents/${agentNum}-*/backlog.json`);
    const files = execSync(`find docs/agents -name "backlog.json" | grep "/${agentNum}-"`, { encoding: 'utf8' }).trim();
    
    if (!files) return { total: 0, completed: 0, inProgress: 0, pending: 0 };
    
    const backlog = JSON.parse(fs.readFileSync(files.split('\n')[0], 'utf8'));
    let stats = { total: 0, completed: 0, inProgress: 0, pending: 0 };
    
    backlog.backlog.forEach(item => {
      if (item.tasks && item.tasks.length > 0) {
        item.tasks.forEach(task => {
          stats.total++;
          if (task.status === 'completed') stats.completed++;
          else if (task.status === 'in-progress') stats.inProgress++;
          else stats.pending++;
        });
      } else {
        stats.total++;
        if (item.status === 'completed') stats.completed++;
        else if (item.status === 'in-progress') stats.inProgress++;
        else if (item.status === 'approved') stats.pending++;
      }
    });
    
    return stats;
  } catch (e) {
    return { total: 0, completed: 0, inProgress: 0, pending: 0 };
  }
}

function getBlockedTasks() {
  try {
    const blocked = [];
    const agentDirs = fs.readdirSync('docs/agents').filter(dir => dir.match(/^\d{2}-/));
    
    agentDirs.forEach(dir => {
      const backlogPath = path.join('docs/agents', dir, 'backlog.json');
      if (fs.existsSync(backlogPath)) {
        const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
        backlog.backlog.forEach(item => {
          if (item.tasks) {
            item.tasks.forEach(task => {
              if (task.dependencies && task.dependencies.length > 0 && task.status !== 'completed') {
                blocked.push({
                  agent: dir,
                  taskId: task.id,
                  description: task.description,
                  blockedBy: task.dependencies
                });
              }
            });
          }
        });
      }
    });
    
    return blocked;
  } catch (e) {
    return [];
  }
}

// Main Dashboard
console.clear();
separator('=');
console.log(colorize('         MILE QUEST - BA MANAGEMENT DASHBOARD', 'bright'));
separator('=');
console.log(`Generated: ${colorize(new Date().toISOString(), 'cyan')}\n`);

// Sprint Overview
console.log(colorize('📊 SPRINT OVERVIEW', 'bright'));
separator('-');

for (let sprint = 0; sprint <= 2; sprint++) {
  const progress = getSprintProgress(sprint);
  if (progress.total > 0) {
    const progressBar = '█'.repeat(Math.floor(progress.percentage / 5)) + '░'.repeat(20 - Math.floor(progress.percentage / 5));
    const sprintColor = sprint === 0 ? 'green' : 'yellow';
    console.log(`Sprint ${sprint}: [${colorize(progressBar, sprintColor)}] ${progress.percentage}% (${progress.completed}/${progress.total} tasks)`);
  }
}

// Developer Workload
console.log(`\n${colorize('👥 DEVELOPER WORKLOAD', 'bright')}`);
separator('-');

const developers = [
  { num: 16, name: 'Frontend Developer' },
  { num: 17, name: 'Backend API Developer' },
  { num: 18, name: 'Database Developer' },
  { num: 19, name: 'Integration Developer' },
  { num: 20, name: 'Mobile/PWA Developer' }
];

developers.forEach(dev => {
  const stats = getAgentTaskCount(dev.num);
  if (stats.total > 0) {
    console.log(`\n${colorize(dev.name, 'cyan')} (Agent ${dev.num}):`);
    console.log(`  Total Tasks: ${stats.total}`);
    console.log(`  ✅ Completed: ${colorize(stats.completed, 'green')}`);
    console.log(`  🚧 In Progress: ${colorize(stats.inProgress, 'yellow')}`);
    console.log(`  ⏳ Pending: ${stats.pending}`);
    
    const utilization = Math.round((stats.inProgress / Math.max(1, stats.pending + stats.inProgress)) * 100);
    console.log(`  Utilization: ${utilization}%`);
  }
});

// Blocked Tasks
console.log(`\n${colorize('🚨 BLOCKED TASKS', 'bright')}`);
separator('-');

const blockedTasks = getBlockedTasks();
if (blockedTasks.length === 0) {
  console.log(colorize('✅ No blocked tasks found!', 'green'));
} else {
  blockedTasks.forEach(task => {
    console.log(`\n${colorize('⚠️  BLOCKED:', 'red')} ${task.taskId} - ${task.description}`);
    console.log(`   Agent: ${task.agent}`);
    console.log(`   Blocked by: ${task.blockedBy.join(', ')}`);
  });
}

// Quick Actions
console.log(`\n${colorize('⚡ QUICK ACTIONS', 'bright')}`);
separator('-');
console.log('1. View current sprint details: node scripts/backlog-utils.js sprint 0');
console.log('2. Check specific developer: node scripts/backlog-utils.js agent [16-20]');
console.log('3. Generate full task board: node scripts/backlog-utils.js generate-board');
console.log('4. View this dashboard: node scripts/ba-dashboard.js');

// Health Indicators
console.log(`\n${colorize('💚 HEALTH INDICATORS', 'bright')}`);
separator('-');

const sprint0Progress = getSprintProgress(0);
const velocityHealth = sprint0Progress.percentage >= 20 ? 'Good' : 'At Risk';
const velocityColor = sprint0Progress.percentage >= 20 ? 'green' : 'red';

console.log(`Sprint 0 Velocity: ${colorize(velocityHealth, velocityColor)} (${sprint0Progress.percentage}% complete)`);
console.log(`Blocked Tasks: ${blockedTasks.length === 0 ? colorize('Healthy', 'green') : colorize(`${blockedTasks.length} blocks`, 'yellow')}`);

// Recommendations
if (sprint0Progress.percentage < 30 && sprint0Progress.total > 0) {
  console.log(`\n${colorize('💡 RECOMMENDATIONS', 'bright')}`);
  separator('-');
  console.log('- Consider reassigning tasks from pending developers');
  console.log('- Focus on unblocking any dependency chains');
  console.log('- Review task estimates for accuracy');
}

separator('=');
console.log(`\n${colorize('End of Dashboard Report', 'cyan')}\n`);