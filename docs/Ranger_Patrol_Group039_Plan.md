# Ranger Patrol Implementation Plan – Group 039

## 1. Project Goal

Build the **Manage Ranger Patrols** feature from the Group 039 Smart Wildlife Conservation System.

The feature should support the complete patrol lifecycle:

**Park Manager assigns route → Ranger receives assignment → Ranger starts patrol → GPS tracking begins → Ranger adds waypoint/notes → Ranger ends patrol → system calculates patrol metrics → patrol data synchronizes with the central database.**

---

## 2. Main Users

### Park Manager
The Park Manager should be able to:

- View available patrol routes
- View high-risk or unpatrolled sectors
- View available field rangers
- Assign a patrol route to a ranger
- Prevent assignment if the ranger is already on an active patrol
- Reassign a patrol route before the patrol starts
- View completed patrol information
- View patrol distance, duration, waypoints, and coverage

### Field Ranger
The Field Ranger should be able to:

- View assigned patrols
- Open patrol details
- Start a patrol session
- View the assigned route on a map
- Track live GPS position
- Record automatic GPS waypoints
- Add manual waypoint markers
- Add observation notes
- End the patrol session
- View patrol summary
- Save patrol information offline if there is no network connection
- Synchronize stored patrol data when connectivity returns

---

## 3. Core System Flow

```text
Park Manager Login
        ↓
View Patrol Routes
        ↓
Select Route
        ↓
Select Available Ranger
        ↓
Assign Patrol
        ↓
Ranger Receives Assignment
        ↓
Ranger Opens Assigned Patrol
        ↓
Start Patrol Session
        ↓
GPS Tracking Starts
        ↓
Live Map + Breadcrumb Trail
        ↓
Add Waypoints / Observation Notes
        ↓
End Patrol Session
        ↓
Calculate Distance + Duration + Coverage
        ↓
Save Patrol
        ↓
Online?
   ┌────┴────┐
  Yes        No
   ↓          ↓
Sync DB    Save Locally
              ↓
        Sync When Online
```

---

## 4. Development Phases

## Phase 1 – Project Setup

### Tasks

- Create frontend project
- Create backend project
- Connect database
- Configure environment variables
- Create basic folder structure
- Configure API connection
- Set up authentication
- Create user roles:
  - `PARK_MANAGER`
  - `RANGER`

### Suggested structure

```text
project/
│
├── frontend/
│   ├── components/
│   ├── pages/
│   ├── services/
│   ├── hooks/
│   └── utils/
│
├── backend/
│   ├── controllers/
│   ├── services/
│   ├── repositories/
│   ├── models/
│   ├── routes/
│   └── config/
│
└── database/
```

---

## Phase 2 – Database Design

### User

```text
User
- id
- name
- email
- password
- role
- status
```

### Patrol Route

```text
PatrolRoute
- id
- routeName
- sector
- description
- startLatitude
- startLongitude
- endLatitude
- endLongitude
- estimatedDistance
- status
```

### Patrol Session

```text
PatrolSession
- id
- routeId
- rangerId
- assignedBy
- assignedAt
- startTime
- endTime
- totalDistance
- duration
- coveragePercentage
- status
- syncStatus
```

### Patrol Waypoint

```text
PatrolWaypoint
- id
- patrolSessionId
- latitude
- longitude
- note
- waypointType
- timestamp
```

### GPS Log

```text
GPSLog
- id
- patrolSessionId
- latitude
- longitude
- timestamp
```

---

## 5. Status Values

### Patrol Route Status

```text
AVAILABLE
ASSIGNED
IN_PROGRESS
COMPLETED
```

### Patrol Session Status

```text
ASSIGNED
ACTIVE
COMPLETED
CANCELLED
```

### Sync Status

```text
SYNCED
PENDING_SYNC
FAILED
```

---

## 6. Park Manager Features

## 6.1 Manager Dashboard

Display:

- Total patrol routes
- Available routes
- Active patrols
- Completed patrols
- Available rangers
- Rangers currently on patrol

---

## 6.2 Patrol Route List

Display:

- Route name
- Sector
- Distance
- Risk level
- Route status
- Assigned ranger

Actions:

- View route
- Assign ranger
- Reassign ranger

