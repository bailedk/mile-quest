# Backlog System Compliance Criteria v2.0

**Effective Date**: 2025-01-18  
**Version**: 2.0  
**Agent**: Compliance Agent  

## Overview

This document defines compliance criteria for the Enhanced Backlog System v2.0, which now supports granular task tracking within backlog items.

## Compliance Metrics

### 1. Backlog Maintenance (Weight: 20%)

**Requirements**:
- ✅ Each agent MUST have a `backlog.json` file
- ✅ Backlog structure MUST follow enhanced schema
- ✅ All fields MUST be properly populated
- ✅ Status progression MUST be tracked

**Scoring**:
- File exists and valid JSON: 5 points
- Proper structure used: 5 points
- Fields populated correctly: 5 points
- Status updates tracked: 5 points

### 2. Task Tracking (Weight: 25%) - NEW

**Requirements**:
- ✅ Development items MUST include task breakdown
- ✅ Tasks MUST have unique IDs matching specifications
- ✅ Task status MUST be updated as work progresses
- ✅ Dependencies MUST be respected
- ✅ Acceptance criteria MUST be defined

**Scoring**:
- Tasks properly structured: 5 points
- Task IDs match spec: 5 points
- Status updates current: 5 points
- Dependencies tracked: 5 points
- Acceptance criteria present: 5 points

### 3. Sprint Alignment (Weight: 15%) - NEW

**Requirements**:
- ✅ Sprint assignments MUST match development plan
- ✅ Sprint work MUST be completed in order
- ✅ Cross-sprint dependencies MUST be managed

**Scoring**:
- Sprint field used correctly: 5 points
- Work aligns with sprint: 5 points
- Dependencies managed: 5 points

### 4. Approval Workflow (Weight: 15%)

**Requirements**:
- ✅ Items MUST have approval before work begins
- ✅ Approval date MUST be recorded
- ✅ User approval MUST be obtained for changes

**Scoring**:
- Approval status tracked: 5 points
- Dates recorded: 5 points
- User approval documented: 5 points

### 5. Progress Reporting (Weight: 15%)

**Requirements**:
- ✅ In-progress items MUST show task progress
- ✅ Completed items MUST have completion dates
- ✅ Blocked items MUST document blockers

**Scoring**:
- Progress visible: 5 points
- Completion dates present: 5 points
- Blockers documented: 5 points

### 6. Cross-Agent Coordination (Weight: 10%)

**Requirements**:
- ✅ FromAgent field MUST be accurate
- ✅ Dependencies on other agents MUST be noted
- ✅ Value proposition MUST be clear

**Scoring**:
- From/to agents correct: 3 points
- Dependencies noted: 4 points
- Value documented: 3 points

## Audit Process

### Automated Checks

```javascript
// Backlog structure validation
function validateBacklog(backlog) {
  return backlog.every(item => {
    // Standard fields
    if (!item.id || !item.status || !item.request) return false;
    
    // Enhanced fields for dev items
    if (item.tasks) {
      return item.tasks.every(task => 
        task.id && 
        task.status && 
        task.acceptanceCriteria?.length > 0
      );
    }
    return true;
  });
}

// Task progress calculation
function calculateProgress(item) {
  if (!item.tasks) return item.status === 'completed' ? 100 : 0;
  
  const completed = item.tasks.filter(t => t.status === 'completed').length;
  return (completed / item.tasks.length) * 100;
}
```

### Manual Review Points

1. **Task Quality**
   - Are tasks appropriately sized (4-8 hours)?
   - Do acceptance criteria match specifications?
   - Are dependencies logical?

2. **Status Accuracy**
   - Does status reflect actual work state?
   - Are in-progress items actively worked?
   - Are completed dates reasonable?

3. **Sprint Discipline**
   - Is sprint work focused?
   - Are agents completing sprints before moving on?
   - Are critical path items prioritized?

## Compliance Scoring

### Grade Calculation
```
Total Score = (BM × 0.20) + (TT × 0.25) + (SA × 0.15) + 
              (AW × 0.15) + (PR × 0.15) + (CA × 0.10)

Where:
- BM = Backlog Maintenance score (0-20)
- TT = Task Tracking score (0-25)
- SA = Sprint Alignment score (0-15)
- AW = Approval Workflow score (0-15)
- PR = Progress Reporting score (0-15)
- CA = Cross-Agent Coordination score (0-10)
```

### Grade Thresholds
- A+ (95-100): Exceptional backlog management
- A (90-94): Excellent compliance
- B (80-89): Good compliance
- C (70-79): Acceptable compliance
- D (60-69): Needs improvement
- F (<60): Non-compliant

## Reporting

### Monthly Audit Report Includes

1. **Overall Scores**
   - Project-wide compliance score
   - Individual agent scores
   - Trend analysis

2. **Task Metrics**
   - Total tasks planned vs completed
   - Average task completion time
   - Dependency violation count
   - Sprint velocity

3. **Recommendations**
   - Specific improvements per agent
   - Process optimization suggestions
   - Tool enhancement needs

## Non-Compliance Consequences

1. **Warning** (First occurrence)
   - Agent notified of issues
   - Remediation plan required

2. **Backlog Review** (Second occurrence)
   - BA Agent reviews and reorganizes backlog
   - Additional tracking required

3. **Escalation** (Continued issues)
   - Project-level intervention
   - Process revision consideration

## Tools for Compliance

### Check Your Compliance
```bash
node scripts/backlog-compliance.js check [agent-number]
```

### Generate Compliance Report
```bash
node scripts/backlog-compliance.js report
```

### Fix Common Issues
```bash
node scripts/backlog-compliance.js fix [agent-number]
```

## Best Practices for Compliance

1. **Update Daily**
   - Change task status when starting work
   - Mark completions immediately
   - Add blockers as they occur

2. **Review Weekly**
   - Verify all statuses accurate
   - Update effort estimates
   - Clean up completed items

3. **Plan Sprints**
   - Only take on achievable work
   - Respect dependencies
   - Communicate blockers early

---

The enhanced backlog system provides better visibility while maintaining the flexibility of the living agent model. Compliance ensures we gain the benefits of detailed tracking without losing agility.