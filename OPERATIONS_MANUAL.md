# 🎖️ Military Patrol Tracker - Operations Manual
## Basic Operating Procedures (BOP)

**Version:** 1.0  
**Classification:** OPERATIONAL  
**Powered by:** BA-8993 Major Wahid  
**Contact:** endora.dream@gmail.com

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Access & Authentication](#2-access--authentication)
3. [HQ Control Center Operations](#3-hq-control-center-operations)
4. [Patrol Commander Mobile App](#4-patrol-commander-mobile-app)
5. [Video Communication (Jitsi Meet)](#5-video-communication-jitsi-meet)
6. [Subscription Management](#6-subscription-management)
7. [Map Features & Controls](#7-map-features--controls)
8. [Emergency Procedures](#8-emergency-procedures)
9. [Troubleshooting](#9-troubleshooting)
10. [API Reference](#10-api-reference)

---

## 1. System Overview

### 1.1 Purpose
The Military Patrol Tracker is a real-time tactical operations monitoring system designed for:
- Live tracking of patrol units in the field
- Two-way communication between HQ and patrol commanders
- Emergency SOS alerts and incident reporting
- Subscription-based multi-tenant access control

### 1.2 System Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    MILITARY PATROL TRACKER                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    WebSocket/MQTT    ┌─────────────────┐  │
│   │  HQ Control │◄──────────────────────►│ Patrol Commander│  │
│   │  Dashboard  │                       │   Mobile App    │  │
│   └──────┬──────┘                       └────────┬────────┘  │
│          │                                       │           │
│          └───────────────┬───────────────────────┘           │
│                          │                                   │
│                   ┌──────▼──────┐                           │
│                   │   Backend   │                           │
│                   │   FastAPI   │                           │
│                   └──────┬──────┘                           │
│                          │                                   │
│                   ┌──────▼──────┐                           │
│                   │   MongoDB   │                           │
│                   └─────────────┘                           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 User Roles
| Role | Access Level | Description |
|------|--------------|-------------|
| **Master Admin** | Full System | Manages all HQ accounts, subscriptions, and system settings |
| **HQ Admin** | HQ Dashboard | Monitors patrols, communicates with commanders, manages patrol data |
| **Patrol Commander** | Mobile App | Shares location, receives orders, sends SOS alerts |

---

## 2. Access & Authentication

### 2.1 Login Page
**URL:** `/` (Root)

The login page provides two access points:
1. **HQ Control Center** - For HQ administrators
2. **Patrol Commander** - For field patrol personnel

### 2.2 HQ Login Procedure
1. Navigate to the application URL
2. Enter your **Username** and **Password**
3. Click **"ACCESS DASHBOARD"**
4. If Master Admin, redirects to `/admin`
5. If HQ Admin, redirects to `/hq`

**Default Test Credentials:**
- Master Admin: `Wahid_Al_Towsif` / `1@mH@ppy`
- HQ Demo: `hq_demo` / `demo123`

### 2.3 Patrol Commander Access
1. Click **"LAUNCH PATROL APP"** from the login page
2. Use the patrol link or access code provided by HQ
3. Format: `/patrol?id={PATROL_ID}`

### 2.4 Request HQ Access
New organizations can request access:
1. Click **"Request HQ registration"** on the login page
2. Fill in: HQ Name, Location, Email, Phone
3. Submit request
4. Await Master Admin approval

---

## 3. HQ Control Center Operations

### 3.1 Dashboard Overview
The HQ Dashboard consists of:
- **Header Bar** - Stats, connection status, subscription info
- **Map Display** - Real-time patrol locations
- **Side Panel** - Patrol list, alerts, create new patrol

### 3.2 Header Components
| Component | Description |
|-----------|-------------|
| **HQ Name** | Current HQ identifier |
| **LIVE/POLL** | Connection status (WebSocket or HTTP polling) |
| **Total** | Total number of patrols |
| **Approved** | Patrols with verified status |
| **Tracking** | Actively transmitting patrols |
| **Alerts** | Unread notifications count |

### 3.3 Patrol Management

#### Creating a New Patrol
1. Click the **"+ New"** tab in the side panel
2. Fill in patrol details:
   - **Name** (required)
   - **Camp Name**
   - **Unit**
   - **Leader Email**
   - **Assigned Area**
3. Click **"Create Patrol"**

#### Editing a Patrol
1. Find the patrol in the list
2. Click the **"Edit"** button
3. Modify details
4. Save changes

#### Deleting a Patrol
1. Click the **"Delete"** (trash icon) button
2. Confirm deletion in the dialog

### 3.4 Generating Access Codes
To provide patrol commander access:
1. Select a patrol from the list
2. Click **"Code"** button
3. Share the generated code or QR with the commander

### 3.5 Video Calling a Patrol
1. Find the patrol in the list
2. Click the **"Call"** (green video icon) button
3. Jitsi Meet modal opens
4. Share the meeting link with the patrol commander
5. Use controls: Mic, Camera, Screen Share, End Call

### 3.6 Map Controls

| Control | Function |
|---------|----------|
| **Map/Sat/Topo/Dark** | Switch map styles |
| **Trails On/Off** | Toggle patrol trail display |
| **Heat Toggle** | Show/hide heatmap layer |
| **MAP LAYERS** | Toggle KML/KMZ layers |

---

## 4. Patrol Commander Mobile App

### 4.1 Accessing the App
**URL:** `/patrol?id={PATROL_ID}`

The mobile interface is optimized for field use with:
- Dark tactical theme
- Glassmorphism UI
- Large touch targets

### 4.2 Dashboard View
- **Patrol Status** - Name, unit, connection status
- **Quick Stats** - Signal, Battery, Queued updates
- **Current Position** - GPS coordinates
- **Tracking Button** - Start/stop location sharing
- **Priority Orders** - Mission objectives from HQ

### 4.3 Starting Location Tracking
1. Tap **"ACTIVATE LIVE TRACKING"**
2. Allow location permissions when prompted
3. Status changes to "TRACKING ACTIVE"
4. GPS coordinates update automatically

### 4.4 Features Menu
Navigate using bottom tabs:
| Tab | Function |
|-----|----------|
| **Dashboard** | Main status view |
| **Features** | Access all patrol features |
| **Team** | View team members |
| **SOS** | Emergency distress signal |

### 4.5 Feature Cards
- **Live Tracking** - Real-time GPS sharing
- **Route Optimization** - AI patrol routes (future)
- **Secure Messaging** - Encrypted comms (future)
- **Incident Reporting** - Document incidents (future)
- **Asset Status** - Equipment tracking (future)
- **Team Presence** - Team member locations

### 4.6 Offline Mode
When disconnected:
- Updates queue locally
- **"Queued"** counter shows pending updates
- Auto-sync when connection restored
- Manual sync available via menu

---

## 5. Video Communication (Jitsi Meet)

### 5.1 Initiating a Call (HQ)
1. Open patrol list in HQ Dashboard
2. Click the green **"Call"** button
3. Modal opens with video interface
4. Share the meeting link with patrol commander

### 5.2 Joining a Call (Patrol)
1. Receive meeting link from HQ
2. Open link in browser
3. Join the Jitsi meeting room

### 5.3 Call Controls
| Control | Action |
|---------|--------|
| 🎤 Mic | Mute/unmute microphone |
| 📹 Camera | Toggle video on/off |
| 🖥️ Screen | Share your screen |
| ⬜ Fullscreen | Toggle fullscreen mode |
| 🔴 End | End the call |

### 5.4 Copy Meeting Link
Click **"Copy Link"** to share the Jitsi room URL with participants.

---

## 6. Subscription Management

### 6.1 Subscription Plans
| Plan | Duration | Max Patrols | Max Tracking | Session |
|------|----------|-------------|--------------|---------|
| **Trial** | 7 days | 3 | 3 | 30 min |
| **Normal** | 30 days | 50 | 25 | 12 hours |
| **Pro** | 30 days | Unlimited | Unlimited | 24 hours |

### 6.2 Viewing Subscription Status
1. Click the subscription badge in the header (e.g., "NORMAL 5/50")
2. Dialog shows: Plan, Status, Time Remaining, Limits

### 6.3 Session Auto-Renewal (Trial)
- Trial plan has 30-minute sessions
- Warning appears at 5 minutes remaining
- Click **"Extend Session"** to reset timer
- Auto-logout on session expiry

### 6.4 Expired Subscription
- Overlay blocks dashboard access
- Contact: `endora.dream@gmail.com` to renew

---

## 7. Map Features & Controls

### 7.1 Map Styles
- **Map** - Standard street map
- **Sat** - Satellite imagery
- **Topo** - Topographic map
- **Dark** - Dark theme map

### 7.2 Patrol Markers
- Click marker to select patrol
- View trail history
- Popup shows patrol details

### 7.3 KML/KMZ Layers
The MAP LAYERS panel allows:
1. Toggle layer groups on/off
2. Upload custom KML/KMZ files
3. View layer feature counts

#### Uploading Custom KML
1. Expand MAP LAYERS panel
2. Click **"Upload KML"**
3. Select your KML/KMZ file
4. Layer appears in the list

### 7.4 Heatmap
- Toggle **"Heat"** switch in top-left
- Shows patrol location density
- Useful for coverage analysis

### 7.5 Trail History
- Enable **"Trails On"** to show patrol paths
- Default shows last 24 hours
- Color-coded by patrol

---

## 8. Emergency Procedures

### 8.1 Sending SOS Alert (Patrol Commander)
1. Tap **"SOS"** in bottom navigation
2. Enter optional emergency message
3. Verify location is displayed
4. Tap **"TRANSMIT SOS"**
5. Confirmation: "SOS TRANSMITTED"

### 8.2 Receiving SOS Alert (HQ)
1. Toast notification appears
2. Alert added to Notifications panel
3. Alert icon shows in header
4. Click to view full details

### 8.3 SOS Data Transmitted
- Patrol ID
- Message content
- GPS coordinates
- Timestamp

---

## 9. Troubleshooting

### 9.1 Connection Issues

**Problem:** "POLL" indicator instead of "LIVE"
- WebSocket connection failed
- System falls back to HTTP polling
- **Solution:** Check network, refresh page

**Problem:** Location not updating
- GPS permissions may be blocked
- **Solution:** Enable location in browser/device settings

### 9.2 Login Issues

**Problem:** "Subscription expired" error
- **Solution:** Contact `endora.dream@gmail.com` for renewal

**Problem:** "Account pending approval" error
- **Solution:** Wait for Master Admin approval

### 9.3 Map Issues

**Problem:** Map not loading
- **Solution:** Check internet connection, refresh page

**Problem:** KML layers not showing
- **Solution:** Verify KML file format, try re-uploading

### 9.4 Mobile App Issues

**Problem:** Tracking not starting
- **Solution:** Enable location permissions, check GPS signal

**Problem:** Updates queued but not syncing
- **Solution:** Check network, manually tap sync button

---

## 10. API Reference

### 10.1 Authentication Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/hq/login` | HQ user login |
| POST | `/api/hq/request-access` | Request new HQ access |

### 10.2 Patrol Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/patrols?hq_id={id}` | List all patrols |
| POST | `/api/patrols` | Create new patrol |
| PUT | `/api/patrols/{id}/details` | Update patrol |
| DELETE | `/api/patrols/{id}` | Delete patrol |
| GET | `/api/patrol/{id}` | Public patrol info |

### 10.3 Real-time Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| WS | `/ws/{hq_id}` | WebSocket connection |
| POST | `/api/mqtt/location/{patrol_id}` | REST location update |
| POST | `/api/sos` | Send SOS alert |

### 10.4 KML Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kml/geojson` | Convert KML URL to GeoJSON |
| POST | `/api/kml/upload` | Upload custom KML file |
| GET | `/api/kml/files` | List uploaded KML files |

### 10.5 Subscription Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/subscription/status` | Get subscription info |
| GET | `/api/session/status` | Get session info |
| POST | `/api/session/renew` | Extend session |

---

## Quick Reference Card

### HQ Dashboard Shortcuts
- **Click patrol** → Select and fly to location
- **Checkbox** → Toggle visibility on map
- **Call button** → Initiate video call
- **Code button** → Generate access code
- **Edit button** → Modify patrol details

### Patrol Commander Actions
- **Dashboard** → View status & tracking
- **Features** → Access all capabilities
- **Team** → View team members
- **SOS** → Emergency distress signal

### Map Layer Toggles
- **Heat** → Density heatmap
- **Trails On** → Patrol paths
- **MAP LAYERS** → KML/KMZ layers

---

**Document Control:**
- Created: February 2026
- Last Updated: February 2026
- Author: System Documentation

**Classification:** OPERATIONAL  
**Powered by:** BA-8993 Major Wahid