---

## 6.3 Assign Patrol

### Flow

1. Manager selects a patrol route.
2. System loads available rangers.
3. Manager selects a ranger.
4. System checks whether the ranger already has an active patrol.
5. If available, create a patrol assignment.
6. Update route status to `ASSIGNED`.
7. Send/display assignment to the ranger.

### Validation

Do not allow assignment if:

```text
Ranger already has ACTIVE patrol
```

Display:

```text
This ranger is currently assigned to an active patrol.
Please select another ranger.
```

---

## 7. Ranger Features

## 7.1 Ranger Dashboard

Display:

- Assigned patrols
- Active patrol
- Completed patrols

Example:

```text
--------------------------------
My Patrols

Route: North Boundary
Sector: Sector 03
Status: Assigned

[ View Patrol ]
--------------------------------
```

---

## 7.2 Patrol Details

Display:

- Route name
- Sector
- Route map
- Estimated distance
- Assigned date/time
- Patrol instructions

Button:

```text
[ Start Patrol Session ]
```

---

## 7.3 Start Patrol

When the ranger starts the patrol:

1. Check GPS availability.
2. Create/start the patrol session.
3. Record start timestamp.
4. Change patrol status to `ACTIVE`.
5. Start GPS tracking.
6. Display live map.

---

## 8. Live Patrol Tracking Screen

This should be the main Ranger Patrol screen.

### Display

- Live map
- Ranger's current position
- Assigned route
- Breadcrumb trail
- Patrol duration
- Distance travelled
- Current speed
- Number of waypoints
- GPS status
- Network/sync status

### Buttons

```text
[ + Add Waypoint ]

[ End Patrol Session ]
```

Example layout:

```text
--------------------------------
Manage Ranger Patrol

Duration: 02h 14m
Distance: 5.4 km
Speed: 3.2 km/h

        [ MAP ]

     Route + GPS Trail

[ + Add Waypoint ]

[ End Patrol Session ]
--------------------------------
```

---

## 9. GPS Tracking

### When Patrol Starts

Start reading the ranger's location periodically.

Example:

```text
Every 5–15 seconds:
    Get GPS location
    Save latitude
    Save longitude
    Save timestamp
    Update map
    Update breadcrumb trail
```

### GPS Data

```json
{
  "latitude": 6.4214,
  "longitude": 80.5632,
  "timestamp": "2026-10-07T10:30:00"
}
```

---

## 10. Manual Waypoint Feature

The ranger can create a manual observation point.

### Add Waypoint Screen

Fields:

- Current latitude
- Current longitude
- Observation note
- Waypoint type

Example waypoint types:

```text
Observation
Risk Area
Animal Sighting
Boundary Check
Other
```

Button:

```text
[ Save Waypoint ]
```

### Flow

```text
Ranger clicks Add Waypoint
        ↓
System captures current GPS
        ↓
Ranger enters note
        ↓
Save waypoint
        ↓
Waypoint appears on map
```

---

## 11. End Patrol Session

When the ranger selects:

```text
[ End Patrol Session ]
```

Show confirmation:

```text
Are you sure you want to end this patrol?

[ Cancel ] [ End Patrol ]
```

If confirmed:

1. Stop GPS tracking.
2. Record end timestamp.
3. Calculate patrol duration.
4. Calculate total distance.
5. Calculate route coverage.
6. Save patrol session.
7. Change route/session status.
8. Attempt synchronization.

---

## 12. Patrol Summary Screen

Display:

```text
Patrol Completed

Route: North Boundary
Duration: 2h 14m
Distance: 5.4 km
Waypoints: 4
Coverage: 92%

Sync Status: Synced

[ Back to Dashboard ]
```

---

## 13. Patrol Metrics

### Duration

```text
duration = endTime - startTime
```

### Total Distance

Calculate the distance between consecutive GPS points.

```text
GPS Point 1 → GPS Point 2
GPS Point 2 → GPS Point 3
GPS Point 3 → GPS Point 4

Total Distance =
distance1 + distance2 + distance3
```

### Coverage

A simple initial implementation can compare:

```text
distance travelled / planned route distance × 100
```

Later, this can be improved using actual route geometry.

---

