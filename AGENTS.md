# Mile Quest Multi-Agent Orchestration Plan

## Living Agent Status

All agents remain active and can receive new tasks through their backlog system. The Business Analyst Agent monitors and coordinates all agent activities.

| Agent | Status | Active Tasks | Current Focus | Last Activity |
|-------|--------|--------------|---------------|---------------|
| 1. Architecture | 📍 Active | 0 tasks | Monitoring project evolution | 2025-01-15 |
| 2. UI/UX Design | 📍 Active | 3 tasks | Awaiting implementation feedback | 2025-01-12 |
| 3. Data Model | ✅ Complete | 0 tasks | Schema v1.1 with indexes | 2025-01-15 |
| 4. API Designer | ✅ Complete | 0 tasks | API v2.0 delivered with pagination and offline patterns | 2025-01-15 |
| 5. Map Integration | 🔄 Ready | 0 tasks | API contracts available, ready to start | - |
| 6. Security & Privacy | 🔄 Ready | 0 tasks | API contracts available, ready to start | - |
| 7. Mobile Optimization | ⏸️ Waiting | 0 tasks | Awaiting UI implementation | - |
| 8. Integration | 🔄 Ready | 0 tasks | API contracts available, ready to start | - |
| 9. Analytics & Gamification | ⏸️ Waiting | 0 tasks | Awaiting core features | - |
| 10. Testing & QA | ⏸️ Waiting | 0 tasks | Awaiting implementation | - |
| 11. DevOps | 🔄 Ready | 0 tasks | Ready for setup tasks | - |
| 12. Review & Enhancement | 📍 Active | 0 tasks | Monitoring for new deliverables | 2025-01-15 |
| 13. Compliance | 📍 Active | 3 tasks | Monthly audit scheduled | 2025-01-15 |
| 14. Business Analyst | 📍 Active | 4 tasks | Monitoring all backlogs | 2025-01-15 |

## Project Overview

Mile Quest is a mobile-first team walking challenge platform where teams set geographic goals and track collective walking distances. Users can create teams, define waypoints on a map, and work together to "walk" the distance between those points.

## Agent Roles and Responsibilities

### 1. Architecture Agent 📍 ACTIVE

**Status**: Monitoring and Available for Updates
**Last Delivery**: MVP Architecture v2.0 (2025-01-12)
**Active Backlog**: 3 items

**Purpose**: Design the overall system architecture and make key technical decisions.

**Completed Tasks**:
- [x] Define system architecture - AWS serverless-first approach
- [x] Select technology stack - Next.js, Lambda, Aurora Serverless
- [x] Design API architecture - Lambda functions with API Gateway
- [x] Plan deployment approach - Modular monolith with Lambda
- [x] Define data flow - Event-driven with SQS/EventBridge
- [x] Create scalability strategy - Auto-scaling serverless
- [x] Document cost estimates - $35-$900/month based on scale
- [x] Design domain setup - mile-quest.com with Route 53

**Key Decisions Made**:
- ✅ Database: Aurora Serverless v2 PostgreSQL with PostGIS
- ✅ Caching: ElastiCache Serverless Redis + DynamoDB
- ✅ Message queue: SQS for async operations
- ✅ API design: REST with potential GraphQL later
- ✅ Authentication: AWS Cognito with JWT
- ✅ Real-time: WebSocket API with Socket.io

**Outputs Delivered**:
- ✅ AWS architecture document (`aws-architecture.md`)
- ✅ Serverless design patterns (`serverless-design.md`)
- ✅ Infrastructure diagrams (`infrastructure-diagram.md`)
- ✅ Domain setup guide (`domain-setup.md`)
- ✅ Technology stack decisions (`tech-stack.md`)
- ✅ Architecture summary (`architecture-summary.md`)

**Dependencies**: None (runs first)

---

### 2. UI/UX Design Agent 📍 ACTIVE

**Status**: Awaiting Implementation Feedback
**Last Delivery**: MVP UI/UX Design v2.0 (2025-01-12)
**Active Backlog**: 3 items

**Purpose**: Create an intuitive, mobile-first user experience.

**Completed Tasks**:
- [x] Design user journey maps - 5 comprehensive user flows
- [x] Create wireframes and mockups - 30+ mobile-first screens
- [x] Design mobile-first responsive layouts - 375x667px baseline
- [x] Ensure accessibility (WCAG 2.1 AA compliance) - Full guidelines documented
- [x] Design data visualization components - Progress bars, charts, leaderboards
- [x] Create design system and component library specs - Complete design system
- [x] Design gamification elements - Badges, achievements, streaks, levels

