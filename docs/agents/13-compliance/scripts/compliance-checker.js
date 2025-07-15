#!/usr/bin/env node

/**
 * Mile Quest Automated Compliance Checker
 * 
 * This script automatically verifies project compliance with rules defined in CLAUDE.md
 * Run this script as part of regular compliance audits.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const AGENTS_DIR = path.join(PROJECT_ROOT, 'docs/agents');
const CLAUDE_MD = path.join(PROJECT_ROOT, 'CLAUDE.md');
const AGENTS_MD = path.join(PROJECT_ROOT, 'AGENTS.md');
const MANIFEST_MD = path.join(PROJECT_ROOT, 'docs/MANIFEST.md');

// Compliance results
const results = {
  agents: {},
  summary: {
    totalAgents: 0,
    totalScore: 0,
    violations: []
  }
};

// Helper functions
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch (error) {
    return false;
  }
}

function readJSON(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
}

function getAgentFolders() {
  const folders = fs.readdirSync(AGENTS_DIR)
    .filter(f => fs.statSync(path.join(AGENTS_DIR, f)).isDirectory())
    .filter(f => /^\d{2}-/.test(f)); // Match folders like "01-architecture"
  return folders;
}

// Compliance check functions
function checkDocumentationStructure(agentPath, agentName) {
  const score = {
    current: fileExists(path.join(agentPath, 'current')) ? 1 : 0,
    working: fileExists(path.join(agentPath, 'working')) ? 1 : 0,
    versions: fileExists(path.join(agentPath, 'versions')) ? 1 : 0,
    stateJson: fileExists(path.join(agentPath, 'STATE.json')) ? 1 : 0,
    changelog: fileExists(path.join(agentPath, 'CHANGELOG.md')) ? 1 : 0,
    backlog: fileExists(path.join(agentPath, 'backlog.json')) ? 1 : 0
  };
  
  const violations = [];
  if (!score.current) violations.push(`Missing current/ folder`);
  if (!score.working) violations.push(`Missing working/ folder`);
  if (!score.versions) violations.push(`Missing versions/ folder`);
  if (!score.stateJson) violations.push(`Missing STATE.json`);
  if (!score.changelog) violations.push(`Missing CHANGELOG.md`);
  if (!score.backlog) violations.push(`Missing backlog.json`);
  
  const totalScore = Object.values(score).reduce((a, b) => a + b, 0);
  return {
    score: (totalScore / 6) * 100,
    violations,
    details: score
  };
}

function checkStateJsonFormat(agentPath, agentName) {
  const stateJsonPath = path.join(agentPath, 'STATE.json');
  const state = readJSON(stateJsonPath);
  
  if (!state) {
    return {
      score: 0,
      violations: ['STATE.json is missing or invalid'],
      details: {}
    };
  }
  
  const requiredFields = ['agentNumber', 'currentVersion', 'status', 'lastUpdated'];
  const score = {};
  const violations = [];
  
  requiredFields.forEach(field => {
    score[field] = state[field] ? 1 : 0;
    if (!state[field]) {
      violations.push(`STATE.json missing required field: ${field}`);
    }
  });
  
  // Check status values
  const validStatuses = ['planning', 'in-progress', 'complete', 'active'];
  if (state.status && !validStatuses.includes(state.status)) {
    violations.push(`Invalid status value: ${state.status}`);
    score.validStatus = 0;
  } else {
    score.validStatus = 1;
  }
  
  const totalScore = Object.values(score).reduce((a, b) => a + b, 0);
  return {
    score: (totalScore / 5) * 100,
    violations,
    details: score
  };
}

function checkProjectUpdates(agentName) {
  const violations = [];
  let score = 0;
  
  // Check AGENTS.md
  const agentsMd = readFile(AGENTS_MD);
  if (agentsMd) {
    const agentRegex = new RegExp(`${agentName}`, 'i');
    if (agentsMd.match(agentRegex)) {
      score += 1;
    } else {
      violations.push(`Agent not found in AGENTS.md`);
    }
  }
  
  // Check MANIFEST.md
  const manifestMd = readFile(MANIFEST_MD);
  if (manifestMd) {
    const manifestRegex = new RegExp(`${agentName}`, 'i');
    if (manifestMd.match(manifestRegex)) {
      score += 1;
    } else {
      violations.push(`Agent documents not found in MANIFEST.md`);
    }
  }
  
  // Check CLAUDE.md (for completed agents)
  const claudeMd = readFile(CLAUDE_MD);
  if (claudeMd) {
    const claudeRegex = new RegExp(`${agentName}.*v\\d+\\.\\d+`, 'i');
    if (claudeMd.match(claudeRegex)) {
      score += 1;
    } else {
      violations.push(`Agent completion not reflected in CLAUDE.md`);
    }
  }
  
  return {
    score: (score / 3) * 100,
    violations,
    details: { agentsMd: score >= 1, manifestMd: score >= 2, claudeMd: score === 3 }
  };
}

function checkBacklogFormat(agentPath, agentName) {
  const backlogPath = path.join(agentPath, 'backlog.json');
  const backlog = readJSON(backlogPath);
  
  if (!backlog) {
    return {
      score: 0,
      violations: ['backlog.json is missing or invalid'],
      details: {}
    };
  }
  
  const violations = [];
  let score = 0;
  
  // Check structure
  if (backlog.backlog && Array.isArray(backlog.backlog)) {
    score += 1;
    
    // Check each item
    const requiredFields = ['id', 'fromAgent', 'toAgent', 'requestDate', 'priority', 'status', 'request'];
    let itemsValid = true;
    
    backlog.backlog.forEach((item, index) => {
      requiredFields.forEach(field => {
        if (!item[field]) {
          violations.push(`Backlog item ${index} missing required field: ${field}`);
          itemsValid = false;
        }
      });
    });
    
    if (itemsValid) score += 1;
  } else {
    violations.push('backlog.json missing "backlog" array');
  }
  
  return {
    score: (score / 2) * 100,
    violations,
    details: { hasStructure: score >= 1, itemsValid: score === 2 }
  };
}

// Main compliance check
function checkAgentCompliance(agentFolder) {
  const agentPath = path.join(AGENTS_DIR, agentFolder);
  const agentName = agentFolder;
  
  console.log(`\nChecking ${agentName}...`);
  
  const compliance = {
    documentationStructure: checkDocumentationStructure(agentPath, agentName),
    stateJsonFormat: checkStateJsonFormat(agentPath, agentName),
    projectUpdates: checkProjectUpdates(agentName),
    backlogFormat: checkBacklogFormat(agentPath, agentName)
  };
  
  // Calculate overall score
  const scores = Object.values(compliance).map(c => c.score);
  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Collect all violations
  const allViolations = [];
  Object.entries(compliance).forEach(([category, result]) => {
    result.violations.forEach(v => allViolations.push(`[${category}] ${v}`));
  });
  
  return {
    name: agentName,
    score: overallScore,
    grade: getGrade(overallScore),
    compliance,
    violations: allViolations
  };
}

function getGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 70) return 'C';
  if (score >= 60) return 'D';
  return 'F';
}

// Generate report
function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('MILE QUEST AUTOMATED COMPLIANCE REPORT');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString().split('T')[0]}`);
  console.log(`Total Agents Checked: ${results.summary.totalAgents}`);
  console.log(`Overall Compliance Score: ${results.summary.totalScore.toFixed(1)}%`);
  console.log(`Overall Grade: ${getGrade(results.summary.totalScore)}`);
  
  console.log('\n## Agent Scores Summary\n');
  console.log('| Agent | Score | Grade | Violations |');
  console.log('|-------|-------|-------|------------|');
  
  Object.values(results.agents).forEach(agent => {
    console.log(`| ${agent.name} | ${agent.score.toFixed(1)}% | ${agent.grade} | ${agent.violations.length} |`);
  });
  
  console.log('\n## Top Violations\n');
  const violationCounts = {};
  Object.values(results.agents).forEach(agent => {
    agent.violations.forEach(v => {
      const category = v.match(/\[(.*?)\]/)?.[1] || 'other';
      violationCounts[category] = (violationCounts[category] || 0) + 1;
    });
  });
  
  Object.entries(violationCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([category, count]) => {
      console.log(`- ${category}: ${count} violations`);
    });
  
  console.log('\n## Detailed Violations by Agent\n');
  Object.values(results.agents).forEach(agent => {
    if (agent.violations.length > 0) {
      console.log(`### ${agent.name} (${agent.score.toFixed(1)}%)`);
      agent.violations.forEach(v => console.log(`- ${v}`));
      console.log('');
    }
  });
  
  // Save report
  const reportPath = path.join(PROJECT_ROOT, 'docs/agents/13-compliance/current/automated-compliance-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed report saved to: ${reportPath}`);
}

// Main execution
function main() {
  console.log('Starting Mile Quest Compliance Check...');
  
  const agentFolders = getAgentFolders();
  results.summary.totalAgents = agentFolders.length;
  
  agentFolders.forEach(folder => {
    const agentResult = checkAgentCompliance(folder);
    results.agents[folder] = agentResult;
  });
  
  // Calculate overall score
  const totalScores = Object.values(results.agents).map(a => a.score);
  results.summary.totalScore = totalScores.reduce((a, b) => a + b, 0) / totalScores.length;
  
  generateReport();
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkAgentCompliance, main };