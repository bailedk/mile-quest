# 🚨 ATTENTION ALL AGENTS - NEW TRACKING SYSTEM 🚨

**Effective Immediately**: We have simplified our task tracking system.

## What You Need to Know

### 1. For Development Tasks (Sprint Work)
When you complete ANY development task:
- ✅ Update `/docs/SPRINT-TRACKING.md` IMMEDIATELY
- ❌ Do NOT update feature-tracking.md (deprecated)
- ❌ Do NOT update master-task-dashboard.md (deprecated)
- ❌ Do NOT put development tasks in backlog.json

### 2. For Agent Recommendations
When recommending work to another agent:
- ✅ Add a SIMPLE entry to their backlog.json
- ❌ Do NOT include task breakdowns
- ❌ Do NOT include sprint assignments
- ❌ Do NOT include implementation details

### 3. Quick Reference

| What You're Doing | Where to Update |
|-------------------|-----------------|
| Completed a development task | SPRINT-TRACKING.md |
| Starting a development task | SPRINT-TRACKING.md |
| Recommending work to another agent | Their backlog.json |
| Checking development status | SPRINT-TRACKING.md |
| Checking agent status | AGENTS.md |

### 4. Example Updates

**Good - Development Task Update:**
```markdown
# In SPRINT-TRACKING.md
| BE-005 | Logging Service | ✅ Complete | Backend Dev | Implemented with Winston |
```

**Good - Agent Recommendation:**
```json
// In target agent's backlog.json
{
  "id": "sec-01",
  "from": "api-designer",
  "request": "Add rate limiting to auth endpoints",
  "priority": "high",
  "status": "pending"
}
```

**Bad - Don't Do This:**
```json
// DON'T put development tasks in backlog.json
{
  "id": "dev-01",
  "tasks": [{
    "id": "TASK-001",
    "sprint": 2,
    "effort": "8 hours"
  }]
}
```

## Why This Change?

We had multiple tracking systems that got out of sync. Now:
- ONE place for development work (SPRINT-TRACKING.md)
- Simple backlogs for agent collaboration
- No more confusion about where to update

## Questions?

See `/docs/TRACKING-GUIDE.md` for full details.

---

**Remember**: When in doubt, development work goes in SPRINT-TRACKING.md!