# Mile Quest User Journey Maps

## Overview

This document outlines the key user journeys for Mile Quest, mapping out the step-by-step experiences users will have when interacting with our platform. Each journey considers mobile-first constraints, technical architecture, and user goals.

## Journey 1: New User Onboarding

### User Goal
Join Mile Quest and either create or join a team quickly

### Journey Steps

1. **Discovery**
   - User arrives at landing page (mobile web)
   - Sees value proposition: "Walk Together, Go Further"
   - Views sample team achievements and routes
   - Taps "Get Started" CTA

2. **Registration**
   - Email/password or social auth options (Google, Apple)
   - Single-screen registration with progressive disclosure
   - Real-time validation feedback
   - Auto-advances on successful registration

3. **Initial Setup**
   - Welcome screen with 3-step progress indicator
   - Step 1: Basic profile (name, avatar)
   - Step 2: Choose path - "Create Team" or "Join Team"
   - Step 3: Enable notifications (optional but encouraged)

4. **Team Path Split**
   
   **Path A: Create Team**
   - Team name and description
   - Choose first destination (map interface)
   - Set team goal (distance/timeframe)
   - Generate invite code/link
   - Share options (native share sheet)
   
   **Path B: Join Team**
   - Enter invite code or scan QR
   - Preview team details and members
   - Confirm join
   - View team dashboard

5. **First Success**
   - Celebration animation
   - Quick tour of key features (3 tooltips max)
   - Prompt to log first activity
   - Land on team dashboard

### Technical Touchpoints
- POST /auth/register
- POST /teams (create path)
- POST /teams/{id}/join (join path)
- WebSocket connection for real-time updates

### Success Metrics
- Time to complete: < 2 minutes
- Drop-off rate: < 15%
- Team action completion: > 90%

---

## Journey 2: Daily Activity Logging

### User Goal
Quickly log walking activity and see progress

### Journey Steps

1. **Entry Point**
   - Push notification reminder (if enabled)
   - App icon badge with activity prompt
   - Opens to activity logging screen

2. **Activity Input**
   - Default: Manual entry with smart suggestions
   - Alternative: Fitness app sync status visible
   - Large, thumb-friendly number input
   - Distance unit toggle (miles/km)
   - Optional: Add photo or note

3. **Submission**
   - Single tap to submit
   - Instant visual feedback (progress animation)
   - Show personal contribution to team goal
   - Update team position on route

4. **Social Reinforcement**
   - Team feed update with activity
   - Potential achievement unlock animation
   - Encourage teammates option
   - Return to dashboard

### Technical Touchpoints
- POST /activities
- WebSocket broadcast to team
- Background sync if offline

### Success Metrics
- Time to log: < 30 seconds
- Daily active users: > 60%
- Activities with notes/photos: > 20%

---

## Journey 3: Team Creation and Route Planning

### User Goal
Create an inspiring team challenge with meaningful waypoints

### Journey Steps

1. **Team Setup**
   - Team name (character limit indicator)
   - Team description (optional)
   - Privacy setting (public/private)
   - Team size limit (optional)

2. **Route Creation**
   - Full-screen map interface
   - Search bar for location lookup
   - Tap to add waypoints (minimum 2)
   - Drag to reorder waypoints
   - Auto-calculate total distance
   - Show estimated completion time

3. **Goal Setting**
   - Choose challenge type:
     - Distance goal (complete route)
     - Time-based (miles in 30 days)
     - Milestone-based (reach waypoints)
   - Set deadline (calendar picker)
   - Add motivation message

4. **Team Building**
   - Generate unique invite code
   - Create shareable link
   - QR code for in-person sharing
   - Direct invite via contacts (optional)
   - Preview how team page looks

5. **Launch Team**
   - Review and confirm details
   - Publish team
   - First share prompt
   - Redirect to team dashboard

### Technical Touchpoints
- POST /teams
- POST /waypoints
- POST /waypoints/calculate-route
- Real-time distance calculations

### Success Metrics
- Team creation completion: > 80%
- Average waypoints per route: 3-5
- Teams with 3+ members: > 70%

---

## Journey 4: Progress Tracking and Celebration

### User Goal
Stay motivated by visualizing progress and celebrating milestones

### Journey Steps

1. **Dashboard View**
   - Hero section: Route progress visualization
   - Personal stats card (streak, total, average)
   - Team leaderboard (supportive framing)
   - Recent team activities feed

2. **Progress Deep Dive**
   - Tap progress bar for detailed view
   - Interactive map showing current position
   - Distance to next waypoint
   - Team member contributions graph
   - Pace analysis (ahead/behind schedule)

3. **Milestone Achievement**
   - Full-screen celebration animation
   - Achievement badge earned
   - Share achievement option
   - Team notification sent
   - Motivational message

4. **Social Engagement**
   - React to teammate activities
   - Leave encouraging comments
   - Share photos from walks
   - Challenge other teams (future)

### Technical Touchpoints
- GET /teams/{id}/progress
- WebSocket for real-time updates
- GET /activities with pagination

### Success Metrics
- Daily dashboard visits: > 1.5 per user
- Milestone celebration shares: > 40%
- Team interaction rate: > 30%

---

## Journey 5: Fitness App Integration

### User Goal
Automatically sync walking data without manual entry

### Journey Steps

1. **Discovery**
   - Settings menu option
   - Integration benefits explanation
   - Supported apps grid (Fitbit, Apple Health, etc.)

2. **Authorization**
   - Select fitness platform
   - OAuth redirect flow
   - Clear permission explanation
   - Authorize data access

3. **Configuration**
   - Sync frequency options
   - Data privacy preferences
   - Activity type filtering
   - Test sync option

4. **Ongoing Sync**
   - Background sync indicator
   - Last sync timestamp
   - Manual sync trigger
   - Sync conflict resolution

### Technical Touchpoints
- OAuth integration endpoints
- POST /activities/sync
- EventBridge scheduled sync

### Success Metrics
- Integration adoption: > 40%
- Sync success rate: > 95%
- Reduced manual entries: > 60%

---

## Accessibility Considerations

All journeys must support:
- Screen reader navigation
- Voice control
- High contrast mode
- Text size preferences
- Reduced motion options

## Offline Scenarios

Each journey includes offline handling:
- Cached data display
- Queue actions for sync
- Clear offline indicators
- Automatic retry on connection

## Error States

Common error handling:
- Network timeouts
- Invalid inputs
- Server errors
- Conflict resolution
- Helpful error messages

---

*Last Updated: [Current Date]*
*UI/UX Design Agent*