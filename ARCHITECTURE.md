# CollabAI — System Architecture

> **Last Updated:** March 20, 2026

---

## Overview

**CollabAI** is a real-time collaborative workspace that builds and maintains engineering knowledge from team conversations. It extracts decisions, blockers, action items, and topics from discussions — not by labeling messages, but by incrementally updating a shared knowledge model over time.

**Stack:** React 19 + Vite 7 · Node.js 20 / Express 5 · MongoDB 7 · Groq API · Xenova local embeddings (384-dim, no API cost)

---

## Architecture Diagram

```
FRONTEND (React 19 + Vite 7)
├── App.jsx — ErrorBoundary > AuthProvider > ThemeProvider > AppContent
│   └── InviteConfirmModal (preview project/discussion before joining)
├── Auth.jsx — Login/Register + Google OAuth
├── Onboarding.jsx — 4-step first-time flow (localStorage)
├── ProjectList.jsx — List + CreateProjectModal + JoinProjectModal
├── ProjectWorkspace.jsx — Main UI
│   ├── Chat: WebSocket, @CollabAI, markdown (marked+DOMPurify), mention autocomplete
│   ├── Dashboard: health bar, topic tags, decisions, blockers, actions,
│   │   activity chart, discussion breakdown, message distribution, contributors,
│   │   strategic signals, "View All" modals
│   │   + ProjectIntelligenceCard, DecisionTimeline, BlockerTracker
│   ├── Documents: upload, embedding status
│   ├── Summaries: generate, refine with custom prompt, delete
│   └── Settings: invite link, email invite, members list
├── ProjectIntelligenceCard.jsx — Stage badge, momentum trend, counts
├── DecisionTimeline.jsx — Decisions with topicName, rationale (expandable), timestamp
├── BlockerTracker.jsx — Blockers with severity badge, daysOpen, topicName
├── ModelSelector.jsx — 6 providers, API key management, search filter
├── Sidebar.jsx — icon bar (48px) + collapsible panel (280px)
├── ProfileModal.jsx — Profile + Password + stats
└── shared/ — ErrorBoundary, Toast, SuccessModal

Contexts: AuthContext · ThemeContext (persists to DB) · ToastContext
Services: api.js (APIService) · websocket.js (reconnect + queue) · projectService.js
Utils: avatarColors.js · router.js (invite URL parsing) · errorHandler.js

BACKEND (Node.js 20 / Express 5 + ws)
├── server.js — CORS, sanitize, /health, /docs (Swagger), static frontend (prod)
├── Routes: auth.js · projects.js (full CRUD + dashboard) · user.js
├── Services:
│   ├── connectionManager.js — WS lifecycle, heartbeat 30s, rate limit 30msg/min
│   ├── aiService.js — thin wrapper → AIOrchestrator
│   ├── authService.js · projectService.js · discussionService.js
│   ├── documentService.js — upload + async embedding generation
│   ├── summaryService.js · emailService.js · userService.js
│   └── messageService.js / roomService.js — LEGACY, unused
├── Core Intelligence Pipeline:
│   ├── orchestrator/AIOrchestrator.js — central hub, entity-aware context builder
│   ├── embeddings/EmbeddingService.js — Xenova all-MiniLM-L6-v2, 384-dim, lazy init
│   ├── vector/VectorStore.js — cosine similarity on DocumentChunks
│   ├── intelligence/InsightExtractor.js — sliding window extraction + validation
│   ├── intelligence/KnowledgeAggregator.js — merge/dedup, artifact normalization, ProjectState
│   ├── intelligence/StrategicSignalEngine.js — 4 signals, <10ms, no LLM
│   └── intelligence/ProjectInsightsAggregator.js — LEGACY flat aggregator
├── Stability:
│   ├── TokenManager.js — counting, trimming, 90% cap
│   ├── RateLimiter.js — 20/min user, 50/min project
│   ├── EncryptionService.js — AES-256-GCM
│   └── LLMGuardrails.js — validation, AbortController 30s, retry
├── Middleware: auth.js · errorHandler.js (8 custom classes) · validation.js
├── Models: User · Project · Discussion · Message · Document · DocumentChunk ·
│   Summary · Topic · Decision · Blocker · ActionItem · ProjectState ·
│   ProjectInsights (legacy) · Room (legacy)
└── Utils: logger.js · chunking.js (900/100) · normalizeText.js
```

---

## Intelligence Pipeline

This is the core of CollabAI. The principle: **messages update knowledge, they don't create it.**

### Extraction

Every 7 messages, `InsightExtractor` runs a sliding window (14 messages) through an LLM extraction call. The result is validated through 4 deterministic layers before anything reaches the database:

1. **Length** — minimum 15 characters
2. **Noise** — rejected against a known noise set (tbd, n/a, sounds good, etc.)
3. **Grounding** — key words must appear in the conversation window
4. **Commitment** — decisions must contain commitment language (use/will/adopt/decided/going with)

An overlap guard (80% threshold) prevents re-extracting windows already covered by existing artifacts.