## 14. Offline Support

Offline support is an important requirement.

### If Internet Is Available

```text
GPS Logs
   ↓
Backend API
   ↓
Central Database
```

### If Internet Is Not Available

```text
GPS Logs
   ↓
Local Storage / Local Database
   ↓
Status = PENDING_SYNC
```

When connection returns:

```text
Detect Internet
    ↓
Find Pending Patrol Data
    ↓
Send to Backend
    ↓
Server Confirms
    ↓
Mark as SYNCED
```

---

## 15. Local Data to Store

Store locally:

- Patrol session information
- GPS logs
- Manual waypoints
- Ranger notes
- Start time
- End time
- Sync status

Possible technologies:

### Web Application

```text
IndexedDB
```

### Mobile Application

```text
SQLite
Room Database
AsyncStorage
```

Use the technology that matches your final implementation platform.

---

## 16. Exception Handling

## GPS Failure

If GPS is unavailable:

```text
GPS signal unavailable.
Please move to an open area and try again.
```

Possible behavior:

- Pause automatic breadcrumb recording
- Keep existing patrol data
- Retry GPS
- Allow the patrol to continue once GPS returns

---

## Critical Battery

If device battery becomes very low:

1. Save all current patrol information.
2. Save GPS logs locally.
3. Mark data as pending synchronization.
4. Warn the ranger.

Example:

```text
Battery critically low.
Your patrol data has been saved locally.
```

---

## No Network

Do not stop the patrol.

Instead:

```text
No network connection.
Patrol data is being stored offline.
```

---

## Ranger Already Busy

When the manager attempts to assign an active ranger:

```text
Assignment Failed

The selected ranger is already participating
in another active patrol.
```

---

## 17. Recommended API Endpoints

### Authentication

```http
POST /api/auth/login
```

### Rangers

```http
GET /api/rangers
GET /api/rangers/available
GET /api/rangers/{id}
```

### Patrol Routes

```http
GET /api/patrol-routes
GET /api/patrol-routes/{id}
POST /api/patrol-routes
PUT /api/patrol-routes/{id}
```

### Patrol Assignment

```http
POST /api/patrols/assign
PUT /api/patrols/{id}/reassign
```

### Ranger Patrols

```http
GET /api/rangers/{rangerId}/patrols
GET /api/patrols/{id}
```

### Patrol Session

```http
POST /api/patrols/{id}/start
POST /api/patrols/{id}/end
```

### GPS

```http
POST /api/patrols/{id}/gps
POST /api/patrols/{id}/gps/batch
```

### Waypoints

```http
POST /api/patrols/{id}/waypoints
GET /api/patrols/{id}/waypoints
```

### Synchronization

```http
POST /api/patrols/{id}/sync
```

---

## 18. Frontend Screens

### Park Manager

```text
1. Login
2. Manager Dashboard
3. Patrol Route List
4. Route Details
5. Assign Ranger
6. Active Patrols
7. Completed Patrol Details
```

### Ranger

```text
1. Login
2. Ranger Dashboard
3. Assigned Patrols
4. Patrol Details
5. Live Patrol Tracking
6. Add Waypoint
7. End Patrol Confirmation
8. Patrol Summary
```

---

## 19. Suggested Component Structure

```text
components/
│
├── Map/
│   ├── PatrolMap
│   ├── RangerMarker
│   ├── RoutePath
│   └── WaypointMarker
│
├── Patrol/
│   ├── PatrolCard
│   ├── PatrolStats
│   ├── PatrolStatus
│   └── PatrolSummary
│
├── Waypoint/
│   ├── WaypointForm
│   └── WaypointList
│
└── Common/
    ├── Navbar
    ├── Button
    ├── Modal
    └── Loading
```

---

## 20. Recommended Development Order

Do not attempt all features at once.

### Step 1

Build:

```text
Login
↓
Ranger Dashboard
↓
Assigned Patrol List
```

### Step 2

Build:

```text
Patrol Details
↓
Start Patrol
```

### Step 3

Add:

```text
Map
+
Current GPS Location
```

### Step 4

Add:

```text
GPS Logging
+
Breadcrumb Trail
```

### Step 5

Add:

```text
Manual Waypoints
+
Observation Notes
```

