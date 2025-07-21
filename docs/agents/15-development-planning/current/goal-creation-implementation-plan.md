# Goal Creation Feature - Implementation Plan

**Version**: 1.0  
**Date**: 2025-01-20  
**Feature**: Team Goal Creation with Interactive Map  
**Estimated Time**: 2-3 weeks  

## Executive Summary

This plan outlines the implementation of the team goal creation feature, allowing admins to create goals by selecting multiple cities on an interactive map. The feature requires coordination between Frontend, Backend, and Integration developer agents.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│        Goal Creation UI (React)         │
│    /teams/{teamId}/goals/new           │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│         Map Service (Frontend)         │
│     Mapbox abstraction layer          │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│      Goal API (Backend Lambda)         │
│    POST /api/teams/{id}/goals         │
└────────────────┬───────────────────────┘
                 │
┌────────────────▼───────────────────────┐
│       Map Service (Backend)            │
│    Route calculation & validation      │
└────────────────────────────────────────┘
```

## Phase 1: Foundation (Days 1-3)

### Frontend Tasks (Agent 16)

**FE-1.1: Set up Map Service Abstraction**
- Create `/services/maps/` directory structure
- Implement MapService interface from Map Integration guide
- Set up Mapbox provider implementation
- Create mock provider for testing
- Configure environment variables for API keys

**FE-1.2: Create Base Map Component**
- Implement MapContainer component with Mapbox GL JS
- Add basic controls (zoom, pan, reset)
- Implement responsive sizing
- Add loading and error states
- Set up map style configuration

**FE-1.3: Create Route State Management**
- Create `useGoalCreation` hook for form state
- Implement waypoint management (add, remove, reorder)
- Add route calculation debouncing
- Set up local storage for draft persistence
- Create validation logic

### Backend Tasks (Agent 17)

**BE-1.1: Enhance Goal Service**
- Review existing goal.service.ts
- Add support for multiple waypoints in CreateGoalInput
- Implement waypoint validation logic
- Add draft goal support (optional)
- Update error handling for detailed feedback

**BE-1.2: Update Database Schema**
- Verify TeamGoal model supports waypoints array
- Add indexes for waypoint queries
- Create migration if schema changes needed
- Update seed data with multi-waypoint examples

### Integration Tasks (Agent 19)

**INT-1.1: Configure Mapbox Account**
- Set up Mapbox account (if not exists)
- Create project-specific access tokens
- Configure token restrictions and domains
- Set up billing alerts
- Document token management process

**INT-1.2: Environment Setup**
- Add Mapbox tokens to environment configs
- Update deployment scripts for all environments
- Configure CORS for map tile requests
- Set up CloudFront caching for map assets

## Phase 2: Core Features (Days 4-8)

### Frontend Tasks (Agent 16)

**FE-2.1: Implement Waypoint Selection**
- Create SearchBox component with geocoding
- Implement click-to-add waypoints on map
- Add waypoint markers with numbering
- Create waypoint connection lines
- Add touch gesture support

**FE-2.2: Create Waypoint List Component**
- Build draggable waypoint list
- Implement reorder functionality
- Add delete waypoint feature
- Show cumulative distances
- Add empty state messaging

**FE-2.3: Build Goal Form UI**
- Create goal information form
- Add form validation
- Implement date picker
- Add character counters
- Create loading states

**FE-2.4: Implement Route Visualization**
- Draw route polyline on map
- Add animated route calculation
- Implement bounds fitting
- Add route optimization option
- Show total distance prominently

### Backend Tasks (Agent 17)

**BE-2.1: Implement Route Calculation**
- Create backend MapService implementation
- Add route distance calculation
- Implement waypoint optimization
- Add caching for repeated calculations
- Handle edge cases (ocean routes, etc.)

**BE-2.2: Enhance API Endpoints**
- Update POST /teams/{id}/goals endpoint
- Add validation for waypoint data
- Implement rate limiting for map API calls
- Add detailed error responses
- Create goal preview endpoint (optional)

### Mobile/PWA Tasks (Agent 20)

**PWA-2.1: Mobile Optimizations**
- Implement touch gesture handlers
- Add haptic feedback for interactions
- Optimize map performance for mobile
- Create landscape mode layout
- Test on various devices

## Phase 3: Integration & Polish (Days 9-12)

### Frontend Tasks (Agent 16)

**FE-3.1: Complete Goal Creation Flow**
- Wire up form submission to API
- Implement success/error handling
- Add confirmation dialogs
- Create success redirect to team page
- Add goal creation to team page

**FE-3.2: Add Edit Mode**
- Create edit goal page variant
- Load existing goal data
- Implement update functionality
- Add delete goal option
- Handle permission checks

**FE-3.3: Performance Optimization**
- Implement map lazy loading
- Add request debouncing
- Optimize bundle size
- Add performance monitoring
- Cache geocoding results

### Backend Tasks (Agent 17)

**BE-3.1: Add Goal Update Support**
- Implement PUT endpoint for goal updates
- Add permission validation for edits
- Create goal history tracking
- Handle concurrent edit conflicts
- Add soft delete functionality

**BE-3.2: Optimize API Performance**
- Add database query optimization
- Implement response caching
- Add field filtering support
- Monitor API latency
- Set up alerts for failures

### Testing Tasks (Agent 10)

**QA-3.1: Comprehensive Testing**
- Unit tests for all components
- Integration tests for API endpoints
- E2E tests for complete flow
- Performance testing on mobile
- Accessibility testing

## Phase 4: Deployment (Days 13-14)

### DevOps Tasks (Agent 11)

**DO-4.1: Deployment Preparation**
- Update CDK infrastructure if needed
- Configure environment variables
- Set up monitoring dashboards
- Create deployment runbook
- Plan rollback strategy

**DO-4.2: Production Deployment**
- Deploy backend changes first
- Deploy frontend with feature flag
- Monitor error rates and performance
- Enable feature progressively
- Document any issues

## Technical Specifications

### API Contract

**Request:**
```typescript
POST /api/teams/{teamId}/goals
{
  "name": "Pacific Coast Adventure",
  "description": "Walk from Seattle to San Diego",
  "waypoints": [
    {
      "position": { "lat": 47.6062, "lng": -122.3321 },
      "address": "Seattle, WA",
      "order": 0
    },
    {
      "position": { "lat": 45.5152, "lng": -122.6784 },
      "address": "Portland, OR",
      "order": 1
    },
    {
      "position": { "lat": 32.7157, "lng": -117.1611 },
      "address": "San Diego, CA",
      "order": 2
    }
  ],
  "targetDate": "2025-03-31T00:00:00Z"
}
```

**Response:**
```typescript
{
  "success": true,
  "data": {
    "id": "goal-123",
    "teamId": "team-456",
    "name": "Pacific Coast Adventure",
    "description": "Walk from Seattle to San Diego",
    "targetDistance": 2014500, // meters
    "targetDate": "2025-03-31T00:00:00Z",
    "waypoints": [...],
    "routePolyline": "encoded_polyline_string",
    "status": "ACTIVE",
    "createdAt": "2025-01-20T10:00:00Z"
  }
}
```

### Component Structure

```
/components/goals/
├── GoalCreationPage.tsx       # Main page component
├── GoalForm.tsx               # Form fields component
├── RouteBuilder/
│   ├── index.tsx              # Route builder container
│   ├── Map.tsx                # Mapbox map component
│   ├── SearchBox.tsx          # Address search
│   ├── WaypointList.tsx       # Draggable list
│   └── WaypointMarker.tsx     # Map markers
├── hooks/
│   ├── useGoalCreation.ts     # Form state management
│   ├── useMapInteraction.ts   # Map event handlers
│   └── useRouteCalculation.ts # Route calculations
└── utils/
    ├── validation.ts          # Form validation
    └── mapHelpers.ts          # Map utilities
