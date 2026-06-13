# CollabAI — Real-Time AI Collaborative Workspace

A real-time collaborative workspace where multiple users work together with a shared AI assistant. Teams collaborate in the same AI context, with semantic retrieval over messages, decisions, and documents, plus a passively-built knowledge graph (topics, decisions, blockers, action items) surfaced on an intelligence dashboard.

## Core Problem

Current AI platforms follow a single-user model. Teams brainstorm individually and manually merge ideas, leading to lost context, inconsistent AI outputs, and poor collective decision tracking. CollabAI gives every team member access to the **same AI with the same shared context**.

---

## Quick Start

### Docker (Recommended)

```bash
cp .env.example .env        # fill in MONGO_ROOT_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, GROQ_API_KEY
docker-compose up --build
```

App at **http://localhost:8080** (API + WS + static frontend) | Swagger at **http://localhost:8080/docs**

### Local Development

```bash
# Backend
cd backend
cp .env.example .env        # fill in GROQ_API_KEY, MONGODB_URI, JWT_SECRET, ENCRYPTION_KEY
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Generate secrets: `openssl rand -base64 48` (JWT_SECRET), `openssl rand -hex 32` (ENCRYPTION_KEY).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, WebSocket, marked + DOMPurify, react-toastify, react-icons |
| Backend | Node.js 20 (ESM), Express 5, ws, helmet, express-rate-limit |
| Database | MongoDB 7 (Mongoose 8) |
| AI | Groq (server default, streaming) + OpenAI, Anthropic, Google Gemini, DeepSeek, xAI via per-project API keys |
| Embeddings | Xenova/all-MiniLM-L6-v2 — local, 384-dim, zero API cost |
| Auth | JWT (7-day expiry) + bcrypt; Google OAuth |
| API Docs | Swagger UI at `/docs` |
| Deployment | Docker multi-service + docker-compose |

---

## Features

### Core Collaboration
- **Real-Time Chat** — WebSocket with 30s heartbeat, auto-reconnection, rate limiting (30 msg/min per client); authentication and project membership enforced on every socket action
- **@CollabAI Mentions** — invoke the AI in any discussion; responses **stream token-by-token** to all participants (Groq; other providers respond as a single chunk)
- **Parallel Discussions** — multiple focused threads per project with participant management
- **Project Management** — create/join via 8-char hex invite codes, owner/member roles
- **Document Upload** — `.txt` / `.md` files, chunked (900 chars / 100 overlap) with async embedding generation
- **AI Summaries** — generate, refine, and delete discussion summaries with custom prompts
- **Invite System** — share link, copy invite code, or send email via SendGrid

### AI Intelligence
- **Entity-aware AI context** — every AI prompt is grounded with: pinned project state (~100-token rollup), semantically retrieved decisions (top 8), parallel discussion summaries, semantically similar past messages (top 15), relevant document chunks (top 5), and the last 30 messages
- **Passive knowledge extraction** — every 7th human message, a 13-message sliding window is run through LLM extraction (decisions / blockers / action items / topics, strict JSON, temp 0.2), validated, then merged
- **Dedup ladder** — substring containment → cosine similarity ≥ 0.80 → create new; merges grow `supportingMessageIds` and `occurrenceCount`
- **Topic lifecycle** — candidate → stable (seen ≥ 3×) → parked (30-day decay); blockers surface at occurrence ≥ 2 or high severity; severity only escalates
- **Manual decision bookmarking** — save any message as a decision; saved instantly, then LLM-normalized into neutral engineering language and embedded in the background
- **ProjectState** — stage (ideation/discussion/blocked), momentum (7-day vs prior-7-day volume), open counts, and the pinned context injected into every AI system prompt
- **EmbeddingWorker** — background 60s loop that retries failed message/decision embeddings (no Redis needed)
- **Stability layer** — token counting + context trimming, per-user (20/min) and per-project (50/min) AI rate limits, LLM guardrails (30s timeout, retry, error categorization)
- **API key encryption** — per-project provider keys encrypted at rest with AES-256-GCM

### Dashboard
- Project state card (stage, momentum, counts), stable topics, decisions, open blockers (resolvable), open action items (completable)

### UI/UX
- Light/dark theme persisted per-user in MongoDB; model selector with 6 providers and API key management; profile management; 4-step onboarding; Google OAuth

---

## Project Structure

```
CollabAI/
├── backend/src/
│   ├── server.js                       # Express app, helmet, CORS, routes, /docs, static SPA (prod)
│   ├── config/                         # env config (fail-fast in production), database, swagger
│   ├── routes/                         # auth.js (rate-limited), projects.js, user.js
│   ├── middleware/                     # auth (JWT), validation, errorHandler (8 error classes)
│   ├── services/
│   │   ├── connectionManager.js        # WS lifecycle, auth + membership enforcement, AI streaming
│   │   ├── EmbeddingWorker.js          # 60s backfill loop for failed embeddings
│   │   └── aiService / authService / projectService / discussionService /
│   │       documentService / summaryService / emailService
│   ├── core/
│   │   ├── orchestrator/AIOrchestrator.js   # context builder + 6 provider callers + streaming
│   │   ├── intelligence/
│   │   │   ├── IntelligencePipeline.js      # rate gate (every 7 msgs), window builder
│   │   │   ├── InsightExtractor.js          # LLM JSON extraction + validation
│   │   │   └── KnowledgeAggregator.js       # dedup ladder, lifecycle, ProjectState
│   │   ├── embeddings/EmbeddingService.js   # Xenova all-MiniLM-L6-v2, lazy init
│   │   ├── vector/VectorStore.js            # cosine search: chunks, messages, decisions
│   │   └── stability/                       # TokenManager, RateLimiter, EncryptionService, LLMGuardrails
│   ├── models/                         # User, Project, Discussion, Message, MessageEmbedding,
│   │                                   # Document, DocumentChunk, Summary, Topic, Decision,
│   │                                   # Blocker, ActionItem, ProjectState
│   └── scripts/                        # demo-data simulations (npm run simulate)
└── frontend/src/
    ├── App.jsx                         # auth gate, invite handling, OAuth callback
    ├── components/                     # Auth, ProjectList, ProjectWorkspace, Dashboard,
    │                                   # ModelSelector, Sidebar, ProfileModal, Onboarding
    ├── contexts/                       # AuthContext, ThemeContext, ToastContext
    └── services/                       # api.js (HTTP), websocket.js (reconnect + queue)
