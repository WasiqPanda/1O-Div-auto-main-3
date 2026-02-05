# Military Patrol Tracking Application - PRD

## Original Problem Statement
Build a military patrol tracking application with:
- Real-time map dashboard for HQ control
- Interface for patrol commanders
- Live tracking using WebSockets/MQTT for low-network areas
- Multi-tenant architecture with subscription system
- **24-hour session trails** - trail data persists for the 24-hour session (00:01 to 00:00 next day)

## User Personas
1. **Master Admin** - Manages HQ accounts and subscriptions
2. **HQ Control** - Monitors multiple patrol units on map, communicates with patrols
3. **Patrol Commander** - Uses mobile interface to share location, receive orders, trigger SOS

## Core Requirements
- ✅ Live tracking of patrols on map
- ✅ Multi-tenancy for different HQs
- ✅ Subscription-based access (Trial/Normal/Pro - 300 patrol limit)
- ✅ KML/KMZ layer integration
- ✅ Patrol trail visualization
- ✅ **24-Hour Session Trails** (Updated Feb 3, 2026):
  - Session runs from 00:01 hrs to 00:00 hrs next day
  - Multiple patrols within same 24-hour session are ALL visible
  - Finished patrols remain visible with gray markers until 00:01 next day
  - Trail only clears at start of new day
- ✅ Video/Audio calls via Jitsi Meet
- ✅ Security hardening (JWT, bcrypt, rate limiting)
- ✅ Mobile number entry for patrol users
- ✅ Secure code verification (verbal code sharing)
- ✅ Secure messaging (HQ ↔ Patrol)
- ✅ SOS alerts with auto-detection
- ✅ Browser push notifications
- ✅ Email option for sending patrol links

## What's Been Implemented (Feb 2026)

### 24-Hour Session Trails (Updated - Feb 3, 2026)
**Session Logic:**
- Session = 24-hour window from 00:01 hrs to 00:00 hrs next day
- `session_date` field tracks which day's session (e.g., "2026-02-03")
- Trail only clears when a NEW DAY begins (not on each code verification)

**Multiple Patrols Same Day:**
- First patrol at 06:00, finishes at 10:00 → Trail visible until 00:01 next day
- Second patrol at 14:00 → Trail accumulates (doesn't replace first)
- Both trails visible on map with respective status colors

**Status Colors:**
- Active (tracking): Green marker + blue trail
- Finished: Gray marker + gray dashed trail
- SOS: Pulsing red marker

**Endpoints Updated:**
- `/api/verify-code`: Sets `session_date`, only clears trail if new day
- `/api/mqtt/location/{patrol_id}`: Stores `session_date` with each point
- `/api/patrols/{patrol_id}/trail`: Filters by current `session_date`
- `/api/patrols/trails/all`: Returns all patrols (active + finished) for session
- `/api/patrols/history`: View historical trails by date
- `/api/codes/end-session`: Marks patrol as finished, preserves trail with stats

### Secure Verification Flow
1. HQ clicks "Code" → Sees link + secret code
2. HQ sends link via WhatsApp OR Email (code NOT included)
3. HQ CALLS patrol user and tells code verbally
4. Patrol opens link → Must enter code to verify identity
5. Only verified users can start tracking
6. Multiple verifications same day = trails accumulate

### Backend (FastAPI + MongoDB)
- JWT authentication with password hashing (bcrypt)
- Rate limiting and account lockout
- WebSocket + MQTT dual real-time system
- Messaging endpoints (POST/GET /api/messages)
- SOS endpoints with auto-detection (/api/inactivity/check)
- Code verification endpoint (/api/verify-code) - now clears trail on new session
- Phone number field on patrols
- **Session management endpoints** (/api/codes/end-session)

### Frontend (React + Tailwind)
- HQ Dashboard with full-screen map
- Auto-hiding side panels
- "Send Link" button (WhatsApp + Email options)
- Secure Messaging modal (two-way + broadcast)
- SOS Alert Panel with browser notifications
- Special SOS markers on map (pulsing red)
- Identity Verification screen on PatrolCommander
- Email option in code dialog

### Security
- JWT tokens with expiry
- Password hashing (bcrypt)
- Rate limiting on sensitive endpoints
- Security headers middleware
- Input sanitization (bleach)
- Verbal code sharing (not sent digitally)

## Test Credentials
- Master Admin: `Wahid_Al_Towsif` / `1@mH@ppy`
- HQ User: `10_DIV_HQ` / `CMS@RamuCantt` (213 patrols)

## Verified Features (Tested Feb 2026)

### Session-Specific Trails ✅ (Feb 3, 2026)
- Trail cleared when new session starts
- Session ID stored with each trail point
- Trail endpoint filters by current session_id
- Full session lifecycle working (new session → locations → end → new session → empty trail)
- All 22 backend tests passing

### End-to-End Flow Test ✅
1. Code verification screen displays correctly
2. Wrong codes show error message
3. Correct codes grant access to dashboard
4. Location tracking starts after verification

### SOS Alerts ✅
- Auto-SOS triggers for inactive patrols (30 min threshold)
- Manual SOS alerts work
- Resolve SOS endpoint functional
- Browser notifications enabled

### Email Option ✅
- "Send Link via Email" button added to code dialog
- Opens email client with patrol link (no code)
- Works alongside WhatsApp option

## Tech Stack
- **Frontend**: React, Tailwind CSS, Leaflet.js, Shadcn UI
- **Backend**: FastAPI, Python, PyMongo
- **Database**: MongoDB
- **Real-time**: WebSockets, MQTT (Mosquitto)
- **Security**: JWT, bcrypt, slowapi, bleach
- **Communication**: Jitsi Meet, WhatsApp/Email links

## File Structure
```
/app
├── backend/
│   ├── server.py          # Main FastAPI app (verify-code clears trail, session_id in location updates)
│   ├── mqtt_bridge.py     # MQTT handler (stores session_id with trail points)
│   ├── security.py        # Auth & security functions
│   ├── models.py          # Pydantic models (with phone_number)
│   ├── database.py        # MongoDB connection
│   └── tests/
│       └── test_session_trails.py  # Session trails tests (22 tests)
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── HQDashboard.js   # With email/messaging/SOS
│       │   ├── PatrolCommander.js # With code verification
│       │   └── Login.js
│       └── components/hq/
│           ├── SecureMessaging.js
│           ├── SOSAlerts.js
│           ├── PatrolList.js   # Send Link button
│           ├── Dialogs.js      # WhatsApp + Email options
│           └── MapDisplay.js   # SOS markers, trails
└── test_reports/
    └── iteration_6.json       # Latest test results
```

## Prioritized Backlog

### P1 - High Priority
- Test Session Auto-Renewal (SessionManager.js)
- Test Subscription Expiry Warnings
- Deploy to production
- Test on real mobile devices in field

### P2 - Medium Priority
- Patrol Activity Reports
- Route Optimization AI
- Asset Status Tracking
- Incident Reporting module

### P3 - Future
- Integration with radio systems
- Offline-first mobile app (PWA)
- Advanced analytics dashboard

## Known Technical Debt
- Frontend lint warnings: `react-hooks/exhaustive-deps` in SecureMessaging.js and PatrolCommander.js
- Backend lint warnings: bare `except` clauses (not critical but should be fixed)
