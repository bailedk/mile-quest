# Architecture Agent Documentation

## Overview
This folder contains all architectural decisions, designs, and technical specifications for the Mile Quest platform.

## Status
- **Current Phase**: Architecture Research Complete + Review Evaluation
- **Last Updated**: 2025-01-12
- **Agent**: Architecture Agent
- **Version**: 2.0 (Post-Review)

## Completed Work
- [x] AWS services selection for cost-effective architecture
- [x] Serverless-first architecture design
- [x] Domain setup plan for mile-quest.com
- [x] Detailed infrastructure diagrams
- [x] Technology stack finalization
- [x] API architecture with Lambda functions
- [x] Cost estimates ($35/month MVP → $900/month at scale)
- [x] Monorepo structure with AWS CDK
- [x] **Review evaluation and architecture simplification**
- [x] **MVP architecture revision (72% cost reduction)**
- [x] **Clear migration paths defined**

## Key Architecture Decisions (v2 - Simplified MVP)
1. **Serverless-First**: Lambda + API Gateway for zero idle costs ✓
2. **Database**: RDS PostgreSQL Multi-AZ (Aurora deferred) 🔄
3. **Real-time**: Pusher managed service (AWS IoT Core deferred) 🔄
4. **Caching**: CloudFront only (ElastiCache deferred) 🔄
5. **API Design**: REST with filtering (GraphQL deferred) 🔄

## Original Architecture Decisions (For Scale)
1. **Aurora Serverless v2**: Auto-scaling PostgreSQL with PostGIS
2. **Multi-Service Approach**: SQS, EventBridge, DynamoDB for specific use cases
3. **Advanced Caching**: CloudFront + ElastiCache
4. **Native WebSockets**: WebSocket API with DynamoDB

## Key Decisions
1. **Monorepo Structure**: Chosen for code sharing, atomic changes, and simplified development
2. **Tech Stack**: Next.js 14 (frontend), Fastify (backend), PostgreSQL with PostGIS (database)
3. **Real-time**: Socket.io for WebSocket communications
4. **Cache**: Redis with BullMQ for job queuing

## Dependencies
- None (Architecture Agent runs first)

## Output for Other Agents
- **MVP**: Reference `mvp-architecture.md` and `infrastructure-diagram-mvp.md`
- **Scale**: Original files remain for future scaling needs
- **Decisions**: See `architecture-decisions-v2.md` for evaluation rationale
- **UI/UX Agent**: Mobile constraints still apply from `api-design.md`
- **DevOps Agent**: Implement based on simplified MVP architecture

## Questions for Team
- Should we consider GraphQL instead of REST for better mobile data fetching?
- Do we need a separate service for heavy geospatial calculations?
- What's the expected scale (users, teams, requests/second)?