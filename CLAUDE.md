# Claude Code Context Guide - Mile Quest

## 🎯 Project Overview

Mile Quest is a mobile-first team walking challenge platform where teams set geographic goals and track collective walking distances. This document provides context and guidelines for Claude Code to effectively work on this project.

## 📍 How to Navigate This Project

**For Current Status**: Check AGENTS.md
**For Documentation Index**: Check docs/MANIFEST.md  
**For Specific Agent Work**: Check docs/agents/[number]-[name]/current/
**For Guidelines**: Check docs/GUIDELINES.md
**For Living Agents Model**: Check docs/LIVING-AGENTS.md

## 🗂️ Documentation Structure

### Where to Find Current Documentation

Each agent's documentation is organized as follows:
```
docs/agents/[agent-number]-[agent-name]/
├── current/          # 📌 ALWAYS USE THIS FOR CURRENT STATE
│   ├── README.md     # Agent overview and status
│   ├── design.md     # Main design/architecture document
│   └── decisions.md  # Key decisions and rationale
├── versions/         # Historical versions (v1.0, v2.0, etc.)
├── working/          # Draft changes (not yet current)
├── STATE.json        # Agent state and version info
├── CHANGELOG.md      # Change history
├── backlog.json      # Incoming requests from other agents
└── recommendations.md # Suggestions for other agents
```

### 🚨 Important: Always check `current/` folder for the active documentation!

## 📋 Where to Find Agent Documentation

**Important**: Agent numbers (01, 02, etc.) are identification numbers only. They do NOT indicate order of execution or priority. Agents can work independently and in parallel as dependencies allow.