```

---

## Environment Variables

### Backend (`backend/.env`)
```env
# Required (server refuses to start in production without strong values)
MONGODB_URI=mongodb://localhost:27017/collabai
JWT_SECRET=                      # openssl rand -base64 48
GROQ_API_KEY=
ENCRYPTION_KEY=                  # openssl rand -hex 32 (64 hex chars)

# Optional
PORT=8080
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
SENDGRID_API_KEY=
FROM_EMAIL=noreply@collabai.com
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:8080/api/auth/google/callback
RATE_LIMIT_USER_PER_MIN=20
RATE_LIMIT_PROJECT_PER_MIN=50
```

### Frontend (`frontend/.env`)
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

---

## Demo Data

```bash
cd backend
npm run simulate            # simulated team conversation
npm run simulate:hirehub    # alternative scenario
```

---

## Known Limitations

| Area | Issue |
|------|-------|
| Vector search | In-memory cosine over all project embeddings per query — fine for small teams, won't scale to large projects |
| Pagination | Chat loads the latest 50 messages; older history not yet reachable |
| Streaming | Token streaming for Groq only; other providers return a single chunk |
| Testing | No automated test suite yet |
| Monitoring | No Sentry / Prometheus / APM |
| Mobile | Desktop-first |

> `SYSTEM_BLUEPRINT.md`, `DISCUSSIONS.md`, and `UI_SCREENS_DOCUMENTATION.md` are historical design documents and may not reflect the current implementation. `README.md` and `ARCHITECTURE.md` are kept current.

---

## License

MIT