### Step 6

Add:

```text
End Patrol
+
Patrol Summary
```

### Step 7

Add:

```text
Distance Calculation
+
Duration
+
Coverage
```

### Step 8

Build Park Manager features:

```text
Route List
↓
Available Rangers
↓
Assign Patrol
```

### Step 9

Add:

```text
Offline Storage
+
Automatic Synchronization
```

### Step 10

Add exception handling and testing.

---

## 21. Minimum Viable Product

For the first working version, complete these features:

- Login
- Ranger receives assigned patrol
- Ranger starts patrol
- GPS position displayed
- GPS locations recorded
- Breadcrumb route displayed
- Ranger adds waypoint
- Ranger adds observation note
- Ranger ends patrol
- Distance calculated
- Duration calculated
- Patrol summary displayed
- Patrol saved to database

After this works, implement:

- Park Manager route assignment
- Ranger availability validation
- Route reassignment
- Offline mode
- Synchronization
- Battery/GPS exception handling
- Coverage analytics

---

## 22. Testing Checklist

### Assignment

- [ ] Manager can assign patrol route
- [ ] Only available ranger can be selected
- [ ] Busy ranger cannot receive another patrol

### Start Patrol

- [ ] Ranger can see assigned patrol
- [ ] Start time is stored
- [ ] Patrol status changes to ACTIVE
- [ ] GPS tracking starts

### GPS

- [ ] GPS coordinates are recorded
- [ ] Map displays current ranger location
- [ ] Breadcrumb trail updates
- [ ] GPS failure does not delete patrol data

### Waypoints

- [ ] Ranger can add waypoint
- [ ] Coordinates are stored
- [ ] Notes are stored
- [ ] Marker appears on map

### End Patrol

- [ ] GPS tracking stops
- [ ] End time is stored
- [ ] Distance is calculated
- [ ] Duration is calculated
- [ ] Patrol status changes to COMPLETED

### Offline

- [ ] Patrol works without Internet
- [ ] GPS logs are stored locally
- [ ] Patrol gets PENDING_SYNC status
- [ ] Data automatically syncs after reconnecting

---

## 23. Final Demo Scenario

For the assignment demonstration, use a simple story.

### Manager

```text
Manager logs in
        ↓
Views North Boundary patrol route
        ↓
Selects Ranger A
        ↓
Assigns route
```

### Ranger

```text
Ranger logs in
        ↓
Sees North Boundary assignment
        ↓
Opens patrol
        ↓
Starts patrol
        ↓
GPS tracking begins
        ↓
Ranger walks/moves
        ↓
Breadcrumb trail appears
        ↓
Adds waypoint:
"Possible damaged boundary fence"
        ↓
Continues patrol
        ↓
Ends patrol
```

### System

```text
Calculates:

Distance: 5.4 km
Duration: 2h 14m
Waypoints: 3
Coverage: 92%

        ↓

Saves patrol
        ↓
Synchronizes with server
```

### Manager

```text
Opens completed patrol
        ↓
Views route, coverage and ranger observations
```

---

## 24. Final Target

The finished Ranger Patrol module should demonstrate these four major capabilities:

### 1. Patrol Management

The Park Manager can assign an appropriate route to an available ranger.

### 2. Field Tracking

The system records the ranger's movement using GPS and displays the patrol trail.

### 3. Field Observations

The ranger can create manual waypoints with geographic coordinates and notes.

### 4. Reliable Data Storage

Patrol information is saved and synchronized even when the ranger temporarily loses network connectivity.

---

## 25. Priority

### Must Have

- Patrol assignment
- Start patrol
- GPS tracking
- Live map
- Breadcrumb trail
- Manual waypoint
- Observation note
- End patrol
- Distance
- Duration
- Database save

### Should Have

- Offline caching
- Automatic synchronization
- Ranger availability validation
- Coverage percentage

### Nice to Have

- Battery warning
- Route reassignment
- Advanced patrol analytics
- High-risk sector visualization
- Notifications

---

**Implementation strategy:** Build the basic online patrol lifecycle first. Once Start Patrol → GPS Tracking → Waypoint → End Patrol works correctly, add offline synchronization and advanced exception handling.
