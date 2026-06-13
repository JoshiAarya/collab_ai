# CollabAI — System Architecture

> **Last Updated:** June 12, 2026

---

## Overview

**CollabAI** is a real-time collaborative workspace that builds and maintains engineering knowledge from team conversations. It extracts decisions, blockers, action items, and topics from discussions — not by labeling messages, but by incrementally updating a shared knowledge model over time.

**Stack:** React 19 + Vite 7 · Node.js 20 / Express 5 · MongoDB 7 · Groq (default) + OpenAI / Anthropic / Google / DeepSeek / xAI · Xenova local embeddings (384-dim, no API cost)

---

## Backend Layout

```
backend/src/
├── server.js — helmet, CORS, sanitize, routes, /health, /docs (Swagger),
│               static frontend (prod), EmbeddingWorker + WS startup
├── config/ — index.js (env config, production fail-fast), database.js, swagger.js
├── routes/
│   ├── auth.js — register/login (brute-force rate-limited), Google OAuth
│   │             (token delivered via URL fragment), /verify
│   ├── projects.js — projects, discussions, documents, summaries, decisions,
│   │                 dashboard, blockers, action items (all project-scoped)
│   └── user.js — profile, password, stats
├── middleware/ — auth.js (JWT) · validation.js (schema validation; body wins
│                 over query) · errorHandler.js (8 custom error classes)
├── services/
│   ├── connectionManager.js — WS lifecycle, heartbeat 30s, rate limit
│   │   30 msg/min; auth + membership + discussion-ownership enforced on
│   │   join-project and project-chat; AI streaming broadcast
│   ├── EmbeddingWorker.js — 60s loop retrying failed message/decision embeddings
│   ├── aiService.js — thin wrapper → AIOrchestrator
│   └── authService / projectService / discussionService / documentService /
│       summaryService / emailService
├── core/
│   ├── orchestrator/AIOrchestrator.js — context builder, system prompt,
│   │   provider callers (groq/server, openai, anthropic, google,
│   │   deepseek, xai), Groq streaming, role normalization for
│   │   Anthropic/Gemini, summary generation/refinement
│   ├── intelligence/
│   │   ├── IntelligencePipeline.js — counts human messages per discussion;
│   │   │   every 7th message pulls a 13-message human window and triggers
│   │   │   extraction (non-blocking, per-discussion in-flight guard)
│   │   ├── InsightExtractor.js — LLM extraction (temp 0.2, strict JSON) of
│   │   │   decisions/blockers/actionItems/topics; length + word-count
│   │   │   validation; max 5 per type per window
│   │   └── KnowledgeAggregator.js — dedup ladder, severity escalation,
│   │       topic lifecycle, ProjectState + pinnedContext recompute
│   ├── embeddings/EmbeddingService.js — Xenova all-MiniLM-L6-v2, lazy init
│   ├── vector/VectorStore.js — cosine similarity over DocumentChunks,
│   │   MessageEmbeddings, and embedded Decisions
│   └── stability/ — TokenManager (counting/trimming) · RateLimiter
│       (20/min user, 50/min project) · EncryptionService (AES-256-GCM) ·
│       LLMGuardrails (30s timeout, retry, error categorization)
├── models/ — User · Project · Discussion · Message · MessageEmbedding ·
│   Document · DocumentChunk · Summary · Topic · Decision · Blocker ·
│   ActionItem · ProjectState
└── scripts/ — demo-data simulations (simulate-conversation, simulate-hirehub,
    simulations/*), maintenance utilities
```

## Frontend Layout

```
frontend/src/
├── App.jsx — ErrorBoundary > AuthProvider > ThemeProvider; invite-link
│   handling (InviteConfirmModal), OAuth callback (token read from URL fragment)
├── components/ — Auth, Onboarding, ProjectList, ProjectWorkspace (chat,
│   documents, summaries, settings — large component, refactor planned),
│   Dashboard, ModelSelector (6 providers + API key management), Sidebar,
│   ProfileModal, shared/ (ErrorBoundary, Toast, SuccessModal)
├── contexts/ — AuthContext (uses services/api.js) · ThemeContext (persists
│   to DB) · ToastContext
├── services/ — api.js (APIService: token handling, error normalization) ·
│   websocket.js (reconnect with exponential backoff, message queue)
└── utils/ — api.js (apiRequest fetch wrapper) · avatarColors · router
    (invite URL parsing) · errorHandler
```

---

## Intelligence Pipeline

The principle: **messages update knowledge, they don't create it.**

### Extraction

`IntelligencePipeline.onHumanMessage()` runs for every human message ≥ 30 chars (not `@CollabAI` commands). Every **7th** message per discussion, it pulls the last **13** human messages and sends them to `InsightExtractor`:

- LLM extraction at temperature 0.2, strict JSON shape
- Validation: minimum text length, ≤ 18 words, topics ≤ 4 words, bounded to 5 artifacts per type per window
- Failures are swallowed — extraction never blocks chat

### Aggregation (KnowledgeAggregator)

Per artifact, a 3-step merge ladder:

