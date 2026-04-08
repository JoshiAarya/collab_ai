# CollabAI Frontend

React 19 frontend for CollabAI — a real-time collaborative workspace with AI-powered engineering knowledge extraction.

## Stack

- **React 19** + **Vite 7**
- **WebSocket** — real-time messaging
- **Marked** + **DOMPurify** — markdown rendering with XSS protection
- **Xenova embeddings** (via backend) — semantic document search

## Setup

### Install dependencies
```bash
npm install
```

### Configure environment
```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

### Start dev server
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### Build for production
```bash
npm run build
```

---

## Project Structure

```
frontend/src/
├── components/
│   ├── Auth.jsx                    # Login + Register
│   ├── Onboarding.jsx              # 4-step first-time flow
│  ist, create, join
│   ├── ProjectWorkspace.jsx        # Main workspace UI
│   ├── ProjectIntelligenceCard.jsx # Stage, momentum, counts
│   ├── DecisionTimeline.jsx        # Decisions with rationale
│   ├── BlockerTracker.jsx          # Blockers with severity + age
│   ├── ModelSelector.jsx           # LLM provider + API key management
│   ├── Sidebar.jsx                 # Navigation sidebar
│   ├── ProfileModal.jsx            # Profile + password + stats
│   └── shared/
│       ├── ErrorBoundary.jsx
│       ├── Toast.jsx
│       └── SuccessModal.jsx
├── contexts/
│   ├── AuthContext.jsx             # Auth state, login/register/logout
│   ├── ThemeContext.jsx            # Light/dark theme, persists to DB
│   └── ToastContext.jsx            # Global toast notifications
├── hooks/
│   └── useToast.js
├── services/
│   ├── api.js                      # APIService class
│   ├── webso         # WebSocketService (reconnect, queue, heartbeat)
│   └── projectService.js
├── utils/
│   ├── api.js                      # apiRequest() + getWsUrl()
│   ├── avatarColors.js             # djb2 hash → 14 colors
│   ├── errorHandler.js
│   └── router.js                   # Invite URL parsing
├── config/
│   └── index.js                    # API base URL, endpoints, feature flags
├── styles/
│   └── theme.js                    # Theme color definitions
├── App.jsx
├── main.jsx
└── index.css
```

---

## Key Components

### ProjectWorkspace.jsx
The main UI. Tabs: Chat · Dashboard · Documents · Summaries · Settings.

**Chat**
- WebSocket real-time messaging
- `@CollabAI` mention triggers AI response
- Markdown rendering (marked + DOMPurify)
- Mention autocomplete

**Dashboard** (owner only)
- `ProjectIntelligenceCard` — stage badge, momentum trend, blocker/action/topic counts
- `DecisionTimeline` — decisions with topic tag, expandable rationale, relative timestamp
- `BlockerTracker` — blockeropic tag
- Activity chart (7-day), discussion breakdown, contributor stats
- Strategic signals panel
- "View All" modals for decisions and blockers

**Documents**
- Upload `.txt` / `.md` files
- Embedding status indicator
- Uploaded documents list

**Summaries**
- Generate discussion summary
- Refine with custom prompt
- Delete

**Settings**
- Invite link (copy)
- Email invite
- Members list

### ModelSelector.jsx
Supports 6 providers: Server (Groq) · OpenAI · Anthropic · Google · DeepSeek · xAI.
ment modal per provider. Search filter.

### Sidebar.jsx
48px icon bar + 280px collapsible panel. User section → dropdown: Profile · Switch Theme · Logout.

---

## AI Usage

Invoke CollabAI in any discussion:
```
@CollabAI what decisions have we made so far?
@CollabAI summarize the current blockers
@CollabAI what should we work on next?
```

The AI responds with context from:
- Project knowledge (decisions, blockers, topics, actions)
- Uploaded documents (semantic search)
- Recent discussion history
ries

---

## Theme System

CollabAI supports light anser's profile (persists across devices).

Toggle via the sidebar user menu → Switch Theme.

All components consume colors from `ThemeContext` — no hardcoded color values in component files.

---

## WebSocket

The `WebSocketService` (`services/websocket.js`) handles:
- Automatic reconnection with exponential backoff
- Message queue during disconnection
- Heartbeat ping/pong (30s)
- Auth on connect

```javascript
// Connection lifecycle
ws.connect(token)
ws.send({ type: 'project-chat', text: 'hello' })
ws.disconnect()
```

Events received:
- `project-chat` — new message (user or AI)
- `ai-thinking` — AI is generating
- `ai-error` — AI generation failed
- `discussion-joined` — joined with message history

---

## Scripts

```bash
npm run dev      # Dev server (HMR)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

---

## Troubleshooting

**WebSocket not connecting**
- Check backend is running on port 8080
- Verify `VITE_WS_BASE_URL` in `.env`

**AI not responding**
- Check backend logs for rate limit or API key errors
- Verify `@CollabAI` prefix is included