### AI → Human Validation

Artifacts extracted from AI response windows are stored with `needsHumanValidation: true`. They are invisible on the dashboard until a human message references or builds on the same idea — at which point the flag is cleared and the artifact surfaces.

### Aggregation (KnowledgeAggregator)

For each validated artifact, the aggregator runs a 3-step merge pipeline:

```
Step 1: Substring containment check → merge into existing if contained
Step 2: Semantic similarity ≥ 0.80 cosine → merge into existing if matched
Step 3: No match → create new artifact
```

On merge: `supportingMessageIds` grows, `occurrenceCount` increments, canonical text is updated.
On create: artifact stored with `supportingMessageIds = windowMessageIds`, `occurrenceCount = 1`.

### Text Normalization

Before any artifact is written to the database, `_normalizeArtifactText` rewrites it into neutral engineering language:

- Strips conversational prefixes: `we'll`, `let's`, `I think we should`, `going with`, `we've decided to`, etc.
- Strips inline fillers: `just`, `basically`, `probably`, `actually`, etc.
- Capitalizes result

```
"We'll use residential proxies"      → "Use residential proxies"
"I think we should use Redis"        → "Use Redis for caching"
"We've decided to store raw HTML"    → "Store raw HTML in S3"
```

### Confidence-Based Gating

Each artifact type has its own validation rule — not a uniform frequency gate:

| Type | Rule |
|------|------|
| Topics | `status === 'stable'` (seen ≥ 3 times) — must stabilize through repetition |
| Decisions | High-confidence (commitment language validated at extraction) — surfaces immediately |
| Blockers | `occurrenceCount ≥ 2` OR `severity === 'high'` — strong single-instance blockers surface immediately |
| Actions | Valid actionable step (validated at extraction) — surfaces immediately |

Topics decay: if `lastSeenAt` > 30 days, status moves to `'parked'` and they leave the dashboard.

### ProjectState

After every aggregation pass, `_recomputeProjectState` rebuilds a `ProjectState` document containing:
- Stage inference (blocked / discussion / ideation)
- Momentum trend (rising / stable / falling, based on 7-day vs 14-day message counts)
- Open blocker count, unresolved action count, stable topic count
- `pinnedContext` — a ~100-token text summary of top decisions, blockers, topics, and actions, injected into every AI system prompt

---

## Data Flow

### Chat → AI Response
```
User: "@CollabAI question"
  → connectionManager: rate limit check → save message → broadcast
  → handleAIInvocation()
      → AIOrchestrator.handleRequest()
          → RateLimiter.checkLimits()
          → buildEntityAwareContext() or buildContext() (legacy fallback)
              → ProjectState (pinnedContext) + Decisions + Blockers + Topics + Actions
              → VectorStore semantic search (top 5 chunks) or positional fallback
              → last 3 summaries + last 30 messages
          → constructMessages() → TokenManager.countMessagesTokens()
          → LLMGuardrails.guardedCall() → callGroq() → Groq SDK
          → InsightExtractor.extractFromAIResponse() [non-blocking]
              → window of last 13 human messages (AI text excluded)
              → overlap guard check
              → LLM extraction → 4-layer validation
              → KnowledgeAggregator.mergeInsights(source='ai')
                  → decisions stored with needsHumanValidation=true
      → save AI message → broadcast
```

### User Message → Extraction
```
User sends any message (not @CollabAI)
  → connectionManager: save → broadcast
  → _triggerExtractionForMessage() [non-blocking]
      → skip if < 30 chars or starts with @CollabAI
      → InsightExtractor.extractFromMessage()
          → rate gate: every 7 messages
          → overlap guard: skip if window 80% covered
          → LLM extraction → 4-layer validation
          → KnowledgeAggregator.mergeInsights(source='user')
              → decisions: needsHumanValidation=false (surfaces immediately)
              → if matches existing needsHumanValidation=true → clears flag
              → _recomputeProjectState()
```

### Document Upload → Embeddings
```
POST /api/projects/:id/documents
  → Document.save() → return to client immediately
  → generateEmbeddingsForDocument() [async, non-blocking]
      → chunkText(900 chars, 100 overlap)
      → EmbeddingService.embedBatch() → 384-dim vectors
      → DocumentChunk.insertMany()
Next @CollabAI: VectorStore.count() > 0 → semantic retrieval active
```

### Dashboard Load
```
GET /api/projects/:id/dashboard (owner only)
  → ProjectState.exists() → entity model path or legacy fallback
  → buildEntityDashboard():
      → Topics (status=stable) · Decisions (needsHumanValidation≠true)
      → Blockers (occurrenceCount≥2 OR severity=high) · ActionItems
      → enrich with topicName, daysOpen, rationale
  → StrategicSignalEngine.generateSignals() [<10ms, no LLM]
  → shared metrics: activity[7], participants, discussionBreakdown, messageTypes
```

---

## Models

