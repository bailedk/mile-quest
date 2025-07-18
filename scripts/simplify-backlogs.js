#!/usr/bin/env node

/**
 * Script to simplify agent backlogs to the new format
 * Removes complex v2.0 features and keeps only simple recommendations
 */

const fs = require('fs');
const path = require('path');

const AGENTS_DIR = path.join(__dirname, '..', 'docs', 'agents');

function simplifyBacklog(backlogPath) {
  try {
    const content = fs.readFileSync(backlogPath, 'utf8');
    const data = JSON.parse(content);
    
    if (!data.backlog || !Array.isArray(data.backlog)) {
      console.log(`  ⚠️  No backlog array found`);
      return;
    }
    
    // Create simplified version
    const simplified = {
      backlog: data.backlog.map(item => ({
        id: item.id,
        from: item.fromAgent || 'unknown',
        request: item.request,
        priority: item.priority || 'medium',
        status: item.status === 'completed' ? 'completed' : 'pending'
      }))
    };
    
    // Create backup
    const backupPath = backlogPath.replace('.json', '.json.backup');
    fs.writeFileSync(backupPath, content);
    
    // Write simplified version
    fs.writeFileSync(backlogPath, JSON.stringify(simplified, null, 2) + '\n');
    
    console.log(`  ✅ Simplified (${data.backlog.length} items, backup created)`);
    
  } catch (error) {
    console.log(`  ❌ Error: ${error.message}`);
  }
}

function main() {
  console.log('🔧 Simplifying Agent Backlogs\n');
  
  // Get all agent directories
  const agentDirs = fs.readdirSync(AGENTS_DIR)
    .filter(dir => dir.match(/^\d{2}-/))
    .sort();
  
  agentDirs.forEach(agentDir => {
    const backlogPath = path.join(AGENTS_DIR, agentDir, 'backlog.json');
    
    if (fs.existsSync(backlogPath)) {
      console.log(`📁 ${agentDir}:`);
      simplifyBacklog(backlogPath);
    }
  });
  
  console.log('\n✨ Done! Backups created as backlog.json.backup');
  console.log('📝 Remember to update SPRINT-TRACKING.md for development tasks');
}

main();