**Dashboard not loading**
- Only visible to project owner
- Requires at least some conversation history for entity model to populate

**Theme not persisting**
- Requires authenticated session
- Check backend `/api/user/profile` PUT is reachable

- **React 19** + **Vite 7**
- **WebSocket** — real-time messaging
- **Marked** + **DOMPurify** — markdown rendering with XSS protection
- **Xenova embeddings** (via backend) — semantic document search

## Setup

### Install dependencies
```bash
npm install
```

### Configure environment
```bash
cp .env.example .env
```

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

### Start dev server
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### Build for production
```bash
npm run build
```

---

## Project Structure

```
frontend/src/
├── components/
│   ├── Auth.jsx                    # Login + Register
│   ├── Onboarding.jsx              # 4-step first-time flow
│   ├── ProjectList.jsx             # Project list, create, join
│   ├── ProjectWorkspace.jsx        # Main workspace UI
│   ├── ProjectIntelligenceCard.jsx # Stage, momentum, counts
│   ├── DecisionTimeline.jsx        # Decisions with rationale
│   ├── BlockerTracker.jsx          # Blockers with severity + age
│   ├── ModelSelector.jsx           # LLM provider + API key management
│   ├── Sidebar.jsx                 # Navigation sidebar
│   ├── ProfileModal.jsx            # Profile + password + stats
│   └── shared/
│       ├── ErrorBoundary.jsx
│       ├── Toast.jsx
│       └── SuccessModal.jsx
├── contexts/
│   ├── AuthContext.jsx             # Auth state, login/register/logout
│   ├── ThemeContext.jsx            # Light/dark theme, persists to DB
│   └── ToastContext.jsx            # Global toast notifications
├── hooks/
│   └── useToast.js
├── services/
│   ├── api.js                      # APIService class
│   ├── websocket.js                # WebSocketService (reconnect, queue, heartbeat)
│   └── projectService.js
├── utils/
│   ├── api.js                      # apiRequest() + getWsUrl()
│   ├── avatarColors.js             # djb2 hash → 14 colors
│   ├── errorHandler.js
│   └── router.js                   # Invite URL parsing
├── config/
│   └── index.js                    # API base URL, endpoints, feature flags
├── styles/
│   └── theme.js                    # Theme color definitions
├── App.jsx
├── main.jsx
└── index.css
```

---

## Key Components

### ProjectWorkspace.jsx
The main UI. Tabs: Chat · Dashboard · Documents · Summaries · Settings.

**Chat**
- WebSocket real-time messaging
- `@CollabAI` mention triggers AI response
- Markdown rendering (marked + DOMPurify)
- Mention autocomplete

**Dashboard** (owner only)
- `ProjectIntelligenceCard` — stage badge, momentum trend, blocker/action/topic counts
- `DecisionTimeline` — decisions with topic tag, expandable rationale, relative timestamp
- `BlockerTracker` — blockers with severity color, days open, topic tag
- Activity chart (7-day), discussion breakdown, contributor stats
- Strategic signals panel
- "View All" modals for decisions and blockers

**Documents**
- Upload `.txt` / `.md` files
- Embedding status indicator

**Summaries**
- Generate discussion summary
- Refine with custom prompt
- Delete

**Settings**
- Invite link (copy) + email invite
- Members list

### ModelSelector.jsx
Supports 6 providers: Server (Groq) · OpenAI · Anthropic · Google · DeepSeek · xAI.
API key management modal per provider. Search filter.

### Sidebar.jsx
48px icon bar + 280px collapsible panel. User section → dropdown: Profile · Switch Theme · Logout.

---

## AI Usage

Invoke CollabAI in any discussion:
```
@CollabAI what decisions have we made so far?
@CollabAI summarize the current blockers
@CollabAI what should we work on next?
```

The AI responds with context from project knowledge (decisions, blockers, topics, actions), uploaded documents (semantic search), recent discussion history, and previous summaries.

---

## Theme System

Light and dark themes. Active theme stored in user profile — persists across devices. Toggle via sidebar user menu → Switch Theme. All components consume colors from `ThemeContext`.

---

## WebSocket

`WebSocketService` handles automatic reconnection with exponential backoff, message queue during disconnection, and heartbeat ping/pong (30s).

Events received: `project-chat` · `ai-thinking` · `ai-error` · `discussion-joined`

---

## Scripts

```bash
npm run dev      # Dev server (HMR)
npm run build    # Production build
npm run preview  # Preview production build
npm run lint     # ESLint
```

---

## Troubleshooting

**WebSocket not connecting** — Check backend is running on port 8080. Verify `VITE_WS_BASE_URL` in `.env`.

**AI not responding** — Check backend logs for rate limit or API key errors. Verify `@CollabAI` prefix is included.

**Dashboard not loading** — Only visible to project owner. Requires conversation history for entity model to populate.

**Theme not persisting** — Requires authenticated session. Check backend `/api/user/profile` PUT is reachable.
