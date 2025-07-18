# Developer Coordination Guide - Mile Quest

**Version**: 1.0  
**Created**: 2025-01-18  
**Agent**: Development Planning Agent  
**Status**: Active  

## Overview

This guide provides coordination instructions for all developer agents working on Mile Quest. It includes task assignments, communication protocols, and collaboration guidelines to ensure efficient parallel development.

## Developer Agent Assignments

### Agent 16: Frontend Developer
**Focus**: React components, UI implementation, user experience  
**Total Tasks**: 36 tasks across 7 sprints  
**Primary Technologies**: React 18, TypeScript, Next.js 14, Tailwind CSS  

### Agent 17: Backend API Developer  
**Focus**: API endpoints, business logic, data processing  
**Total Tasks**: 33 tasks across 7 sprints  
**Primary Technologies**: Node.js, AWS Lambda, TypeScript, Prisma  

### Agent 18: Database Developer
**Focus**: Schema implementation, optimization, data integrity  
**Total Tasks**: 16 tasks across 7 sprints  
**Primary Technologies**: PostgreSQL, PostGIS, Prisma, SQL  

### Agent 19: Integration Developer
**Focus**: External services, deployment, monitoring  
**Total Tasks**: 16 tasks across 6 sprints  
**Primary Technologies**: AWS services, WebSocket, Third-party APIs  

### Agent 20: Mobile/PWA Developer
**Focus**: Progressive Web App, offline functionality, mobile UX  
**Total Tasks**: 12 tasks across 4 sprints  
**Primary Technologies**: Service Workers, IndexedDB, Web APIs  

## Communication Protocols

### Daily Standups
**Time**: 9:00 AM (virtual)  
**Duration**: 15 minutes max  
**Format**:
```
1. What I completed yesterday
2. What I'm working on today
3. Any blockers or dependencies
4. Help needed from other agents
```

### Blocker Resolution
**Immediate Escalation** for:
- Dependency not ready when needed
- API contract mismatches
- Performance degradation
- Security vulnerabilities
- Failed integration tests

**Resolution Process**:
1. Post in #dev-blockers channel
2. Tag dependent developer
3. If no response in 2 hours, escalate to Planning Agent
4. Planning Agent coordinates resolution

### Code Integration
**Merge Schedule**:
- Daily merges to main branch (5 PM)
- Feature branches max 2 days old
- Hotfix branches merged immediately

**Pull Request Process**:
1. Create PR with task ID in title
2. Include test results
3. Tag relevant developer for review
4. Merge after approval + CI pass

## Sprint 0 Coordination (Week 1)

### Day 1 Morning Kickoff
**All Developers** meet to:
- Review architecture decisions
- Confirm API contracts
- Set up development environments
- Establish communication channels

### Parallel Work Streams

#### Stream A: Frontend Setup (Agent 16)
```
Day 1: FE-001 (Next.js) → FE-002 (TypeScript)
Day 2: FE-003 (Tailwind) → FE-004 (Layouts)
Day 3: FE-005 (Routing) + Integration testing
```

#### Stream B: Backend Setup (Agent 17)
```
Day 1: BE-001 (Lambda) → BE-002 (API Gateway)
Day 2: BE-004 (Error handling) → BE-005 (Logging)
Day 3: BE-003 (Health check) + Integration testing
```

#### Stream C: Database Setup (Agent 18)
```
Day 1: DB-001 (Deploy RDS)
Day 2: DB-002 (Migrations) → DB-003 (Seed data)
Day 3: DB-004 (Backups) + Performance testing
```

#### Stream D: Integration Setup (Agent 19)
```
Day 1: INT-001 (Abstractions) → INT-005 (Config)
Day 2: INT-002 (Cognito) → INT-003 (Pusher)
Day 3: INT-004 (SES) + Integration testing
```

### Critical Handoffs
- **DB-001 → BE-003**: Database URL needed for health check
- **INT-002 → BE-101**: Cognito wrapper needed for auth
- **BE-002 → FE-001**: API Gateway URL for frontend config

## API Contract Adherence

### Contract Sources
All developers MUST follow contracts defined in:
- `/docs/agents/04-api-designer/current/api-contracts-mvp.md`
- `/docs/agents/04-api-designer/current/api-types.ts`

### Contract Violations
If you need to change an API contract:
1. Document the required change
2. Get approval from API Designer agent
3. Update all affected code
4. Notify all developers

### Mock Data Standards
When creating mocks, follow these patterns:
```typescript
// User mock
{
  id: "usr_mock_[sequence]",
  email: "user[n]@example.com",
  name: "Test User [n]"
}

// Team mock
{
  id: "tm_mock_[sequence]",
  name: "Test Team [n]",
  inviteCode: "TEST[n]"
}
```

## Dependency Management

### Critical Dependencies by Sprint

#### Sprint 1 Dependencies
```
BE-108 (JWT Middleware) blocks:
  → BE-101, BE-102, BE-103, BE-104, BE-105, BE-106, BE-107
  → FE-104 (Protected Routes)

INT-002 (Cognito Wrapper) blocks:
  → BE-101 (Register)
  → BE-102 (Login)
```

#### Sprint 2 Dependencies
```
BE-208 (Team Auth) blocks:
  → All team endpoints
  → FE-202 (Team Dashboard)

DB-201 (Invite Codes) blocks:
  → BE-201 (Create Team)
  → BE-207 (Join Team)
```

#### Sprint 3 Dependencies
```
BE-301 (Create Activity) blocks:
  → BE-305 (Aggregations)
  → FE-302 (Activity List)

DB-301 (Triggers) blocks:
  → Activity aggregations
  → Dashboard data
```

### Handling Blocked Work
If blocked by a dependency:
1. Work on non-dependent tasks
2. Create mocks for development
3. Write tests that will verify integration
4. Document assumptions made

