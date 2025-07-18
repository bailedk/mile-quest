# GitHub Project Board Setup

This document describes how to set up a GitHub Project board for tracking Mile Quest development tasks.

## Creating the Project Board

1. Go to the Mile Quest repository on GitHub
2. Click on "Projects" tab
3. Create a new project with these settings:
   - Name: "Mile Quest Development"
   - Template: "Board"
   - Visibility: Same as repository

## Board Columns

Create these columns:
1. **📋 Backlog** - Tasks not yet started
2. **🚧 Sprint 0** - Current sprint tasks
3. **👨‍💻 In Progress** - Tasks being worked on
4. **👀 Review** - Tasks pending review
5. **✅ Done** - Completed tasks

## Task Labels

Create these labels for categorizing tasks:

### Developer Labels
- `backend` - Backend API Developer tasks
- `frontend` - Frontend Developer tasks
- `database` - Database Developer tasks
- `integration` - Integration Developer tasks
- `pwa` - Mobile/PWA Developer tasks

### Sprint Labels
- `sprint-0` - Foundation Setup
- `sprint-1` - Authentication
- `sprint-2` - Team Management
- `sprint-3` - Activity Tracking
- `sprint-4` - Dashboard
- `sprint-5` - Real-time
- `sprint-6` - PWA
- `sprint-7` - Polish & Deploy

### Priority Labels
- `critical-path` - Blocks other work
- `high-priority` - Sprint goal dependency
- `medium-priority` - Should complete this sprint
- `low-priority` - Nice to have

### Status Labels
- `blocked` - Waiting on dependency
- `at-risk` - May not complete on time
- `help-wanted` - Need assistance

## Creating Issues from Tasks

For each task in the task specifications:

```markdown
Title: [BE-001] Set up Lambda project structure

## Description
Create organized Lambda project structure with handlers, services, middleware, and utilities.

## Acceptance Criteria
- [ ] Directory structure created (handlers/, services/, middleware/, utils/, config/)
- [ ] Lambda handler factory implemented
- [ ] Routing system functional
- [ ] Build process updated

## Sprint
Sprint 0 - Foundation Setup

## Dependencies
None

## Effort
6 hours

## Labels
- backend
- sprint-0
- high-priority
```

## Automation Rules

Set up these automations:
1. When issue is assigned → Move to "In Progress"
2. When PR is linked → Move to "Review"
3. When PR is merged → Move to "Done"
4. When "blocked" label added → Add 🔴 emoji

## Daily Updates

Each developer should:
1. Move their cards across the board
2. Update issue comments with progress
3. Flag blockers with the "blocked" label
4. Close issues when complete

## Sprint Transitions

At sprint end:
1. Move incomplete tasks to next sprint column
2. Archive done column
3. Create new sprint column
4. Update sprint labels

## Tracking Metrics

The project board provides:
- Sprint velocity (cards completed)
- Burndown visualization
- Blocker identification
- Developer workload balance