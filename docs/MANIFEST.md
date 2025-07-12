# Mile Quest Documentation Manifest

## Overview

This manifest provides a comprehensive index of all project documentation, indicating current versions, locations, and update responsibilities.

## Documentation Status Key

- 📌 **Current** - Active documentation (use this!)
- 📚 **Historical** - Superseded but preserved for reference
- 🚧 **Working** - In progress, not yet active
- ⏳ **Planned** - Not yet created

## Agent Documentation Index

### 1. Architecture Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| MVP Architecture | 📌 Current | 2.0 | `01-architecture/current/mvp-architecture.md` | Simplified $70/mo architecture |
| Infrastructure Diagram MVP | 📌 Current | 2.0 | `01-architecture/current/infrastructure-diagram-mvp.md` | Current infrastructure visualization |
| Architecture Decisions | 📌 Current | 2.0 | `01-architecture/current/architecture-decisions-v2.md` | Rationale for simplifications |
| Original Architecture | 📚 Historical | 1.0 | `01-architecture/versions/v1.0/aws-architecture.md` | Initial Aurora/ElastiCache design |
| Original Infrastructure | 📚 Historical | 1.0 | `01-architecture/versions/v1.0/infrastructure-diagram.md` | Complex infrastructure diagram |

### 2. UI/UX Design Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| MVP Wireframes | 📌 Current | 2.0 | `02-ui-ux/current/mvp-wireframes.md` | Simplified screens for MVP |
| Design System | 📌 Current | 2.0 | `02-ui-ux/current/design-system.md` | Component library and tokens |
| UI-Architecture Alignment | 📌 Current | 2.0 | `02-ui-ux/current/ui-architecture-alignment.md` | Technical integration guide |
| Original Wireframes | 📚 Historical | 1.0 | `02-ui-ux/versions/v1.0/wireframes.md` | Full-feature wireframes |
| User Journeys | 📌 Current | 1.0 | `02-ui-ux/current/user-journeys.md` | User flow documentation |

### 3. Data Model Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Database Schema | ⏳ Planned | - | `03-data-model/current/schema.md` | PostgreSQL schema design |
| ERD | ⏳ Planned | - | `03-data-model/current/erd.md` | Entity relationship diagram |
| Migration Strategy | ⏳ Planned | - | `03-data-model/current/migrations.md` | Database migration approach |

### 4. Map Integration Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Map Integration | ⏳ Planned | - | `04-map-integration/current/design.md` | Mapping service integration |

### 5. Security & Privacy Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Security Architecture | ⏳ Planned | - | `05-security/current/architecture.md` | Security design |
| Authentication Flow | ⏳ Planned | - | `05-security/current/authentication.md` | Cognito implementation |

### 6. Mobile Optimization Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| PWA Strategy | ⏳ Planned | - | `06-mobile-optimization/current/pwa.md` | Progressive web app design |

### 7. Integration Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Fitness APIs | ⏳ Planned | - | `07-integration/current/fitness-apis.md` | External API integrations |

### 8. Analytics & Gamification Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Achievement System | ⏳ Planned | - | `08-analytics-gamification/current/achievements.md` | Gamification design |

### 9. Testing & QA Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Test Strategy | ⏳ Planned | - | `09-testing-qa/current/strategy.md` | Testing approach |

### 10. DevOps Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| CI/CD Pipeline | ⏳ Planned | - | `10-devops/current/pipeline.md` | Deployment automation |

### 11. Review & Enhancement Agent
| Document | Status | Version | Location | Purpose |
|----------|--------|---------|----------|---------|
| Recommendations | 📌 Current | 1.0 | `11-review-enhancement/recommendations-summary.md` | Simplification recommendations |
| Architecture Review | 📌 Current | 1.0 | `11-review-enhancement/architecture-review.md` | Architecture evaluation |
| UI/UX Review | 📌 Current | 1.0 | `11-review-enhancement/ui-ux-review.md` | Design evaluation |

## Cross-Cutting Documentation

| Document | Location | Purpose | Owner |
|----------|----------|---------|-------|
| Agent Orchestration | `/AGENTS.md` | Agent roles and status | Project Manager |
| Claude Context | `/CLAUDE.md` | AI assistant context | All Agents |
| Documentation Guidelines | `/docs/GUIDELINES.md` | How to update docs | All Agents |
| Glossary | `/docs/glossary.md` | Shared terminology | All Agents |
| Decision Log | `/docs/decisions/` | Major project decisions | All Agents |

## Document Dependencies

### Architecture Dependencies
- UI/UX Design → Architecture (for technical constraints)
- Data Model → Architecture (for database choices)
- All Agents → Architecture (for infrastructure)

### UI/UX Dependencies
- Mobile Optimization → UI/UX (for design patterns)
- Analytics & Gamification → UI/UX (for visual design)

### Data Dependencies
- Analytics → Data Model (for schema design)
- Security → Data Model (for user/auth tables)

## Update Protocols

### When to Update This Manifest
1. When creating new documentation
2. When moving docs from working/ to current/
3. When deprecating documentation to versions/
4. When changing document purposes

### Quick Update Template
```markdown
| [Document Name] | [📌 Current/📚 Historical/🚧 Working/⏳ Planned] | [Version] | `[path]` | [Purpose] |
```

## Version Control

### Current Versions by Agent
- Architecture: 2.0 (MVP Simplified)
- UI/UX Design: 2.0 (MVP Aligned)
- Review & Enhancement: 1.0
- All Others: Not started

### Version History Location
Each agent's version history is in:
`docs/agents/[agent-number]/CHANGELOG.md`

---

**Last Updated**: 2025-01-12
**Next Review**: When Data Model Agent begins