**Key Design Decisions**:
- ✅ Mobile-first approach with 375x667px viewport
- ✅ 4px spacing grid system
- ✅ Primary color: #2563EB with WCAG compliant palette
- ✅ Touch targets: 44x44px minimum
- ✅ Onboarding target: < 2 minutes
- ✅ Activity logging target: < 30 seconds

**Outputs Delivered**:
- ✅ User journey maps (`user-journeys.md`)
- ✅ Mobile wireframes with ASCII art (`wireframes.md`)
- ✅ Design system documentation (`design-system.md`)
- ✅ Data visualization patterns (`data-visualization.md`)
- ✅ Gamification system design (`gamification.md`)
- ✅ Accessibility guidelines (`accessibility.md`)
- ✅ Notification patterns (`notifications.md`)
- ✅ Work summary (`summary.md`)

**Dependencies**: Architecture Agent ✅ (for technical constraints)

---

### 3. Data Model Agent ✅ COMPLETE

**Status**: Complete (2025-01-15)
**Last Delivery**: Complete Schema v1.0 (2025-01-13)
**Active Backlog**: 0 items (all completed)

**Purpose**: Design efficient database schemas and data relationships.

**Completed Tasks**:
- [x] Design normalized database schema
- [x] Define entity relationships
- [x] Plan data aggregation strategies
- [x] Optimize for common queries
- [x] Design audit and history tracking
- [x] Plan data migration strategies
- [x] Define data validation rules
- [x] Implement privacy controls for activities

**Key Entities**:
- Users (profile, preferences, auth)
- Teams (metadata, settings, goals)
- Team Members (roles, permissions, status)
- Waypoints (geographic points, addresses)
- Routes (calculated paths between waypoints)
- Activities (walks, steps, distances)
- Achievements (badges, milestones)
- Notifications (system, team, personal)

**Key Design Decisions**:
- ✅ Primary keys: UUID for all tables
- ✅ Soft deletes: User and Team entities only
- ✅ JSON fields: Route data and achievement criteria
- ✅ Aggregation: Separate UserStats and TeamProgress tables
- ✅ Privacy: isPrivate flag on activities
- ✅ Real-time aggregation during activity creation

**Outputs Delivered**:
- ✅ Core entities documentation (`core-entities.md`)
- ✅ Complete Prisma schema (`prisma-schema.md`)
- ✅ Data access patterns (`data-access-patterns.md`)
- ✅ Entity relationship diagram (`entity-relationship-diagram.md`)
- ✅ Data model summary (`data-model-summary.md`)

**Dependencies**: Architecture Agent ✅, UI/UX Design Agent ✅

---

### 4. API Designer Agent ✅ COMPLETE

**Status**: Complete (v2.0)
**Last Delivery**: Comprehensive API Design v2.0 (2025-01-15)
**Active Backlog**: 0 items (all completed)

**Purpose**: Design and document all API contracts, ensuring consistency and developer experience.

**Completed Tasks**:
- [x] Design RESTful endpoints following best practices
- [x] Define request/response schemas with validation rules
- [x] Document authentication flows and security headers
- [x] Plan API versioning strategy (URL-based: /api/v1/)
- [x] Design standardized error response format
- [x] Create pagination patterns (cursor-based)
- [x] Design optimized dashboard endpoint
- [x] Create TypeScript type definitions
- [x] Design offline-friendly API patterns
- [x] Process all backlog items

**Key Deliverables**:
- ✅ `api-contracts-mvp.md` - Complete REST endpoint definitions
- ✅ `api-design-decisions.md` - Design rationale documented
- ✅ `api-versioning-implementation.md` - Versioning strategy
- ✅ `pagination-patterns.md` - Cursor-based pagination implementation
- ✅ `offline-api-patterns.md` - Offline-first mobile patterns
- ✅ `api-types.ts` - Complete TypeScript definitions

**API Endpoints Designed**:
- ✅ Authentication (register, login, refresh, logout, verify)
- ✅ Users (profile, stats)
- ✅ Teams (CRUD, members, join)
- ✅ Activities (create, update, delete, privacy)
- ✅ Dashboard (optimized single endpoint)
- ✅ Pagination patterns for all list endpoints
- ✅ Offline queueing for critical operations

