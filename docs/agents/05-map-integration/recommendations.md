# Map Integration Agent Recommendations

**Agent**: 05-map-integration  
**Version**: 2.0  
**Date**: 2025-01-19

## Recommendations for Other Agents

### For Frontend Developer Agent (16)

1. **Implement Map Service Abstraction First**
   - Priority: HIGH
   - Create the service abstraction layer before implementing components
   - This ensures all map functionality is vendor-agnostic from the start
   - Reference: `map-integration-implementation-guide.md` Section 3

2. **Mobile Gesture Support**
   - Priority: HIGH
   - Implement touch gestures using @use-gesture/react
   - Test thoroughly on actual mobile devices
   - Ensure smooth 60 FPS performance

3. **Lazy Loading Strategy**
   - Priority: MEDIUM
   - Use dynamic imports for the RouteBuilder component
   - Map components should not load until needed
   - This significantly improves initial page load time

### For Backend API Developer Agent (17)

1. **Add Route Storage Endpoints**
   - Priority: HIGH
   - Teams need to store route data (waypoints, polyline)
   - Consider adding:
     ```typescript
     POST /api/v1/teams/:teamId/route
     GET /api/v1/teams/:teamId/route
     PUT /api/v1/teams/:teamId/route
     ```

2. **Implement Distance Validation**
   - Priority: MEDIUM
   - When creating team goals, validate that calculated distance matches stored distance
   - Prevent tampering with distance values
   - Add server-side route distance calculation for verification

### For Database Developer Agent (18)

1. **Add Route Storage Tables**
   - Priority: HIGH
   - Need to store waypoints and route data
   - Suggested schema additions:
     ```sql
     Route table:
     - id (UUID)
     - teamId (FK)
     - waypoints (JSONB)
     - encodedPolyline (TEXT)
     - totalDistance (INTEGER)
     - bounds (JSONB)
     ```

2. **Add Spatial Indexes**
   - Priority: MEDIUM
   - If using PostGIS, add spatial indexes for waypoint queries
   - This enables efficient "nearby teams" features in the future

### For Mobile/PWA Developer Agent (20)

1. **Implement Map Caching**
   - Priority: HIGH
   - Use service workers to cache map tiles
   - Allow users to download regions for offline use
   - Reference the caching strategy in the implementation guide

2. **Optimize Touch Targets**
   - Priority: HIGH
   - Waypoint markers need 44x44px minimum touch targets
   - Test drag operations on various screen sizes
   - Consider haptic feedback for waypoint selection

### For Testing & QA Agent (10)

1. **Map Component Testing**
   - Priority: HIGH
   - Mock the MapService for all tests
   - Test route calculation with various waypoint counts
   - Verify mobile gesture handling

2. **Performance Testing**
   - Priority: MEDIUM
   - Route calculation should complete in < 2 seconds
   - Map should maintain 60 FPS during pan/zoom
   - Test with 20 waypoints (maximum allowed)

### For Security Agent (06)

1. **API Key Protection**
   - Priority: HIGH
   - Mapbox tokens should never be exposed in server code
   - Use domain restrictions on production tokens
   - Monitor API usage for unusual patterns

2. **Route Data Validation**
   - Priority: MEDIUM
   - Validate waypoint coordinates are within valid ranges
   - Prevent injection attacks through address search
   - Sanitize user-provided location names

### For Integration Agent (08)

1. **Fitness App Route Import**
   - Priority: LOW (Future Enhancement)
   - Consider allowing import of routes from Strava, Garmin
   - Would need to parse GPX/TCX files
   - Convert to our waypoint format

### For Analytics & Gamification Agent (09)

1. **Map Usage Analytics**
   - Priority: LOW
   - Track popular routes and waypoints
   - Monitor map interaction patterns
   - Could suggest popular routes to new teams

## Implementation Priority Order

1. **Database schema** for route storage (Database Developer)
2. **Service abstraction layer** implementation (Frontend Developer)
3. **Core map components** (Frontend Developer)
4. **API endpoints** for route management (Backend Developer)
5. **Mobile optimizations** (Mobile/PWA Developer)
6. **Testing suite** (Testing & QA Agent)

## Notes

- The map integration is designed to be vendor-agnostic
- Mapbox is the initial provider but can be swapped easily
- Performance on mobile devices is critical
- Offline support should be considered from the start