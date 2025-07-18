# Enhanced Backlog System v2.0

**Version**: 2.0  
**Effective Date**: 2025-01-18  
**Status**: Active  

## Overview

The Enhanced Backlog System builds upon the existing agent backlog infrastructure to support both high-level feature requests and granular development task tracking. This unified approach maintains the living agent model while enabling detailed sprint planning and progress tracking.

## Key Enhancements

### 1. Task Breakdown Structure
Backlog items can now contain embedded tasks for granular tracking:
- Individual task status tracking
- Effort estimation at task level
- Inter-task dependencies
- Acceptance criteria per task

### 2. Sprint Assignment
Optional sprint field for planning:
- Assign backlog items to sprints
- Track velocity across sprints
- Support both sprint-based and continuous flow

### 3. Enhanced Status Tracking
New "in-progress" status:
- `pending` - Awaiting approval
- `approved` - Ready to work
- `in-progress` - Actively being worked on
- `completed` - All work finished
- `rejected` - Not approved for implementation

## Backlog Structure

### Standard Backlog Item (Unchanged)
```json
{
  "id": "api-001",
  "fromAgent": "03-data-model",
  "toAgent": "04-api-designer",
  "requestDate": "2025-01-15",
  "priority": "high",
  "status": "approved",
  "request": "Add pagination to endpoints",
  "reason": "Performance optimization needed",
  "value": "Reduces API response time",
  "approvedBy": "user",
  "approvalDate": "2025-01-15",
  "completedDate": null
}
```

### Enhanced Development Item (New)
```json
{
  "id": "fe-sprint0-bundle",
  "fromAgent": "15-development-planning",
  "toAgent": "16-frontend-developer",
  "requestDate": "2025-01-18",
  "priority": "high",
  "status": "in-progress",
  "request": "Complete Sprint 0 Frontend Setup",
  "reason": "Foundation required for development",
  "value": "Enables parallel frontend work",
  "approvedBy": "user",
  "approvalDate": "2025-01-18",
  "completedDate": null,
  "sprint": 0,
  "tasks": [
    {
      "id": "FE-001",
      "description": "Initialize Next.js project",
      "effort": "4 hours",
      "status": "completed",
      "completedDate": "2025-01-18T14:00:00Z",
      "dependencies": [],
      "acceptanceCriteria": [
        "Next.js 14 with App Router configured",
        "TypeScript enabled",
        "Development server running"
      ]
    },
    {
      "id": "FE-002",
      "description": "Configure TypeScript and ESLint",
      "effort": "4 hours",
      "status": "in-progress",
      "completedDate": null,
      "dependencies": ["FE-001"],
      "acceptanceCriteria": [
        "Strict TypeScript rules enabled",
        "ESLint with React rules",
        "Pre-commit hooks configured"
      ]
    }
  ]
}
```

## Working with Enhanced Backlogs

### For Agents Adding Items

1. **Simple Requests** (existing workflow)
   - Add standard backlog item
   - Request user approval
   - No changes to current process

2. **Development Tasks** (new workflow)
   - Bundle related tasks into single backlog item
   - Include task breakdown with IDs
   - Specify dependencies and acceptance criteria
   - Assign to sprint if applicable

### For Agents Processing Items

1. **Check Your Backlog**
   ```bash
   cat docs/agents/[your-number]/backlog.json
   ```

2. **Process Items with Tasks**
   - Update individual task status as you work
   - Mark tasks "in-progress" when starting
   - Complete tasks in dependency order
   - Update parent item status based on task progress

3. **Status Progression**
   - Parent item: `approved` → `in-progress` → `completed`
   - Tasks: `pending` → `in-progress` → `completed`

## Progress Tracking

### Task-Level Tracking
```javascript
// Count completed tasks
const completedTasks = item.tasks.filter(t => t.status === 'completed').length;
const totalTasks = item.tasks.length;
const progress = (completedTasks / totalTasks) * 100;
```

### Sprint Progress
```javascript
// Get all sprint 0 items across agents
const sprint0Items = allBacklogs
  .flatMap(b => b.backlog)
  .filter(item => item.sprint === 0);
```

### Dashboard Generation
The TASK-BOARD.md can be auto-generated from backlog data:
- Aggregates tasks across all agents
- Shows sprint progress
- Identifies blockers (task dependencies)
- Tracks velocity

## Migration Guide

### For Existing Backlog Items
No action required - existing items work as-is.

### For Development Planning Agent
1. Create bundled backlog items with tasks
2. Distribute to developer agent backlogs
3. Set sprint assignments
4. Include all task details from specifications

### For Developer Agents
1. Review enhanced backlog items
2. Work through embedded tasks
3. Update task status individually
4. Use dependencies to guide order

## Best Practices

### DO
- ✅ Keep standard items simple (no tasks needed)
- ✅ Use tasks for multi-step development work
- ✅ Update task status as you progress
- ✅ Check dependencies before starting tasks
- ✅ Include clear acceptance criteria

### DON'T
- ❌ Add tasks to every backlog item
- ❌ Create deeply nested task hierarchies
- ❌ Skip status updates on long tasks
- ❌ Ignore task dependencies
- ❌ Modify another agent's backlog directly

## Compliance Tracking

The Compliance Agent will track:
1. **Backlog Maintenance** - Regular updates to backlog.json
2. **Task Completion** - Tasks marked complete when done
3. **Status Accuracy** - Status reflects actual state
4. **Sprint Alignment** - Development follows sprint plan
5. **Dependency Respect** - Tasks completed in order

## Tools and Scripts

### View Sprint Tasks
```bash
node scripts/backlog-utils.js sprint 0
```

### Check Agent Progress
```bash
node scripts/backlog-utils.js agent 16-frontend-developer
```

### Generate Task Board
```bash
node scripts/backlog-utils.js generate-board > docs/TASK-BOARD.md
```

## Benefits

1. **Unified System** - One backlog for all work types
2. **Flexible Granularity** - Simple or detailed as needed
3. **Progress Visibility** - Track at multiple levels
4. **Maintains Approval Flow** - User control preserved
5. **Backwards Compatible** - Existing items unchanged

## FAQ

**Q: Do all backlog items need tasks?**
A: No, only use tasks for multi-step development work.

**Q: Can I add tasks to an existing item?**
A: Yes, update the backlog.json with task array.

**Q: How do I track cross-agent dependencies?**
A: Use task IDs in the dependencies array (e.g., "INT-001").

**Q: What if a task is blocked?**
A: Update task status to include blocker info in description.

---

This enhanced system provides the granularity needed for development while preserving the elegant simplicity of the original agent backlog design.