```
Step 1: Substring containment (normalized text)  → merge into existing
Step 2: Embedding cosine similarity ≥ 0.80       → merge into existing
Step 3: No match                                 → create new
```

On merge: `occurrenceCount++`, `supportingMessageIds` grows, `lastSeenAt` updates, blocker severity only escalates. Auto-extracted decisions are create-only — they never overwrite human-bookmarked decisions.

### Surfacing rules

| Type | Rule |
|------|------|
| Topics | `status === 'stable'` (occurrence ≥ 3); parked after 30 days idle |
| Decisions | All surface (manual bookmarks are authoritative; auto-extractions create-only) |
| Blockers | `occurrenceCount ≥ 2` OR `severity === 'high'` |
| Actions | `status === 'open'` |

### ProjectState

Recomputed after every aggregation pass: stage (blocked / discussion / ideation), momentum (7-day vs prior-7-day message volume: rising / stable / falling), open counts, and `pinnedContext` — a ~100-token summary of top decisions/blockers/topics/actions injected into every AI system prompt.

---

## Data Flow

### Chat → AI Response (streaming)
```
User: "@CollabAI question"
  → connectionManager: auth + membership check → rate limit → save → broadcast
  → handleAIInvocation()
      → AIOrchestrator.handleStreamingRequest()
          → RateLimiter.checkLimits()
          → buildProjectContext():
              pinnedContext + semantic decisions (top 8) + parallel-discussion
              summaries + semantic past messages (top 15) + document chunks
              (top 5, or positional fallback) + last 3 summaries + last 30 messages
          → constructMessages() → TokenManager.trimContext()
          → Groq streaming → broadcast ai-stream-start / -chunk / -end
          (non-Groq providers: single-chunk fallback)
      → save AI message → broadcast final message
```

### User Message → Knowledge
```
User sends any message
  → save → broadcast
  → embed into MessageEmbedding (non-blocking; EmbeddingWorker retries failures)
  → IntelligencePipeline.onHumanMessage() (non-blocking, rate-gated)
      → every 7th msg: 13-message window → InsightExtractor → KnowledgeAggregator
      → recompute ProjectState + pinnedContext
```

### Manual Decision Bookmark
```
POST /api/projects/:id/decisions { messageId }
  → verify message belongs to project (discussionId derived from message)
  → Decision saved immediately with raw text → respond + broadcast 'message-saved'
  → background: LLM normalization (neutral engineering language + rationale)
  → background: embedding for semantic retrieval (EmbeddingWorker backfills failures)
```

### Dashboard Load
```
GET /api/projects/:id/dashboard (any member)
  → ProjectState + stable Topics + surfaced Blockers + open ActionItems + Decisions
```

---

## Providers

`AIOrchestrator.callProvider()` supports: `server`/`groq` (env key, streaming), `openai`, `anthropic`, `google`, `deepseek`, `xai` (per-project keys, encrypted AES-256-GCM at rest). Legacy stored provider names `gemini`/`claude` are mapped to `google`/`anthropic`.

Provider-specific handling:
- **Anthropic / Gemini** — chat history is normalized (consecutive same-role turns merged, conversation forced to start with a user turn) because multi-user history routinely produces consecutive user messages
- **Anthropic Opus 4.7+ / Fable** — sampling parameters omitted (the API rejects them)
- **DeepSeek / xAI** — OpenAI-compatible APIs via `baseURL` override

---

## Security Model

- JWT auth on all REST routes; WS requires auth before join/chat
- Project membership checked on every project-scoped route; child resources (summaries, messages, documents, discussions) verified to belong to the project in the URL
- Google OAuth: ID tokens verified against Google with audience check; OAuth redirect carries the token in the URL fragment (never sent to servers)
- Brute-force rate limiting on auth endpoints (20 / 15 min / IP); helmet headers; `trust proxy` in production
- Production fail-fast: refuses to boot with default/missing `JWT_SECRET` or missing `ENCRYPTION_KEY`
- Per-project provider API keys encrypted at rest (AES-256-GCM, `select: false`)

---

## Technical Debt / Roadmap

| Priority | Item |
|----------|------|
| 🔴 High | No test suite |
| 🔴 High | No message pagination (latest 50 only) |
| 🟡 Medium | In-memory vector search loads all project embeddings per query |
| 🟡 Medium | `EmbeddingWorker` scans all MessageEmbedding IDs each run |
| 🟡 Medium | `ProjectWorkspace.jsx` monolith (~4k lines) needs splitting |
| 🟢 Low | No document/project deletion routes |
| 🟢 Low | Streaming for non-Groq providers |
| 🟢 Low | No discussion branching UI (backend schema ready) |

---

## Deployment

```bash
cp .env.example .env   # set MONGO_ROOT_PASSWORD, JWT_SECRET, ENCRYPTION_KEY, GROQ_API_KEY
docker-compose up --build
# MongoDB :27017, App :8080 (API + WS + static frontend + Swagger at /docs)
```

Cloud (Render / Railway / Fly.io): set build args `VITE_API_BASE_URL` / `VITE_WS_BASE_URL` to your public domain, plus the required env vars above. The server sets `trust proxy` in production so rate limiting works behind the platform proxy.