| Model | Key Fields |
|-------|-----------|
| User | username, email, password, authProvider, googleId, bio, theme |
| Project | title, problemStatement, ownerId, members, activeLLM, apiKeys, stage, inviteCode |
| Discussion | projectId, title, isMain, parentDiscussionId, participants, messageCount |
| Message | user, userId, text, discussionId, projectId, timestamp, isAI |
| Document | projectId, title, content, fileType, uploadedBy |
| DocumentChunk | projectId, documentId, chunkIndex, content, embedding[384] |
| Summary | projectId, discussionId, content, type, generatedBy |
| Topic | projectId, name, normalizedName, embedding, count, status (candidate/stable/parked), firstSeenAt, lastSeenAt |
| Decision | projectId, text, rationale, topicId, supportingMessageIds, occurrenceCount, needsHumanValidation, status |
| Blocker | projectId, text, severity, topicId, supportingMessageIds, occurrenceCount, resolved, raisedAt |
| ActionItem | projectId, text, status, topicId, supportingMessageIds, occurrenceCount |
| ProjectState | projectId, stage, momentum, openBlockerCount, unresolvedActionCount, activeTopicCount, pinnedContext, lastUpdated |

---

## Implementation Status

### Fully Implemented

| Feature | Notes |
|---------|-------|
| Authentication | JWT 7d, bcrypt, Google OAuth |
| Project Management | CRUD, invite codes, stage, API key per provider |
| Real-Time Messaging | WebSocket, heartbeat, reconnect, rate limit |
| Discussion System | Main + parallel, graph schema |
| AI Integration | @CollabAI, entity-aware context, Groq |
| Intelligence Pipeline | Sliding window, 4-layer validation, merge/dedup, normalization |
| AI → Human Validation | needsHumanValidation flag, cleared on human confirmation |
| Confidence-Based Gating | Per-type rules, no uniform frequency gate |
| Artifact Text Normalization | Conversational → imperative/declarative engineering language |
| Topic Lifecycle | candidate → stable → parked (30-day decay) |
| Local Embeddings | Xenova all-MiniLM-L6-v2, 384-dim, zero API cost |
| Semantic Search | VectorStore cosine similarity, positional fallback |
| Token Management | Counting, trimming, 90% safety cap |
| Rate Limiting | 20/min user, 50/min project |
| LLM Guardrails | Validation, 30s timeout, retry, error categorization |
| Strategic Signals | 4 types, deterministic, <10ms |
| Light/Dark Theme | ThemeContext, all components, persists to DB |
| Dashboard | Entity model + legacy fallback + LLM fallback |
| Document Upload | Async embedding generation |
| Summary Generation | Generate, refine, delete |
| Email Service | SendGrid: project invite, discussion invite, welcome |
| Google OAuth | Full flow (needs credentials) |
| Error Handling | 8 custom error classes, Mongoose conversion |
| Logging | Structured JSON, 4 levels, 4 specialized loggers |
| Swagger | OpenAPI 3.0 at /docs |
| Docker | Multi-service + MongoDB |

### Partially Implemented

| Feature | Works | Missing |
|---------|-------|---------|
| Multi-LLM | UI + Groq fully wired | OpenAI/Anthropic/Google/DeepSeek throw "coming soon" |
| API Key Encryption | AES-256-GCM service ready | Keys still plaintext in DB, no migration script |
| Discussion Graph | Backend schema + traversal | No frontend branching UI |

### Dead Code

| Item | Status |
|------|--------|
| StructuredExtractor.js | Never called |
| roomService.js / messageService.js / Room.js | Legacy, unused |

---

## Technical Debt

| Priority | Issue |
|----------|-------|
| 🔴 Critical | API keys stored plaintext in MongoDB |
| 🔴 Critical | No test suite |
| 🔴 Critical | No monitoring / observability |
| 🟡 High | No Redis caching (dashboard, embeddings) |
| 🟡 High | No message pagination |
| 🟡 High | Only Groq LLM works |
| 🟡 Medium | Dead code: StructuredExtractor, Room, roomService, messageService |
| 🟢 Low | No mobile responsive design |
| 🟢 Low | No discussion branching UI (backend ready) |

---

## Deployment

### Docker
```bash
docker-compose up --build
# MongoDB :27017, App :8080 (API + WS + static frontend + Swagger)
```

### Cloud (Render / Railway / Fly.io)
```bash
# Set build args for frontend
VITE_API_BASE_URL=https://your-domain.com
VITE_WS_BASE_URL=wss://your-domain.com
```

### Environment Variables
```env
# Required
MONGODB_URI=mongodb://...
JWT_SECRET=...
GROQ_API_KEY=...
ENCRYPTION_KEY=...        # openssl rand -hex 32

# Optional
SENDGRID_API_KEY=
FROM_EMAIL=noreply@collabai.com
FRONTEND_URL=https://your-domain.com
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
CORS_ORIGINS=https://your-domain.com
NODE_ENV=production
PORT=8080
RATE_LIMIT_USER_PER_MIN=20
RATE_LIMIT_PROJECT_PER_MIN=50
```