## Testing Coordination

### Test Data Ownership
- **Database Developer**: Maintains seed data
- **Backend Developer**: API test fixtures
- **Frontend Developer**: UI test data
- **Integration Developer**: End-to-end scenarios

### Shared Test Scenarios
All developers must support these core flows:
1. **User Journey**: Register → Login → Create Team → Log Activity
2. **Team Journey**: Create → Invite → Join → View Progress
3. **Activity Journey**: Log → Edit → View in Dashboard → See Updates

### Integration Test Schedule
- **Daily**: 4:00 PM - Run integration tests
- **Sprint End**: Full regression test
- **Pre-Deploy**: Complete test suite

## Performance Coordination

### Performance Budgets
Each developer owns their performance budget:

#### Frontend (Agent 16)
- Initial page load: < 3 seconds
- Route transitions: < 300ms
- Lighthouse score: > 90

#### Backend (Agent 17)
- API response time: < 300ms (p95)
- Lambda cold start: < 1 second
- Concurrent requests: 100+

#### Database (Agent 18)
- Query execution: < 100ms
- Connection pool: 20 connections
- CPU usage: < 70%

### Performance Testing
- Run after each major feature
- Share results in daily standup
- Coordinate optimization efforts

## Security Coordination

### Security Responsibilities

#### All Developers
- Never commit secrets
- Validate all inputs
- Use parameterized queries
- Follow OWASP guidelines

#### Specific Ownership
- **Backend**: API authentication, rate limiting
- **Frontend**: XSS prevention, secure storage
- **Database**: SQL injection prevention, encryption
- **Integration**: Secret management, SSL/TLS

### Security Review Process
Before each sprint completion:
1. Run security scanner
2. Review authentication flows
3. Check for exposed secrets
4. Verify HTTPS everywhere

## Conflict Resolution

### Code Conflicts
1. Developer who arrives second resolves
2. Preserve both functionalities when possible
3. Escalate to Planning Agent if unclear

### Design Conflicts
1. Refer to original specifications
2. Consult relevant design agent
3. Document decision made

### Priority Conflicts
1. Critical path tasks take precedence
2. Security fixes before features
3. Performance fixes before enhancements

## Knowledge Sharing

### Documentation Requirements
Each developer maintains:
- README in their code directories
- Inline comments for complex logic
- API documentation for endpoints
- Setup guides for local development

### Code Review Guidelines
- Review within 4 hours of PR
- Focus on functionality and standards
- Suggest improvements constructively
- Approve when criteria met

### Knowledge Transfer Sessions
- **Sprint End**: 30-min demo of completed features
- **Week End**: Share learnings and gotchas
- **On Request**: Deep dive on complex implementations

## Sprint Transition Protocol

### Sprint Completion Checklist
Before declaring sprint complete:
- [ ] All assigned tasks code complete
- [ ] Unit tests written and passing
- [ ] Integration tests passing
- [ ] Code reviewed and merged
- [ ] Documentation updated
- [ ] Performance targets met
- [ ] Security scan clean

### Handoff Process
When handing off work:
1. Document current state
2. List any known issues
3. Provide setup instructions
4. Schedule sync meeting if complex

### Sprint Retrospective
Each developer provides:
- What went well
- What was challenging
- Suggestions for improvement
- Velocity assessment

## Emergency Protocols

### Production Issues
1. **P1 (Site Down)**: All hands respond
2. **P2 (Major Feature Broken)**: Assigned dev + backup
3. **P3 (Minor Issue)**: Assigned dev handles

### Rollback Procedures
- Frontend: Revert to previous deployment
- Backend: Blue/green swap
- Database: Point-in-time recovery

### Communication During Incidents
- Use #incident channel
- Provide updates every 30 minutes
- Document actions taken
- Post-mortem within 24 hours

## Tool Standards

### Development Tools
- **IDE**: VS Code (recommended)
- **Git**: Conventional commits
- **Node**: v20.x (use nvm)
- **Package Manager**: npm (not yarn)

### Communication Tools
- **Daily Sync**: Video call
- **Quick Questions**: Slack/Discord
- **Documentation**: Markdown in repo
- **Issue Tracking**: GitHub Issues

### Monitoring Tools
- **Logs**: CloudWatch
- **APM**: CloudWatch Insights
- **Errors**: Sentry (future)
- **Uptime**: CloudWatch Synthetics

## Success Metrics

### Individual Metrics
- Task completion rate
- Code quality (test coverage, reviews)
- Performance impact
- Bug introduction rate

### Team Metrics
- Sprint velocity
- Integration success rate
- Cross-team dependencies resolved
- Overall system quality

## Best Practices

### Code Quality
1. Write tests first (TDD encouraged)
2. Keep functions small and focused
3. Use meaningful variable names
4. Comment why, not what

### Collaboration
1. Over-communicate during integration
2. Ask questions early
3. Share solutions to common problems
4. Celebrate team wins

### Efficiency
1. Automate repetitive tasks
2. Use code generators where appropriate
3. Parallelize independent work
4. Batch similar tasks

---

## Quick Reference

### Task ID Format
`[AGENT]-[SPRINT][TASK]`
- FE-101 = Frontend, Sprint 1, Task 01
- BE-301 = Backend, Sprint 3, Task 01

### Priority Levels
- P1: Blocks critical path
- P2: Blocks sprint completion
- P3: Important but not blocking
- P4: Nice to have

### Communication Channels
- #dev-general: General discussion
- #dev-blockers: Urgent issues
- #dev-prs: Pull request notifications
- #dev-standup: Daily updates

This coordination guide ensures all developer agents work efficiently together, with clear communication channels and protocols for handling the complexities of parallel development.