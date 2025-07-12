# Claude Code Context Guide - Mile Quest

## 🎯 Project Overview

Mile Quest is a mobile-first team walking challenge platform where teams set geographic goals and track collective walking distances. This document provides context and guidelines for Claude Code to effectively work on this project.

## 📍 Current Project State

**Project Phase**: MVP Architecture & Design Complete
**Active Development**: Starting Data Model Agent (Agent #3)
**Architecture Version**: 2.0 (Simplified MVP)
**UI/UX Version**: 2.0 (MVP Aligned)

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

## 📋 Active Documentation by Agent

### 1. Architecture Agent (✅ Complete)
- **Current Version**: 2.0 (MVP Simplified)
- **Primary Docs**: 
  - `current/mvp-architecture.md` - Simplified $70/month architecture
  - `current/infrastructure-diagram-mvp.md` - Current infrastructure
- **Superseded**: Original Aurora/ElastiCache architecture in versions/v1.0/

### 2. UI/UX Design Agent (✅ Complete)  
- **Current Version**: 2.0 (MVP Aligned)
- **Primary Docs**:
  - `current/mvp-wireframes.md` - Simplified screens
  - `current/design-system.md` - Component library
  - `current/ui-architecture-alignment.md` - Technical integration
- **Superseded**: Complex features moved to versions/v1.0/

### 3. Data Model Agent (🚧 Next Up)
- **Current Version**: Not started
- **Expected Docs**: Schema, ERD, migrations
- **Dependencies**: Must align with MVP architecture

### 11. Review & Enhancement Agent (✅ Complete)
- **Purpose**: Reviews and improves other agents' work
- **Key Docs**: `recommendations-summary.md`

## 🛠️ Working on Mile Quest

### When Starting a Task

1. **Check CLAUDE.md** (this file) for current state
2. **Read docs/MANIFEST.md** for documentation index
3. **Check relevant agent's current/ folder**
4. **Review STATE.json** for version info
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

## 🏗️ Current Architecture Summary

### MVP Stack (Current)
- **Frontend**: Next.js on Vercel
- **API**: AWS Lambda + API Gateway
- **Database**: RDS PostgreSQL Multi-AZ ($40/month)
- **WebSockets**: Pusher (managed service)
- **Auth**: Cognito with Google Sign-In
- **Storage**: S3 with CloudFront CDN
- **Total Cost**: ~$70/month

### Key Constraints
- No Aurora Serverless (yet) - using RDS PostgreSQL
- No ElastiCache (yet) - CloudFront only
- No custom WebSockets - Pusher managed service
- REST API only - No GraphQL (yet)
- Basic offline - Activity logging only

### Migration Triggers
- RDS → Aurora: >10k users or >100 req/sec
- Pusher → AWS IoT: >1000 concurrent connections
- Add ElastiCache: >50 req/sec
- Add GraphQL: >60% mobile traffic

## 🎨 Current UI/UX Summary

### MVP Features (Week 1)
- Simple onboarding (<2 minutes)
- Team creation/joining
- Activity logging (offline capable)
- Basic progress tracking
- Team activity feed

### Progressive Rollout
- Week 2: Achievements, photos, stats
- Week 3: Leaderboards, notifications
- Week 4: Advanced analytics

### Design Constraints
- Mobile-first (375x667px baseline)
- Optimistic UI updates everywhere
- 44px minimum touch targets
- WCAG 2.1 AA compliance
- Connection-aware UI

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

## 🔄 Regular Maintenance

When working on Mile Quest:
1. Update timestamps in modified files
2. Keep CHANGELOG.md current
3. Update MANIFEST.md for new documents
4. Ensure STATE.json reflects reality
5. Move completed work from working/ to current/

---

**Remember**: This is a living document. Update it whenever the project state changes significantly.

Last Updated: 2025-01-12