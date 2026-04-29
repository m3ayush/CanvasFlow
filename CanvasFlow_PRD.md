# CanvasFlow — Product Requirements Document (PRD)

**Version:** 1.0  
**Date:** April 30, 2026  
**Status:** Ready for Development  
**Prepared for:** Antigravity (Development Team)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Target Users](#4-target-users)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture](#7-system-architecture)
8. [Technical Stack](#8-technical-stack)
9. [Data Models](#9-data-models)
10. [API Specification](#10-api-specification)
11. [WebSocket Event Protocol](#11-websocket-event-protocol)
12. [UI/UX Requirements](#12-uiux-requirements)
13. [Security Requirements](#13-security-requirements)
14. [Constraints & Assumptions](#14-constraints--assumptions)
15. [Out of Scope](#15-out-of-scope)
16. [Milestones & Timeline](#16-milestones--timeline)
17. [Open Questions](#17-open-questions)

---

## 1. Project Overview

**CanvasFlow** is a real-time collaborative whiteboard web application designed for remote teams, students, and educators. It enables multiple users to simultaneously draw, annotate, and interact on a shared digital canvas with sub-100ms latency.

The platform is built on an event-driven, layered architecture using WebSockets for real-time communication and CRDT (Conflict-free Replicated Data Types) for consistent state synchronization across all connected clients.

---

## 2. Problem Statement

Remote teams and students lack a seamless, open, and affordable tool for real-time visual collaboration. Existing solutions (Miro, Figma, etc.) suffer from the following critical limitations:

| Limitation | Description |
|---|---|
| High Latency | Use HTTP polling instead of WebSockets — unacceptable for drawing |
| No Conflict Resolution | No CRDT/OT strategy — concurrent edits cause data corruption |
| Single-Server Architecture | Not horizontally scalable; fails under load |
| No Offline-First Capability | Users lose all progress on disconnection |
| Rigid Design | Non-extensible architecture prevents adding plugins or custom tools |
| Proprietary Cost Restrictions | Seat-based pricing and vendor lock-in block academic/open-source use |

CanvasFlow addresses all of these with a purpose-built, open, and scalable architecture.

---

## 3. Goals & Success Metrics

### Primary Goals
- Deliver a low-latency (<100ms), real-time collaborative whiteboard as a web application.
- Support 200+ concurrent users per session without degradation.
- Achieve 99.9% uptime with no single point of failure.
- Ensure conflict-free canvas state across all distributed clients via CRDT.

### Success Metrics

| Metric | Target |
|---|---|
| End-to-end drawing event latency | < 100ms |
| Concurrent users per session | 200+ |
| Platform uptime | 99.9% |
| Canvas state consistency | 100% (CRDT-guaranteed) |
| Session resume success rate | 100% (persistent state) |
| Auth token validation time | < 50ms |

---

## 4. Target Users

### 4.1 End Users
Students, educators, developers, and remote team members who need real-time visual collaboration, drawing, and annotation.

| Persona | Use Case |
|---|---|
| Students | Collaborative learning and group projects |
| Educators | Interactive teaching and live annotation |
| Developers | Architecture diagrams and technical planning |
| Designers | Visual ideation and design reviews |
| Remote Teams | Distributed brainstorming and planning |

### 4.2 System Administrators
Manage sessions, user accounts, infrastructure provisioning, and ensure platform availability and security.

### 4.3 Developers / Team
Design, build, test, and maintain the platform architecture and all components.

---

## 5. Functional Requirements

### 5.1 Authentication & Authorization
- **FR-01:** Users must be able to register with email and password.
- **FR-02:** Users must be able to log in and receive a JWT access token.
- **FR-03:** All protected routes must validate JWT tokens on every request.
- **FR-04:** Sessions must be tied to authenticated users; anonymous joining may be supported with a display name.
- **FR-05:** Room creators can set access control (public / invite-only).

### 5.2 Session Management
- **FR-06:** Users can create a new whiteboard session, which generates a unique session ID.
- **FR-07:** Users can join an existing session via session ID or shareable link.
- **FR-08:** Session metadata (creator, participants, created time) must be stored persistently.
- **FR-09:** Sessions can be listed and retrieved by the creator.
- **FR-10:** Session creator can close/end a session.

### 5.3 Real-Time Drawing & Collaboration
- **FR-11:** Multiple users can draw simultaneously on a shared canvas; all changes are broadcast to all connected clients in real time.
- **FR-12:** Drawing events (strokes, shapes, text) must be synchronized using a CRDT-based mechanism to prevent conflicts.
- **FR-13:** New users joining an active session must receive the full current canvas state on connection.
- **FR-14:** Drawing actions are emitted as discrete events over WebSocket.

### 5.4 Drawing Tools
- **FR-15:** Pen/freehand drawing tool with configurable stroke color, width, and opacity.
- **FR-16:** Shape tools: rectangle, circle, line, and arrow.
- **FR-17:** Text input tool for placing text annotations on the canvas.
- **FR-18:** Eraser tool to remove strokes or objects.
- **FR-19:** Selection tool to move, resize, or delete placed objects.
- **FR-20:** Color picker and stroke size slider available in the toolbar.

### 5.5 Cursor Tracking
- **FR-21:** Each connected user's cursor position is broadcast to all other users in the session in real time.
- **FR-22:** Remote cursors are displayed with the user's display name or avatar label.

### 5.6 Undo / Redo
- **FR-23:** Each user can undo their own last action (local undo).
- **FR-24:** Undo/redo operations must maintain a consistent canvas state for all participants using CRDT operations.
- **FR-25:** Undo/redo history must persist for the session duration.

### 5.7 State Persistence
- **FR-26:** Canvas state must be saved to the database periodically (e.g., every 30 seconds) and on session close.
- **FR-27:** Users can resume a previous session and see the full canvas state restored.
- **FR-28:** Session history (list of events) must be retrievable for replay.

### 5.8 In-Session Chat
- **FR-29:** Each session has an integrated real-time chat panel.
- **FR-30:** Chat messages are scoped to the session and broadcast to all participants.
- **FR-31:** Chat history is persisted and loaded when a user joins.

---

## 6. Non-Functional Requirements

### 6.1 Performance
- **NFR-01:** End-to-end latency for all drawing events must be **< 100ms** under normal load.
- **NFR-02:** WebSocket message processing time on the server must be < 20ms per event.
- **NFR-03:** Canvas state snapshot retrieval must complete in < 500ms.

### 6.2 Scalability
- **NFR-04:** The system must support **200+ concurrent users per session**.
- **NFR-05:** The architecture must support **horizontal scaling** by adding Node.js instances behind a load balancer.
- **NFR-06:** Redis Pub/Sub must be used to synchronize events across all server instances.

### 6.3 Availability
- **NFR-07:** The platform must achieve **99.9% uptime**.
- **NFR-08:** There must be **no single point of failure** — the system must degrade gracefully on partial component failure.
- **NFR-09:** WebSocket disconnections must trigger automatic reconnection with state re-sync on the client.

### 6.4 Consistency
- **NFR-10:** CRDT-based synchronization must ensure all clients converge to the same canvas state regardless of network conditions or event ordering.
- **NFR-11:** Stale or out-of-order events must be handled without corrupting canvas state.

### 6.5 Security
- **NFR-12:** All WebSocket connections must use **WSS (encrypted WebSocket)**.
- **NFR-13:** All REST API endpoints must use **HTTPS**.
- **NFR-14:** Authentication must use **JWT tokens** with appropriate expiry.
- **NFR-15:** Session access must be gated by valid session membership — unauthorized users must not access a session's events or canvas state.

### 6.6 Maintainability
- **NFR-16:** The codebase must follow a **modular, microservice-friendly** structure.
- **NFR-17:** Each architectural layer (client, real-time, API, data) must be independently deployable and testable.
- **NFR-18:** The system must be documented with API specs, architecture diagrams, and inline code comments.

---

## 7. System Architecture

### 7.1 Architecture Pattern
**Event-Driven + Layered Architecture**

All drawing actions are emitted as events, decoupling producers from consumers. The system is organized into clear layers with defined interfaces between them.

### 7.2 Layers

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT LAYER                         │
│         React + Canvas API (Browser)                    │
│   Drawing Engine │ CRDT Client │ Socket.io Client       │
└────────────────────────┬────────────────────────────────┘
                         │ WSS / HTTPS
┌────────────────────────▼────────────────────────────────┐
│               REAL-TIME FABRIC LAYER                    │
│              Socket.io Server (Node.js)                 │
│      Event Broadcast │ Room Management │ Cursor Sync    │
└────────────────────────┬────────────────────────────────┘
                         │ Pub/Sub
┌────────────────────────▼────────────────────────────────┐
│               MESSAGE BROKER LAYER                      │
│                  Redis Pub/Sub                          │
│         Cross-instance event distribution               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│               APPLICATION LAYER                         │
│           Node.js + Express REST API                    │
│    Auth │ Session Management │ Persistence │ CRDT Logic │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  DATA LAYER                             │
│                    MongoDB                              │
│       Users │ Sessions │ Canvas State │ Chat History    │
└─────────────────────────────────────────────────────────┘
```

### 7.3 Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Real-time transport | WebSockets (Socket.io) | Persistent bidirectional channels; lower latency than HTTP polling |
| Conflict resolution | CRDT | Conflict-free merges without coordination; eventual consistency guaranteed |
| Cross-instance messaging | Redis Pub/Sub | Enables horizontal scaling — events fan out to all server instances |
| Client rendering | Canvas API (HTML5) | High-performance 2D rendering in browser; no plugin required |
| Persistence | MongoDB | Flexible schema for canvas state documents; easy JSON storage |

---

## 8. Technical Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React.js | Component-based UI |
| Drawing Engine | HTML5 Canvas API | Client-side rendering |
| Real-time Client | Socket.io Client | WebSocket event handling |
| CRDT Library | Yjs | Conflict-free collaborative data structures |
| Backend Runtime | Node.js | Server-side JavaScript runtime |
| REST Framework | Express.js | HTTP API layer |
| Real-time Server | Socket.io Server | WebSocket server and room management |
| Message Broker | Redis | Pub/Sub for cross-instance messaging |
| Database | MongoDB | Persistent storage for users, sessions, canvas state |
| Authentication | JWT (jsonwebtoken) | Stateless auth tokens |
| Deployment | Cloud free-tier (e.g., Render / Railway) | Cost-efficient deployment |

---

## 9. Data Models

### 9.1 User
```json
{
  "_id": "ObjectId",
  "email": "string (unique)",
  "passwordHash": "string",
  "displayName": "string",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.2 Session
```json
{
  "_id": "ObjectId",
  "sessionId": "string (unique, UUID)",
  "title": "string",
  "createdBy": "ObjectId (ref: User)",
  "participants": ["ObjectId (ref: User)"],
  "isActive": "boolean",
  "accessControl": "public | invite-only",
  "createdAt": "Date",
  "updatedAt": "Date"
}
```

### 9.3 CanvasState
```json
{
  "_id": "ObjectId",
  "sessionId": "string (ref: Session.sessionId)",
  "crdtSnapshot": "Buffer (Yjs encoded state)",
  "version": "number",
  "savedAt": "Date"
}
```

### 9.4 DrawingEvent
```json
{
  "_id": "ObjectId",
  "sessionId": "string",
  "userId": "ObjectId",
  "eventType": "stroke | shape | text | erase | undo | redo",
  "payload": "object (tool-specific data)",
  "timestamp": "Date",
  "crdtOp": "Buffer (Yjs update)"
}
```

### 9.5 ChatMessage
```json
{
  "_id": "ObjectId",
  "sessionId": "string",
  "userId": "ObjectId",
  "displayName": "string",
  "message": "string",
  "timestamp": "Date"
}
```

---

## 10. API Specification

### 10.1 Auth Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login and receive JWT | No |
| GET | `/api/auth/me` | Get current user profile | Yes |

### 10.2 Session Endpoints

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| POST | `/api/sessions` | Create a new session | Yes |
| GET | `/api/sessions` | List user's sessions | Yes |
| GET | `/api/sessions/:sessionId` | Get session metadata | Yes |
| DELETE | `/api/sessions/:sessionId` | Close/end a session | Yes (owner) |
| GET | `/api/sessions/:sessionId/canvas` | Get canvas snapshot | Yes |
| GET | `/api/sessions/:sessionId/chat` | Get chat history | Yes |

### 10.3 Sample Request/Response

**POST /api/auth/login**
```json
// Request
{
  "email": "user@example.com",
  "password": "securepassword"
}

// Response 200
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "email": "user@example.com",
    "displayName": "Jane Doe"
  }
}
```

**POST /api/sessions**
```json
// Request
{
  "title": "Sprint Planning Board",
  "accessControl": "invite-only"
}

// Response 201
{
  "sessionId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "title": "Sprint Planning Board",
  "shareLink": "https://canvasflow.app/join/a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "createdAt": "2026-04-30T10:00:00Z"
}
```

---

## 11. WebSocket Event Protocol

All real-time communication happens over Socket.io. Events are namespaced by session room (`sessionId`).

### 11.1 Client → Server Events

| Event | Payload | Description |
|---|---|---|
| `join-session` | `{ sessionId, token }` | Join a session room |
| `leave-session` | `{ sessionId }` | Leave a session room |
| `draw-event` | `{ sessionId, eventType, payload, crdtOp }` | Emit a drawing action |
| `cursor-move` | `{ sessionId, x, y }` | Broadcast cursor position |
| `chat-message` | `{ sessionId, message }` | Send a chat message |
| `undo` | `{ sessionId, crdtOp }` | Undo last action |
| `redo` | `{ sessionId, crdtOp }` | Redo last undone action |

### 11.2 Server → Client Events

| Event | Payload | Description |
|---|---|---|
| `session-joined` | `{ users, canvasSnapshot }` | Sent on join — full current state |
| `draw-event` | `{ userId, eventType, payload, crdtOp }` | Broadcast drawing event to room |
| `cursor-update` | `{ userId, displayName, x, y }` | Broadcast cursor position |
| `chat-message` | `{ userId, displayName, message, timestamp }` | Broadcast chat message |
| `user-joined` | `{ userId, displayName }` | Notify when a user joins |
| `user-left` | `{ userId, displayName }` | Notify when a user leaves |
| `error` | `{ code, message }` | Error notification |

### 11.3 Draw Event Payload Structure

```json
// Stroke event
{
  "eventType": "stroke",
  "payload": {
    "tool": "pen",
    "points": [[x1, y1], [x2, y2], "..."],
    "color": "#FF5733",
    "strokeWidth": 3,
    "opacity": 1.0
  },
  "crdtOp": "<Yjs binary update>"
}

// Shape event
{
  "eventType": "shape",
  "payload": {
    "tool": "rectangle",
    "x": 100, "y": 200,
    "width": 300, "height": 150,
    "color": "#3498DB",
    "filled": false
  },
  "crdtOp": "<Yjs binary update>"
}
```

---

## 12. UI/UX Requirements

### 12.1 Pages / Screens

| Screen | Description |
|---|---|
| Landing / Login | Login and register forms |
| Dashboard | List of user's sessions; option to create or join |
| Whiteboard | Main canvas, toolbar, participant panel, chat |

### 12.2 Whiteboard Screen Layout

```
┌──────────────────────────────────────────────────────────────┐
│  HEADER: Session title │ Participants (avatars) │ Share │ End │
├───────────────┬──────────────────────────────┬───────────────┤
│               │                              │               │
│   TOOLBAR     │       CANVAS (main)          │  CHAT PANEL   │
│               │                              │               │
│  pen          │   (HTML5 Canvas Element)     │  messages...  │
│  shapes       │                              │               │
│  text         │   [remote cursors shown]     │  [input box]  │
│  eraser       │                              │               │
│  select       │                              │               │
│               │                              │               │
│  color picker │                              │               │
│  stroke size  │                              │               │
│               │                              │               │
├───────────────┴──────────────────────────────┴───────────────┤
│  STATUS BAR: Connected │ X users online │ Last saved: ...    │
└──────────────────────────────────────────────────────────────┘
```

### 12.3 UX Requirements
- **UX-01:** Remote cursors must update smoothly with user labels visible.
- **UX-02:** Toolbar must be accessible and non-intrusive.
- **UX-03:** A connection status indicator must always be visible.
- **UX-04:** On disconnection, the app must show a "Reconnecting…" state and resume without data loss.
- **UX-05:** Session share link must be copyable with a single click.
- **UX-06:** Canvas must support pan and zoom.

---

## 13. Security Requirements

- **SEC-01:** Passwords must be hashed using bcrypt (min 10 rounds) before storage.
- **SEC-02:** JWTs must have a maximum expiry of 24 hours.
- **SEC-03:** All WebSocket connections must be authenticated — a valid JWT must be passed on `join-session`.
- **SEC-04:** Users must only receive events for sessions they are members of.
- **SEC-05:** All HTTP traffic must be redirected to HTTPS.
- **SEC-06:** API must implement rate limiting to prevent abuse.
- **SEC-07:** Sensitive config (JWT secret, DB URI, Redis URL) must be stored in environment variables — never hardcoded.

---

## 14. Constraints & Assumptions

### Constraints
| Type | Detail |
|---|---|
| Budget | Limited to cloud free-tier resources |
| Deployment | Web application only — no native mobile or desktop app |
| Timeline | ~3 months for complete working prototype |
| Team Size | 3–4 members with defined module ownership |
| Principles | Must follow software architecture design principles from course curriculum |

### Assumptions
- Users have a modern web browser with WebSocket support.
- Each session will have at most 200 concurrent users for prototype scope.
- CRDT library (Yjs) will be used for conflict resolution — custom CRDT implementation is not required.
- Free-tier MongoDB Atlas and Redis Cloud are sufficient for prototype load.

---

## 15. Out of Scope

The following features are explicitly **not** required for this project:

- Native mobile or desktop applications
- Video or audio conferencing
- File/image upload to canvas
- Third-party integrations (Slack, Jira, etc.)
- Billing or subscription management
- Advanced admin dashboards
- Offline-first / PWA support (may be future enhancement)
- Custom plugin system (future enhancement)

---

## 16. Milestones & Timeline

| Milestone | Deliverable | Target Week |
|---|---|---|
| M1 — Setup | Repo structure, CI/CD, env config, DB connection | Week 1–2 |
| M2 — Auth | Register, login, JWT, protected routes | Week 2–3 |
| M3 — Sessions | Session CRUD, join/leave, MongoDB persistence | Week 3–4 |
| M4 — WebSocket Core | Socket.io rooms, draw event broadcast, Redis Pub/Sub | Week 4–6 |
| M5 — Canvas Client | React canvas drawing engine, tool implementations | Week 5–7 |
| M6 — CRDT Sync | Yjs integration, conflict-free state sync | Week 6–8 |
| M7 — Cursor & Chat | Real-time cursor tracking, in-session chat | Week 8–9 |
| M8 — Persistence | Canvas snapshots, state restore on rejoin | Week 9–10 |
| M9 — Polish & Security | Rate limiting, WSS, UX polish, error handling | Week 10–11 |
| M10 — Review & Docs | Architecture diagrams, API docs, demo | Week 12 |

---

## 17. Open Questions

| # | Question | Owner | Status |
|---|---|---|---|
| 1 | Should anonymous (unauthenticated) users be able to join public sessions with a display name only? | Product | Open |
| 2 | What is the maximum canvas size (dimensions) for a session? | Engineering | Open |
| 3 | Should canvas snapshots be stored as Yjs binary, JSON, or SVG? | Engineering | Open |
| 4 | Is a persistent event log (for full replay) required, or only the latest snapshot? | Product | Open |
| 5 | What cloud provider is preferred for deployment (Render, Railway, Fly.io)? | DevOps | Open |
| 6 | Should the undo stack be per-user only, or should a global undo be supported? | Product | Open |

---

*Document prepared for Antigravity development team. All requirements should be confirmed with the product owner before sprint planning begins.*
