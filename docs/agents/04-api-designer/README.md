# API Designer Agent

## Overview

The API Designer Agent is responsible for creating comprehensive API documentation and contracts for Mile Quest. This agent bridges the gap between the data model and frontend implementation by defining clear, consistent, and well-documented API endpoints.

## Status

**Current Status**: 🔄 PENDING  
**Progress**: 0%  
**Last Updated**: Not started

## Purpose

Design and document all API contracts for Mile Quest, ensuring:
- Consistency across all endpoints
- Clear request/response schemas
- Proper authentication and security patterns
- Efficient data transfer for mobile clients
- Future-proof design for GraphQL migration

## Key Responsibilities

1. **API Specification**
   - Create comprehensive OpenAPI 3.0 specification
   - Define all REST endpoints with proper HTTP methods
   - Document request/response schemas
   - Specify validation rules and constraints

2. **Authentication & Security**
   - Document authentication flows (JWT with Cognito)
   - Define security headers and CORS policies
   - Specify rate limiting rules
   - Document API key management

3. **Data Patterns**
   - Design efficient pagination (cursor-based)
   - Create field filtering syntax
   - Define sorting and search patterns
   - Plan for offline sync endpoints

4. **Developer Experience**
   - Generate TypeScript interfaces
   - Create Postman collections
   - Provide example requests/responses
   - Document error handling patterns

## Dependencies

- **Architecture Agent** ✅ - Technology stack and infrastructure defined
- **Data Model Agent** 🔄 - Need entity schemas for API endpoints
- **UI/UX Design Agent** ✅ - Understand data requirements from UI

## Outputs

1. **OpenAPI Specification** (`openapi-spec.yaml`)
2. **Endpoint Documentation** (`endpoints/*.md`)
3. **Schema Definitions** (`schemas/*.json`)
4. **TypeScript Interfaces** (`types/*.ts`)
5. **Postman Collection** (`postman-collection.json`)
6. **API Client Examples** (`examples/*.md`)
7. **Migration Guide** (`graphql-migration.md`)
8. **Performance Guidelines** (`performance.md`)

## Success Criteria

- [ ] All endpoints documented with OpenAPI 3.0
- [ ] TypeScript types generated and validated
- [ ] Postman collection covers all endpoints
- [ ] Error responses standardized
- [ ] Pagination patterns consistent
- [ ] Security best practices documented
- [ ] GraphQL migration path clear
- [ ] Performance guidelines established

## Next Steps

1. Wait for Data Model Agent to complete core entities
2. Review existing architecture decisions for API patterns
3. Create initial OpenAPI specification
4. Design authentication and common patterns
5. Document each endpoint group systematically