- **01-architecture/** - System design, tech stack, infrastructure
- **02-ui-ux/** - Wireframes, design system, user journeys
- **03-data-model/** - Database schema, entities, access patterns
- **04-api-designer/** - API contracts, endpoints, types
- **05-map-integration/** - Mapping features and route calculations
- **06-security/** - Authentication, authorization, privacy
- **07-mobile-optimization/** - PWA, offline, performance
- **08-integration/** - External APIs, webhooks, sync
- **09-analytics-gamification/** - Achievements, leaderboards, metrics
- **10-testing-qa/** - Test strategies, automation, quality
- **11-devops/** - CI/CD, deployment, monitoring
- **12-review-enhancement/** - Cross-agent reviews and improvements
- **13-compliance/** - Project rule enforcement and compliance auditing

## 🤖 How Agents Should Operate

### Agent Responsibilities

Each agent MUST:

1. **Update Their Own Documentation**
   - Work in their designated folder under `/docs/agents/[number]-[name]/`
   - Update STATE.json with progress and decisions
   - Create/update CHANGELOG.md with deliverables
   - Keep current/ folder with active documentation

2. **Update Project-Wide Status Files**
   - ✅ Update AGENTS.md when starting and completing work
   - ✅ Update MANIFEST.md when adding new documents
   - ✅ Mark dependencies as complete/pending

3. **Make Recommendations for Other Agents**
   - Document suggestions in a `recommendations.md` file
   - Note integration points and dependencies
   - Flag potential conflicts or improvements
   - Example: "API Designer recommends Security Agent implement rate limiting"

4. **Document Dependencies**
   - List what you need from other agents in STATE.json
   - List what you provide to other agents
   - Update when dependencies are satisfied
   - Alert if blocked by missing dependencies

5. **Manage Your Backlog** (NEW)
   - Maintain a `backlog.json` file in your agent folder
   - Track incoming requests from other agents
   - Prioritize and process backlog items
   - Update status when items are completed

### Agent Workflow

**When Starting:**
1. Update AGENTS.md - Mark your agent as "🚧 In Progress"
2. Check dependencies - Ensure required agents are complete
3. Read dependent documentation - Review all current/ folders you need
4. Check your backlog.json - Review any pending requests
5. Create working/ folder - Start drafts there
6. Update STATE.json - Track your progress

**When Delivering a Milestone:**
1. Move docs from working/ to current/
2. Update AGENTS.md - Update status and current focus
3. Update MANIFEST.md - Change doc status to "📌 Current"
4. Update CHANGELOG.md - Document deliverables and version
5. Write recommendations.md - Suggestions for other agents
6. Update backlog.json - Mark completed items, add new tasks
7. Request BA to add recommendations to other agents' backlogs

## 📋 Agent Backlog System

### Purpose
The backlog system ensures cross-agent recommendations are tracked, reviewed, and implemented systematically. Each agent maintains their own backlog of incoming requests from other agents.

### Backlog Structure
Each agent maintains a `backlog.json` file in their agent folder:
```json
{
  "backlog": [
    {
      "id": "unique-id",
      "fromAgent": "03-data-model",
      "toAgent": "04-api-designer",
      "requestDate": "2025-01-15",
      "priority": "high|medium|low",
      "status": "pending|approved|rejected|completed",
      "request": "Add pagination to team activity endpoints",
      "reason": "Large teams generate thousands of activities",
      "value": "Improves performance and reduces database load",
      "approvedBy": "user|null",
      "approvalDate": "2025-01-15|null",
      "completedDate": "null"
    }
  ]
}
```

### How to Add Items to Another Agent's Backlog

When an agent identifies work needed from another agent:

1. **Document the Recommendation**
   - Add to your `recommendations.md` file
   - Include specific details about what's needed

2. **Request User Approval**
   - Ask: "Should I add this to [Agent Name]'s backlog?"
   - Provide:
     - The specific request
     - Reason it's needed
     - Value it provides

3. **User Response Options**
   - **Yes**: Add to target agent's backlog with status "approved"
   - **No**: Add to target agent's backlog with status "rejected"
   - User may provide additional context or modifications

4. **Update Target Agent's Backlog**
   - Add the new item to their `backlog.json`
   - Include all required fields
   - Set appropriate priority

### Processing Your Backlog

When starting work as an agent:

1. **Review Backlog Items**
   - Check `backlog.json` for approved items
   - Prioritize based on dependencies and value

2. **Implement Approved Items**
   - Work on high-priority approved items first
   - Update status to "completed" when done
   - Add completion date

3. **Defer If Necessary**
   - Document why items are deferred
   - Keep status as "approved" for future work

### Example Interaction

```
Agent: "The Data Model Agent recommends adding pagination to the team activity endpoints because large teams can generate thousands of activities. This would improve performance and reduce database load. Should I add this to the API Designer's backlog?"

User: "Yes"

Agent: "Added to API Designer's backlog as an approved high-priority item."
```

### Backlog Best Practices

1. **Be Specific** - Clearly describe what needs to be done
2. **Explain Value** - Always include why the change matters
3. **Set Priority** - Use high/medium/low based on impact
4. **Track Status** - Keep backlog items updated
5. **Clean Regularly** - Archive completed items periodically

## 🛠️ Working on Mile Quest

### When Starting a Task

1. **Check CLAUDE.md** (this file) for documentation structure
2. **Read AGENTS.md** for current project status
3. **Check docs/MANIFEST.md** for documentation index
4. **Review relevant agent folders** for context
5. **Follow docs/GUIDELINES.md** for updates

### When Making Updates

#### For Existing Agents:
1. Work in the agent's `working/` folder first
2. When ready, move to `current/` folder
3. Update STATE.json with new version
4. Add entry to CHANGELOG.md
5. Update docs/MANIFEST.md if needed

#### For New Features:
1. Identify which agent owns the feature
2. Check dependencies in other agents
3. Create new files in appropriate `working/` folder
4. Follow established patterns from `current/` docs

### Version Management

- **Minor Updates** (2.0 → 2.1): Refinements, clarifications
- **Major Updates** (2.0 → 3.0): Significant changes, new approach
- **Always preserve old versions** in versions/ folder

## 📚 Key Documentation References

### Architecture Documentation
- **MVP Architecture**: `docs/agents/01-architecture/current/mvp-architecture.md`
- **Infrastructure**: `docs/agents/01-architecture/current/infrastructure-diagram-mvp.md`
- **Tech Stack**: `docs/agents/01-architecture/current/tech-stack-mvp.md`
- **Service Patterns**: `docs/agents/01-architecture/current/external-service-abstraction-pattern.md`

### UI/UX Documentation  
- **Wireframes**: `docs/agents/02-ui-ux/current/mvp-wireframes.md`
- **Design System**: `docs/agents/02-ui-ux/current/design-system.md`
- **User Journeys**: `docs/agents/02-ui-ux/current/user-journeys.md`

### Data Model Documentation
- **Schema**: `docs/agents/03-data-model/current/prisma-schema.md`
- **Entities**: `docs/agents/03-data-model/current/core-entities.md`
- **Access Patterns**: `docs/agents/03-data-model/current/data-access-patterns.md`

## 🔐 Critical Patterns to Follow

### External Service Abstraction (MANDATORY)
All external services MUST be abstracted behind interfaces:
```typescript
// ❌ BAD: Direct usage
import Pusher from 'pusher-js';

// ✅ GOOD: Abstracted
import { WebSocketService } from '@/services/websocket';
```

This applies to: Cognito, Pusher, SES, Mapbox, Analytics, etc.
See: `docs/agents/01-architecture/current/external-service-abstraction-pattern.md`

### Privacy-Aware Queries
Always respect the `isPrivate` flag on activities:
```typescript
// Public leaderboards exclude private activities
WHERE isPrivate = false

// Team totals include ALL activities (private + public)
SUM(distance) // No privacy filter for team goals
```

See: `docs/agents/03-data-model/current/data-access-patterns.md#privacy-considerations`

## 📝 Quick Commands

### Find Current Architecture
```
cat docs/agents/01-architecture/current/mvp-architecture.md
```

### Find Current UI Design
```
cat docs/agents/02-ui-ux/current/mvp-wireframes.md
```

### Check Documentation Index
```
cat docs/MANIFEST.md
```

### View Update Guidelines
```
cat docs/GUIDELINES.md
```

## ⚠️ Common Pitfalls to Avoid

1. **Don't edit files in versions/ folder** - they're historical
2. **Don't assume original architecture** - we're using simplified MVP
3. **Don't add complex features** - follow progressive rollout
4. **Don't skip STATE.json updates** - version tracking is critical
5. **Don't create files outside agent structure** - maintain organization
6. **Don't directly use external services** - always use abstraction layer
7. **Don't expose private activities** - respect isPrivate flag
8. **Don't forget to update AGENTS.md** - track your progress
9. **Don't forget to update MANIFEST.md** - index new documents

## 🔄 Regular Maintenance

When working on Mile Quest:
1. Update timestamps in modified files
2. Keep CHANGELOG.md current
3. Update MANIFEST.md for new documents
4. Ensure STATE.json reflects reality
5. Move completed work from working/ to current/

## 📝 Critical Updates When Delivering Agent Work

**IMPORTANT**: When an agent delivers a major milestone, they MUST:
1. **AGENTS.md** - Update status and current focus
2. **MANIFEST.md** - Update document status from "⏳ Planned" to "📌 Current"
3. **CHANGELOG.md** - Document all deliverables and version
4. **STATE.json** - Update version and progress tracking
5. **backlog.json** - Update completed items and add new tasks identified

**Living Agent Model**: Agents are never "complete" - they deliver milestones and remain active for future tasks. Each agent maintains a backlog of pending work and can be reactivated as needed.

**Note**: Historical context is preserved through CHANGELOG.md entries for each major delivery.

---

## 📊 Current Project Status

### Living Agents System
All agents remain active and can receive new tasks through their backlog system. The Business Analyst Agent monitors overall progress and task distribution.

### Agent Status (as of 2025-01-15)
- 📍 **Architecture Agent (01)** - v2.0 - MVP architecture defined, monitoring for updates
- 📍 **UI/UX Design Agent (02)** - v2.0 - MVP designs complete, awaiting implementation feedback
- 📍 **Data Model Agent (03)** - v1.0 - Schema defined, ready for evolution
- 📍 **API Designer Agent (04)** - Ready to begin API contract design
- 📍 **Map Integration Agent (05)** - Awaiting dependencies
- 📍 **Security Agent (06)** - Awaiting API contracts
- 📍 **Mobile Optimization Agent (07)** - Awaiting UI implementation
- 📍 **Integration Agent (08)** - Awaiting API contracts
- 📍 **Analytics & Gamification Agent (09)** - Awaiting core features
- 📍 **Testing & QA Agent (10)** - Awaiting implementation
- 📍 **DevOps Agent (11)** - Ready for infrastructure setup
- 📍 **Review & Enhancement Agent (12)** - v1.0 - Continuous review mode
- 📍 **Compliance Agent (13)** - v1.1 - Monthly audit scheduled (next: Feb 15)
- 📍 **Business Analyst Agent (14)** - v1.0 - Actively monitoring all agent backlogs

### Recent Agent Activity
- Architecture & UI/UX agents delivered MVP designs
- Data Model agent created comprehensive schema
- Review agent provided simplification recommendations
- Compliance agent completed first audit (67.6% score) and created audit schedule
- Business Analyst created implementation roadmap

### Next Priority Tasks
- API Designer needs to create contracts (blocking multiple agents)
- Review Agent needs structure fixes (25% compliance)
- All agents need to implement backlog.json files

**Remember**: This is a living document. Update it whenever the project state changes significantly.

Last Updated: 2025-01-15 (Compliance Agent audit schedule created)