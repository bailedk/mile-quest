#!/usr/bin/env node

/**
 * Backlog utilities for Enhanced Backlog System v2.0
 * Supports task tracking within backlog items
 */

const fs = require('fs');
const path = require('path');

// Load all agent backlogs
function loadAllBacklogs() {
  const agentsDir = path.join(__dirname, '..', 'docs', 'agents');
  const backlogs = {};
  
  // Get all agent directories
  const agents = fs.readdirSync(agentsDir)
    .filter(dir => fs.statSync(path.join(agentsDir, dir)).isDirectory());
  
  agents.forEach(agent => {
    const backlogPath = path.join(agentsDir, agent, 'backlog.json');
    if (fs.existsSync(backlogPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(backlogPath, 'utf8'));
        backlogs[agent] = data.backlog || [];
      } catch (e) {
        console.error(`Error reading ${agent} backlog:`, e.message);
      }
    }
  });
  
  return backlogs;
}

// Commands
const commands = {
  // Show sprint tasks across all agents
  sprint: (sprintNum) => {
    const sprint = parseInt(sprintNum);
    if (isNaN(sprint)) {
      console.error('Usage: backlog-utils sprint <number>');
      process.exit(1);
    }
    
    const backlogs = loadAllBacklogs();
    console.log(`\nSprint ${sprint} Tasks\n${'='.repeat(50)}`);
    
    let totalTasks = 0;
    let completedTasks = 0;
    
    Object.entries(backlogs).forEach(([agent, items]) => {
      const sprintItems = items.filter(item => item.sprint === sprint);
      
      if (sprintItems.length > 0) {
        console.log(`\n${agent}:`);
        
        sprintItems.forEach(item => {
          console.log(`  📦 ${item.request} (${item.status})`);
          
          if (item.tasks) {
            item.tasks.forEach(task => {
              const icon = task.status === 'completed' ? '✅' : 
                          task.status === 'in-progress' ? '🚧' : '⏳';
              console.log(`    ${icon} ${task.id}: ${task.description}`);
              
              totalTasks++;
              if (task.status === 'completed') completedTasks++;
            });
          }
        });
      }
    });
    
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    console.log(`\nOverall Progress: ${completedTasks}/${totalTasks} tasks (${progress}%)\n`);
  },
  
  // Show specific agent's backlog
  agent: (agentNum) => {
    if (!agentNum) {
      console.error('Usage: backlog-utils agent <agent-number>');
      process.exit(1);
    }
    
    const backlogs = loadAllBacklogs();
    const agentBacklog = backlogs[agentNum];
    
    if (!agentBacklog) {
      console.error(`No backlog found for agent ${agentNum}`);
      process.exit(1);
    }
    
    console.log(`\n${agentNum} Backlog\n${'='.repeat(50)}`);
    
    agentBacklog.forEach(item => {
      const icon = item.status === 'completed' ? '✅' :
                  item.status === 'in-progress' ? '🚧' :
                  item.status === 'approved' ? '👍' : '⏳';
      
      console.log(`\n${icon} ${item.id}: ${item.request}`);
      console.log(`   Priority: ${item.priority} | Status: ${item.status}`);
      console.log(`   From: ${item.fromAgent} | Value: ${item.value}`);
      
      if (item.tasks) {
        console.log(`   Tasks:`);
        item.tasks.forEach(task => {
          const taskIcon = task.status === 'completed' ? '✅' : 
                          task.status === 'in-progress' ? '🚧' : '⏳';
          console.log(`     ${taskIcon} ${task.id}: ${task.description} (${task.effort})`);
        });
        
        const completed = item.tasks.filter(t => t.status === 'completed').length;
        const progress = Math.round((completed / item.tasks.length) * 100);
        console.log(`   Progress: ${completed}/${item.tasks.length} tasks (${progress}%)`);
      }
    });
  },
  
  // Generate task board markdown
  'generate-board': () => {
    const backlogs = loadAllBacklogs();
    const now = new Date().toISOString().split('T')[0];
    
    console.log(`# Mile Quest Task Board\n`);
    console.log(`**Generated**: ${now}`);
    console.log(`**Source**: Agent backlogs (Enhanced v2.0)\n`);
    
    // Current sprint (find most common sprint number)
    const sprintCounts = {};
    Object.values(backlogs).flat().forEach(item => {
      if (item.sprint !== undefined) {
        sprintCounts[item.sprint] = (sprintCounts[item.sprint] || 0) + 1;
      }
    });
    const currentSprint = Object.keys(sprintCounts).reduce((a, b) => 
      sprintCounts[a] > sprintCounts[b] ? a : b, 0);
    
    console.log(`## Current Sprint: ${currentSprint}\n`);
    
    // Sprint progress
    let sprintTotalTasks = 0;
    let sprintCompletedTasks = 0;
    
    Object.entries(backlogs).forEach(([agent, items]) => {
      const sprintItems = items.filter(item => item.sprint == currentSprint);
      
      sprintItems.forEach(item => {
        if (item.tasks) {
          sprintTotalTasks += item.tasks.length;
          sprintCompletedTasks += item.tasks.filter(t => t.status === 'completed').length;
        }
      });
    });
    
    const sprintProgress = sprintTotalTasks > 0 ? 
      Math.round((sprintCompletedTasks / sprintTotalTasks) * 100) : 0;
    
    console.log(`### Sprint Progress: ${sprintCompletedTasks}/${sprintTotalTasks} tasks (${sprintProgress}%)\n`);
    
    // By agent breakdown
    console.log(`## Task Status by Agent\n`);
    
    Object.entries(backlogs).forEach(([agent, items]) => {
      if (items.length === 0) return;
      
      console.log(`### ${agent}\n`);
      console.log(`| Backlog Item | Priority | Status | Progress |`);
      console.log(`|--------------|----------|--------|----------|`);
      
      items.forEach(item => {
        let progress = '-';
        if (item.tasks) {
          const completed = item.tasks.filter(t => t.status === 'completed').length;
          progress = `${completed}/${item.tasks.length} tasks`;
        }
        
        console.log(`| ${item.request} | ${item.priority} | ${item.status} | ${progress} |`);
      });
      
      console.log('');
    });
    
    // Blocked tasks
    console.log(`## Blocked Tasks\n`);
    
    let hasBlocked = false;
    Object.entries(backlogs).forEach(([agent, items]) => {
      items.forEach(item => {
        if (item.tasks) {
          item.tasks.forEach(task => {
            if (task.dependencies && task.dependencies.length > 0 && 
                task.status === 'pending') {
              // Check if dependencies are complete
              const blocked = task.dependencies.some(dep => {
                // Find dependency task across all backlogs
                let depComplete = false;
                Object.values(backlogs).flat().forEach(i => {
                  if (i.tasks) {
                    const depTask = i.tasks.find(t => t.id === dep);
                    if (depTask && depTask.status === 'completed') {
                      depComplete = true;
                    }
                  }
                });
                return !depComplete;
              });
              
              if (blocked) {
                hasBlocked = true;
                console.log(`- **${task.id}** (${agent}): ${task.description}`);
                console.log(`  - Blocked by: ${task.dependencies.join(', ')}`);
              }
            }
          });
        }
      });
    });
    
    if (!hasBlocked) {
      console.log(`✅ No tasks currently blocked\n`);
    }
  },
  
  // Add development tasks to an agent's backlog
  'add-tasks': (agentNum) => {
    if (!agentNum) {
      console.error('Usage: backlog-utils add-tasks <agent-number>');
      process.exit(1);
    }
    
    // This would be populated from task-specifications.md
    console.log(`To add tasks, update ${agentNum}/backlog.json with task structure`);
    console.log(`Example structure provided in BACKLOG-SYSTEM-V2.md`);
  }
};

// Main
const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || !commands[command]) {
  console.log('Usage: backlog-utils [command] [args]');
  console.log('\nCommands:');
  console.log('  sprint <num>      - Show all tasks for a sprint');
  console.log('  agent <num>       - Show specific agent backlog');
  console.log('  generate-board    - Generate TASK-BOARD.md content');
  console.log('  add-tasks <agent> - Instructions to add tasks');
  process.exit(1);
}

commands[command](...args);