**Outputs**:
- OpenAPI 3.0 specification (YAML/JSON)
- Postman collection for testing
- TypeScript interfaces for frontend
- API client SDK templates
- API documentation site
- Migration guide to GraphQL
- Performance guidelines
- Security best practices

**Dependencies**: Architecture Agent ✅, Data Model Agent ✅

---

### 5. Map Integration Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Implement all mapping and geospatial functionality.

**Tasks**:
- [ ] Integrate mapping API (Mapbox/Google Maps)
- [ ] Implement geocoding for address search
- [ ] Calculate distances between waypoints
- [ ] Design route visualization
- [ ] Handle offline map caching
- [ ] Implement waypoint selection UI
- [ ] Optimize map performance for mobile

**Key Features**:
- Address autocomplete
- Point-and-click waypoint selection
- Route distance calculation
- Elevation data integration
- Multiple route options
- Offline map regions
- Custom map styling

**Outputs**:
- Map integration architecture
- API integration code
- Distance calculation algorithms
- Map component library
- Performance benchmarks

**Dependencies**: Architecture Agent ✅, UI/UX Design Agent ✅

---

### 6. Security & Privacy Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Ensure application security and user privacy.

**Tasks**:
- [ ] Design authentication system
- [ ] Implement authorization and permissions
- [ ] Ensure data encryption (in transit and at rest)
- [ ] Design API security (rate limiting, CORS)
- [ ] Implement privacy controls (GDPR compliance)
- [ ] Security audit procedures
- [ ] Vulnerability management plan

**Key Security Areas**:
- User authentication (OAuth, MFA)
- Team-based permissions
- API key management
- Data anonymization
- Session management
- Input validation
- SQL injection prevention
- XSS protection

**Outputs**:
- Security architecture document
- Authentication flow diagrams
- Permission matrix
- Privacy policy recommendations
- Security checklist

**Dependencies**: Architecture Agent ✅, Data Model Agent 🔄

---

### 7. Mobile Optimization Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Ensure optimal mobile experience and performance.

**Tasks**:
- [ ] Implement Progressive Web App (PWA) features
- [ ] Optimize for various screen sizes
- [ ] Enable offline functionality
- [ ] Implement device API integrations
- [ ] Optimize performance and load times
- [ ] Design touch-friendly interfaces
- [ ] Handle network connectivity issues

**Key Features**:
- Service worker implementation
- Offline data sync
- Push notifications
- App install prompts
- Device sensor integration (step counter)
- Image optimization
- Lazy loading strategies

**Outputs**:
- PWA implementation plan
- Performance optimization guide
- Offline strategy document
- Mobile testing checklist
- Device compatibility matrix

**Dependencies**: Architecture Agent ✅, UI/UX Design Agent ✅

---

### 8. Integration Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Connect external services and APIs.

**Tasks**:
- [ ] Integrate fitness tracking APIs
- [ ] Design webhook system
- [ ] Implement OAuth for third parties
- [ ] Handle data synchronization
- [ ] Design retry and fallback mechanisms
- [ ] API versioning strategy
- [ ] Rate limit handling

**Key Integrations**:
- Fitbit API
- Apple HealthKit
- Google Fit
- Strava
- Garmin Connect
- Samsung Health
- Webhook endpoints for team tools

**Outputs**:
- Integration architecture
- API client libraries
- Webhook specifications
- Sync strategy document
- Error handling procedures

**Dependencies**: Architecture Agent ✅, Security & Privacy Agent 🔄

---

### 9. Analytics & Gamification Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Design engagement features and analytics.

**Tasks**:
- [ ] Design achievement system
- [ ] Create leaderboard algorithms
- [ ] Implement progress notifications
- [ ] Design analytics dashboard
- [ ] Plan engagement features
- [ ] Create reward mechanisms
- [ ] Design social features

**Key Features**:
- Achievement badges
- Milestone celebrations
- Team leaderboards
- Personal records
- Streak tracking
- Challenge creation
- Progress insights
- Social sharing

**Outputs**:
- Gamification system design
- Achievement specifications
- Analytics data model
- Engagement metrics plan
- Notification strategy

**Dependencies**: UI/UX Design Agent ✅, Data Model Agent 🔄

---

### 10. Testing & QA Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Ensure application quality and reliability.

**Tasks**:
- [ ] Create test strategies
- [ ] Design test automation framework
- [ ] Plan performance testing
- [ ] Create test data generators
- [ ] Design user acceptance tests
- [ ] Accessibility testing
- [ ] Security testing procedures

