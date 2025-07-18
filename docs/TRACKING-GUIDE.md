# Mile Quest Tracking System Guide

**Version**: 2.0 - Simplified  
**Created**: 2025-01-18  
**Purpose**: Define the simplified task tracking system for Mile Quest

## 📋 Overview

Mile Quest uses a three-part tracking system designed for clarity and simplicity:

1. **SPRINT-TRACKING.md** - Development task tracking (single source of truth)
2. **AGENTS.md** - High-level agent status
3. **Agent backlogs** - Simple inter-agent recommendations

## 🎯 Core Principles

1. **One Source of Truth**: SPRINT-TRACKING.md for all development work
2. **Simple is Better**: Minimal fields, clear purpose
3. **Update Immediately**: Update tracking when work is done, not later
4. **Git is History**: Commits show what actually happened

## 📁 Tracking System Components

### 1. SPRINT-TRACKING.md (Primary)

**Purpose**: Track ALL development work  
**Location**: `/docs/SPRINT-TRACKING.md`  
**Update**: Immediately when tasks are completed  

**Contents**:
- Current sprint status
- Task completion status
- Next priority tasks
- Overall project progress

**Example Entry**:
```markdown
| Task ID | Description | Status | Owner | Notes |
|---------|-------------|--------|-------|-------|
| BE-001 | Lambda Project Structure | ✅ Complete | Backend Dev | Full structure created |
| BE-005 | Logging Service | 🔴 Not Started | - | - |
```

### 2. AGENTS.md (Status Overview)

**Purpose**: Show which agents are active and their general status  
**Location**: `/AGENTS.md`  
**Update**: When agent status changes (rarely)  

**Contents**:
- Agent active/inactive status
- Current focus area
- Last activity date
- NO detailed task lists

### 3. Agent Backlogs (Recommendations Only)

**Purpose**: Track recommendations between agents  
**Location**: `/docs/agents/[number]-[name]/backlog.json`  
**Update**: When agents recommend work to each other  

**Simple Structure**:
```json
{
  "backlog": [
    {
      "id": "simple-id",
      "from": "requesting-agent",
      "request": "What needs to be done",
      "priority": "high|medium|low",
      "status": "pending|accepted|declined"
    }
  ]
}
```

**NOT Allowed in Backlogs**:
- ❌ Task breakdowns
- ❌ Sprint assignments
- ❌ Development details
- ❌ Effort estimates
- ❌ Complex nested structures

## 🚫 What We're Removing

The following tracking mechanisms are being deprecated:
- ❌ master-task-dashboard.md
- ❌ feature-tracking.md
- ❌ Complex backlog v2.0 features (tasks within backlogs)
- ❌ Multiple overlapping tracking documents
- ❌ task-status.json (if SPRINT-TRACKING.md is kept current)

## ✅ When to Update What

### Completing Development Work
1. Update SPRINT-TRACKING.md immediately
2. Commit your code with clear message
3. That's it!

### Agent Recommendations
1. Add simple entry to target agent's backlog.json
2. Keep it to one sentence
3. Don't add implementation details

### Starting New Sprint
1. Update SPRINT-TRACKING.md with new sprint section
2. List all tasks for the sprint
3. Update AGENTS.md if agent focus changes

## 📝 Examples

### Good Backlog Entry
```json
{
  "id": "api-01",
  "from": "security",
  "request": "Add rate limiting to authentication endpoints",
  "priority": "high",
  "status": "pending"
}
```

### Bad Backlog Entry (Too Complex)
```json
{
  "id": "api-01",
  "from": "security",
  "request": "Add rate limiting...",
  "tasks": [
    {"id": "TASK-1", "description": "Implement rate limiter"},
    {"id": "TASK-2", "description": "Add Redis cache"}
  ],
  "sprint": 3,
  "effort": "16 hours"
}
```

## 🔄 Migration Plan

1. Keep SPRINT-TRACKING.md as is (it's already good)
2. Simplify all backlog.json files to basic structure
3. Archive old tracking documents to `/docs/archive/`
4. Update AGENTS.md to remove task details
5. Document the change in CHANGELOG

## 📏 Success Metrics

The new system is working if:
- ✅ Developers only update ONE place (SPRINT-TRACKING.md)
- ✅ No confusion about where to look for status
- ✅ Backlog entries fit in 3 lines
- ✅ Updates happen immediately, not days later
- ✅ New team members understand it in 5 minutes

---

**Remember**: If you're wondering where to update something, the answer is probably SPRINT-TRACKING.md!