# Claude Code Context Guide - Mile Quest

## 🎯 Project Overview

Mile Quest is a mobile-first team walking challenge platform where teams set geographic goals and track collective walking distances. This document provides context and guidelines for Claude Code to effectively work on this project.

## 📍 How to Navigate This Project

**For Current Status**: Check AGENTS.md
**For Documentation Index**: Check docs/MANIFEST.md  
**For Specific Agent Work**: Check docs/agents/[number]-[name]/current/
**For Guidelines**: Check docs/GUIDELINES.md

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
└── CHANGELOG.md      # Change history
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

### Agent Workflow

**When Starting:**
1. Update AGENTS.md - Mark your agent as "🚧 In Progress"
2. Check dependencies - Ensure required agents are complete
3. Read dependent documentation - Review all current/ folders you need
4. Create working/ folder - Start drafts there
5. Update STATE.json - Track your progress

**When Completing:**
1. Move docs from working/ to current/
2. Update AGENTS.md - Mark as "✅ Complete" with date
3. Update MANIFEST.md - Change doc status to "📌 Current"
4. Create CHANGELOG.md - List all deliverables
5. Write recommendations.md - Suggestions for other agents

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

## 📝 Critical Updates When Completing Agent Work

**IMPORTANT**: When an agent completes their work, they MUST update:
1. **AGENTS.md** - Mark agent as complete, update progress to 100%
2. **MANIFEST.md** - Update document status from "⏳ Planned" to "📌 Current"
3. **CLAUDE.md** - Update current project state and active agent
4. **STATE.json** - Update status to "complete" with version
5. **CHANGELOG.md** - Create if missing, document all deliverables

**Note**: The Data Model Agent (Jan 2025) completed work but missed updating AGENTS.md and MANIFEST.md, requiring manual fixes later.

---

**Remember**: This is a living document. Update it whenever the project state changes significantly.

Last Updated: 2025-01-15