**Test Coverage Areas**:
- Unit tests (components, utilities)
- Integration tests (API, database)
- E2E tests (user journeys)
- Performance tests (load, stress)
- Mobile device testing
- Cross-browser testing
- Accessibility testing

**Outputs**:
- Test strategy document
- Test automation framework
- Test case specifications
- Performance benchmarks
- QA checklist

**Dependencies**: All other agents

---

### 11. DevOps Agent 🔄 PENDING

**Status**: Not Started

**Purpose**: Handle deployment and operations.

**Tasks**:
- [ ] Set up CI/CD pipelines
- [ ] Configure infrastructure
- [ ] Design monitoring system
- [ ] Plan disaster recovery
- [ ] Optimize deployment process
- [ ] Container orchestration
- [ ] Cost optimization

**Key Areas**:
- GitHub Actions workflows
- Docker containerization
- Kubernetes deployment
- Database backups
- Log aggregation
- Performance monitoring
- Alert configuration

**Outputs**:
- CI/CD pipeline configuration
- Infrastructure as Code
- Deployment procedures
- Monitoring dashboards
- Runbook documentation

**Dependencies**: Architecture Agent ✅

---

### 12. Review & Enhancement Agent 📍 ACTIVE

**Status**: Active - Monitoring for New Deliverables (v1.1)
**Last Delivery**: Compliance Structure Implementation (2025-01-15)
**Active Backlog**: 0 items (4 completed today)

**Purpose**: Conduct cross-agent reviews to identify improvements, optimizations, and integration opportunities.

**Completed Milestones**:
- [x] Initial cross-agent review (v1.0) - MVP simplification adopted
- [x] Compliance structure implementation (v1.1) - 100% compliant

**Key Achievements**:
- ✅ Simplified architecture from microservices to monolith (adopted)
- ✅ Reduced MVP complexity by 75%
- ✅ Identified $700/month cost savings
- ✅ Created phased implementation strategy
- ✅ Established integration patterns
- ✅ Achieved 100% documentation compliance

**Recent Activity**:
- Completed compliance audit remediation
- Created STATE.json and CHANGELOG.md
- Reorganized documentation structure
- Cleared 4-item backlog from Compliance Agent

**Outputs Delivered**:
- ✅ Review methodology (`current/README.md`)
- ✅ Architecture review (`current/architecture-review.md`)
- ✅ UI/UX review (`current/ui-ux-review.md`)
- ✅ Integration concerns (`current/integration-concerns.md`)
- ✅ Recommendations summary (`current/recommendations-summary.md`)
- ✅ STATE.json with version tracking
- ✅ CHANGELOG.md with complete history
- ✅ Standard folder structure (current/, versions/, working/)

**Next Reviews Pending**:
- API Designer deliverables (when available)
- Security implementation patterns
- Mobile optimization strategies
- DevOps pipeline configurations

**Dependencies**: Requires deliverables from other agents to review

---

### 13. Compliance Agent ✅ COMPLETE

**Status**: Audit Complete (2025-01-15)

**Purpose**: Ensure all project-level rules and guidelines from CLAUDE.md are followed across all agents.

**Completed Tasks**:
- [x] Scan CLAUDE.md for all project rules and patterns
- [x] Audit each agent's work for compliance
- [x] Check external service abstraction compliance
- [x] Verify privacy flag implementation
- [x] Validate documentation structure adherence
- [x] Check STATE.json and CHANGELOG.md maintenance
- [x] Verify AGENTS.md and MANIFEST.md updates
- [x] Generate compliance report with scores
- [x] Create specific recommendations for each agent

**Key Findings**:
- Overall compliance: 67.6% (D+)
- Best compliance: Architecture & UI/UX (87.5%)
- Worst compliance: Review & Enhancement (25%)
- Universal failure: No agent updated CLAUDE.md
- Strong technical compliance, poor administrative compliance

**Key Audit Areas**:
- ✅ External service abstraction (excellent in Architecture)
- ✅ Privacy-aware query patterns (excellent in Data Model)
- ⚠️ Documentation structure (Review Agent non-compliant)
- ✅ STATE.json versioning (most agents compliant)
- ✅ CHANGELOG.md entries (most agents have them)
- ❌ AGENTS.md status (Data Model failed to update)
- ✅ MANIFEST.md indexing (most documents indexed)
- ✅ Absolute file paths usage (all compliant)
- ✅ File organization (all in correct folders)