```

## Success Criteria

1. **Functionality**
   - Admins can create goals with 2-10 waypoints
   - Route automatically calculates total distance
   - Goals persist and display on team page
   - Edit functionality works correctly

2. **Performance**
   - Map loads in < 2 seconds
   - Route calculation < 1 second
   - Smooth interactions on mobile
   - No memory leaks

3. **User Experience**
   - Intuitive waypoint selection
   - Clear error messages
   - Responsive on all devices
   - Accessible via keyboard

4. **Quality**
   - 80%+ test coverage
   - No critical bugs
   - Passes accessibility audit
   - Clean code reviews

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Mapbox API limits | High | Implement caching, monitor usage |
| Complex route calculations | Medium | Add timeout, simplify algorithm |
| Mobile performance | High | Progressive loading, optimize assets |
| Browser compatibility | Medium | Test on major browsers, polyfills |
| Large waypoint lists | Low | Limit to 10 waypoints initially |

## Dependencies

1. **External Services**
   - Mapbox GL JS (v2.x)
   - Mapbox Geocoding API
   - Mapbox Directions API

2. **Internal Systems**
   - Authentication service
   - Team service
   - Notification service (for goal creation alerts)

3. **Developer Agents**
   - Frontend (16) - UI implementation
   - Backend (17) - API development  
   - Database (18) - Schema updates
   - Integration (19) - Mapbox setup
   - Mobile/PWA (20) - Mobile optimization

## Timeline Summary

- **Week 1**: Foundation + Core Features
- **Week 2**: Integration + Testing + Deployment
- **Buffer**: 2-3 days for issues and refinement

## Next Steps

1. Review and approve this plan
2. Assign tasks to developer agents
3. Set up daily sync meetings
4. Create feature branch
5. Begin Phase 1 implementation

---

*Created by Development Planning Agent*  
*Version 1.0*  
*For questions: Contact Lead Developer or Planning Agent*