**Outputs Delivered**:
- ✅ Compliance audit report (`compliance-audit-report.md`)
- ✅ Agent-specific recommendations (`compliance-recommendations.md`)
- ✅ Compliance score metrics (`compliance-scores.md`)
- ✅ Priority fix list with immediate actions
- ✅ Specific violation examples for each agent
- ✅ Process improvement suggestions

**Critical Actions Required**:
1. Review & Enhancement Agent must fix structure immediately
2. All agents must update CLAUDE.md
3. Data Model Agent must update AGENTS.md

**Run Frequency**: Monthly or after 3+ agent completions

**Dependencies**: CLAUDE.md ✅ (for rules), All completed agents ✅ (audited)

---

### 14. Business Analyst Agent 🚧 IN PROGRESS

**Status**: Documentation Phase (2025-01-15)

**Purpose**: Analyze all agent plans and create comprehensive implementation guides, track feature completion, and manage project dependencies.

**Tasks**:
- [x] Create implementation roadmap
- [x] Break down features across frontend/backend
- [x] Create feature dependency graph
- [ ] Track feature completion status
- [ ] Review agent recommendations
- [ ] Ensure plan adherence
- [ ] Coordinate cross-agent dependencies

**Key Responsibilities**:
- Implementation planning and phasing
- Feature dependency management
- Progress tracking and reporting
- Cross-agent coordination
- New functionality assessment

**Outputs**:
- Implementation guide with 7 phases
- Feature dependency graph with critical paths
- Feature tracking dashboard
- Recommendations consolidation
- Progress reports

**Dependencies**: All technical agents (for plan analysis)

---

## Agent Coordination Strategy

### Phase 1: Foundation (Weeks 1-3)
1. **Architecture Agent** defines system architecture ✅
2. **UI/UX Design Agent** creates initial designs ✅
3. **Data Model Agent** designs core schemas
4. **API Designer Agent** creates API contracts
5. **DevOps Agent** sets up development environment

### Phase 2: Core Development (Weeks 4-8)
1. **Map Integration Agent** implements mapping features
2. **Security Agent** implements authentication
3. **Mobile Optimization Agent** sets up PWA foundation
4. **Integration Agent** begins API connections

### Phase 3: Enhancement (Weeks 9-11)
1. **Analytics & Gamification Agent** adds engagement features
2. **Testing & QA Agent** performs comprehensive testing
3. All agents collaborate on bug fixes and improvements

### Phase 4: Launch (Week 12)
1. **DevOps Agent** manages deployment
2. **Testing & QA Agent** performs final checks
3. All agents provide documentation

## Communication Protocol

### Documentation Structure

Each agent maintains their work in a dedicated folder under `/docs/agents/`:

```
mile-quest/
├── docs/
│   └── agents/
│       ├── 01-architecture/
│       │   ├── README.md              # Architecture overview
│       │   ├── tech-stack.md          # Technology decisions
│       │   ├── api-design.md          # API architecture
│       │   ├── deployment.md          # Deployment strategy
│       │   └── diagrams/              # Architecture diagrams
│       ├── 02-ui-ux/
│       │   ├── README.md              # Design overview
│       │   ├── user-journeys.md       # User journey maps
│       │   ├── wireframes.md          # Wireframe documentation
│       │   ├── design-system.md       # Component specifications
│       │   └── mockups/               # Design files
│       ├── 03-data-model/
│       │   ├── README.md              # Data model overview
│       │   ├── schema.md              # Database schema
│       │   ├── migrations/            # Migration scripts
│       │   └── erd.md                 # Entity relationship diagrams
│       ├── 04-api-designer/
│       │   ├── README.md              # API design overview
│       │   ├── openapi-spec.yaml     # OpenAPI 3.0 specification
│       │   ├── endpoints/             # Endpoint documentation
│       │   ├── schemas/               # Request/response schemas
│       │   └── examples/              # Example requests
│       ├── 05-map-integration/
│       │   ├── README.md              # Mapping overview
│       │   ├── api-integration.md     # Map API details
│       │   ├── calculations.md        # Distance algorithms
│       │   └── performance.md         # Optimization notes
│       ├── 06-security/
│       │   ├── README.md              # Security overview
│       │   ├── authentication.md      # Auth implementation
│       │   ├── permissions.md         # Permission matrix
│       │   └── compliance.md          # Privacy compliance
│       ├── 07-mobile-optimization/
│       │   ├── README.md              # Mobile strategy
│       │   ├── pwa-implementation.md  # PWA details
│       │   ├── offline-strategy.md    # Offline functionality
│       │   └── performance.md         # Mobile performance
│       ├── 08-integration/
│       │   ├── README.md              # Integration overview
│       │   ├── fitness-apis.md        # Fitness tracker APIs
│       │   ├── webhooks.md            # Webhook design
│       │   └── sync-strategy.md       # Data synchronization
│       ├── 09-analytics-gamification/
│       │   ├── README.md              # Analytics overview
│       │   ├── achievements.md        # Achievement system
│       │   ├── leaderboards.md        # Leaderboard design
│       │   └── metrics.md             # Analytics metrics
│       ├── 10-testing-qa/
│       │   ├── README.md              # Testing strategy
│       │   ├── test-plans.md          # Test specifications
│       │   ├── automation.md          # Automation framework
│       │   └── reports/               # Test reports
│       ├── 11-devops/
│       │   ├── README.md              # DevOps overview
│       │   ├── ci-cd.md               # Pipeline configuration
│       │   ├── infrastructure.md      # Infrastructure setup
│       │   └── monitoring.md          # Monitoring strategy
│       ├── 12-review-enhancement/
│       │   ├── README.md              # Review methodology
│       │   ├── architecture-review.md # Architecture evaluation
│       │   ├── ui-ux-review.md        # UI/UX evaluation
│       │   └── integration-concerns.md # Cross-agent issues
│       ├── 13-compliance/
│       │   ├── README.md              # Compliance overview
│       │   ├── compliance-report.md   # Full audit results
│       │   ├── recommendations.md     # Agent-specific fixes
│       │   └── compliance-score.md    # Project metrics
│       └── 14-business-analyst/
│           ├── README.md              # Business analyst overview
│           ├── implementation-guide.md # Phased implementation plan
│           ├── feature-dependencies.md # Dependency graph
│           ├── feature-tracking.md    # Completion tracking
│           └── recommendations.md     # Consolidated suggestions
```

### Documentation Standards

Each agent must:
- Create a README.md in their folder with an overview of their work
- Document all major decisions with rationale
- Include code examples where applicable
- Reference dependencies on other agents' work
- Update documentation as work progresses
- Use consistent markdown formatting

### 📁 New Documentation Structure (2025-01-12)

**Important**: We now use a versioned documentation system. Each agent's folder follows this structure:

```
docs/agents/[agent-number]-[agent-name]/
├── current/          # 📌 ALWAYS USE THIS FOR CURRENT STATE
│   ├── README.md     # Agent overview and status
│   └── [active docs] # Current documentation
├── versions/         # 📚 Historical versions
│   ├── v1.0/        # Original version
│   └── v2.0/        # Updated version
├── working/          # 🚧 Draft changes
├── STATE.json        # Version and status tracking
├── CHANGELOG.md      # Change history
└── QUICK-REFERENCE.md # One-page summary
```

**Key Files for Context**:
- `/CLAUDE.md` - Primary context file for Claude Code (start here!)
- `/docs/MANIFEST.md` - Index of all documentation
- `/docs/GUIDELINES.md` - How to update documentation

**When Working on Mile Quest**:
1. Always check `CLAUDE.md` first for current project state
2. Look in agent's `current/` folder for active documentation
3. Check `STATE.json` for version information
4. Follow `GUIDELINES.md` for making updates

### Cross-Agent Communication

- Each agent reads relevant documentation from dependency agents before starting
- Updates are committed with clear messages indicating which agent made changes
- Questions for other agents are documented in a `questions.md` file
- Decisions that affect multiple agents are documented in `/docs/decisions/`
- Weekly sync points for cross-agent coordination
- Shared terminology defined in `/docs/glossary.md`

## Success Metrics

- Code coverage > 80%
- Lighthouse mobile score > 90
- API response time < 200ms
- 99.9% uptime target
- User onboarding < 2 minutes
- Map load time < 3 seconds

## Task Tracking Legend

- ✅ **Complete** - Agent has finished all tasks
- 🚧 **In Progress** - Agent is actively working
- 🔄 **Pending** - Agent has not started
- ⚠️ **Blocked** - Agent is waiting on dependencies

## Updating Agent Status

When running an agent session:
1. Update the agent's status in this file
2. Check off completed tasks with [x]
3. Update the progress percentage in the status table
4. Add the completion date when all tasks are done
5. Ensure all outputs are documented in the agent's folder