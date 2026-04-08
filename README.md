# CollabAI — Real-Time AI Collaborative Workspace

A real-time collaborative workspace where multiple users work together with a shared AI assistant. Teams collaborate in the same AI context, with semantic document retrieval, a persistent entity knowledge graph, and an intelligence dashboard.

## 🎯 Core Problem

Current AI platforms follow a single-user model. Teams brainstorm individually and manually merge ideas, leading to lost context, inconsistent AI outputs, and poor collective decision tracking. CollabAI gives every team member access to the **same AI with the same shared context**.

---

## 🚀 Quick Start

### Docker (Recommended)

```bash
docker-compose up --build
```

App at **http://localhost:5173** | API at **http://localhost:8080** | Swagger at **http://localhost:8080/docs**

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
npm run dev
```

---

## 🎨 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 7, WebSocket, Marked, DOMPurify, react-toastify, react-icons |
| Backend | Node.js 20, Express 5, ws (WebSocket) |
| Database | MongoDB 7 (Mongoose 8) |
| AI | Groq API — llama-3.1-8b-instant (default) |
| Embeddings | Xenova/all-MiniLM-L6-v2 — local, 384-dim, zero API cost |
| Auth | JWT (7-day expiry) + bcrypt (10 rounds) |
| Email | SendGrid (requires SENDGRID_API_KEY) |
| API Docs | Swagger UI at `/docs` |
| Deployment | Docker multi-service + docker-compose |

---

## ✅ Features

### Core Collaboration
- **Real-Time Chat** — WebSocket with 30s heartbeat, auto-reconnection, rate limiting (30 msg/min per client)
- **@CollabAI Mentions** — Invoke AI in any discussion
- **Parallel Discussions** — Multiple focused threads per project with participant management
- **Project Management** — Create/join via 8-char hex invite codes, owner/member roles
- **Document Upload** — `.txt` / `.md` files with async embedding generation (non-blocking)
- **AI Summaries** — Generate, refine, and persist discussion summaries with custom prompts
- **Invite System** — Share link, copy invite code, or send email via SendGrid

### AI Intelligence (8-Phase Architecture)
- **Semantic Search** — Local Xenova/all-MiniLM-L6-v2 embeddings, cosine similarity, top-5 chunk retrieval
- **Entity Knowledge Graph** — Topics, Decisions, Blockers, ActionItems extracted from every message (AI + user)
- **Conversation Window Extraction** — Extraction runs on a sliding window of 8 messages for better context
- **Deterministic Validation** — 4-layer post-extraction filter: length, noise, appears-in-conversation, commitment language
- **Semantic Dedup** — Cosine similarity dedup for all entity types (topics at 0.82, others at 0.90)
- **Persistent Project State** — ProjectState with stage, momentum, pinned context (~100 tokens), open counts
- **Pinned Context** — Pre-built project summary injected first into every AI prompt
- **Strategic Signals** — Decision drift, blocker stagnation, topic fragmentation, momentum drop
- **Token Management** — Conservative counting, context trimming, 90% safety cap
- **Rate Limiting** — Per-user (20 req/min) and per-project (50 req/min)
- **LLM Guardrails** — Validation, 30s timeout, single retry, error categorization
- **API Key Encryption** — AES-256-GCM via EncryptionService

### Dashboard (Owner Only)
- **Project Intelligence Card** — Stage, momentum trend (↑↓→), open blockers, pending actions, active topics
- **Decision Timeline** — Enriched decisions with topic name, rationale, timestamp (expandable)
- **Blocker Tracker** — Open blockers with severity badge, days open, topic name, color-coded border
- Health bar, topic distribution, activity chart, discussion breakdown, message distribution, contributors, strategic signals

### UI/UX
- **Light/Dark Theme** — Full theme system, per-user persistence in MongoDB
- **Model Selector** — Server (Groq), OpenAI, Anthropic, Google, DeepSeek, xAI with API key management
- **Profile Management** — Username, email, bio, password change, stats
- **Onboarding** — 4-step first-time flow
- **Google OAuth** — Full implementation (requires credentials)

---

## 📁 Project Structure

```
CollabAI/
├── backend/src/
│   ├── core/
│   │   ├── embeddings/EmbeddingService.js     # Xenova/all-MiniLM-L6-v2, lazy init
│   │   ├── intelligence/
│   │   │   ├── InsightExtractor.js            # Window-based extraction + 4-layer validation
│   │   │   ├── KnowledgeAggregator.js         # Entity upserts, semantic dedup, ProjectState
│   │   │   ├── ProjectInsightsAggregator.js   # Legacy (kept for migration safety)
│   │   │   └── StrategicSignalEngine.js       # 4 deterministic signals, <10ms
│   │   ├── orchestrator/AIOrchestrator.js     # Central AI hub, entity-aware context builder
│   │   ├── stability/                         # TokenManager, RateLimiter, EncryptionService, LLMGuardrails
│   │   └── vector/VectorStore.js              # Cosine similarity on MongoDB DocumentChunks
│   ├── models/
│   │   ├── Topic.js          # name, normalizedName, embedding[384], count, status
│   │   ├── Decision.js       # text, rationale, topicId, discussionId, messageId, resolvedBlockerIds[]
│   │   ├── Blocker.js        # text, severity, resolved, topicId, raisedAt
│   │   ├── ActionItem.js     # text, status, topicId, blockerId, assignee
│   │   ├── ProjectState.js   # stage, momentum, pinnedContext, openBlockerCount, etc.
│   │   └── ProjectInsights.js # Legacy flat model (preserved)
│   ├── scripts/
│   │   ├── migrate-knowledge-model.js      # ProjectInsights → entity collections
│   │   ├── reset-and-reextract.js          # Wipe + re-extract all projects with new pipeline
│   │   ├── rebuild-pinned-context.js       # Rebuild ProjectState.pinnedContext
│   │   ├── backfill-topic-embeddings.js    # Generate embeddings for migrated topics
│   │   ├── clean-noisy-entities.js         # Remove low-signal entities
│   │   ├── verify-knowledge-model.js       # Print entity counts + orphan decisions
│   │   └── test-idempotency.js             # Verify no duplicate entities on re-run
│   └── utils/normalizeText.js              # normalizeText() + normalizeTopicName()
├── frontend/src/components/
│   ├── ProjectIntelligenceCard.jsx   # Stage, momentum, counts
│   ├── DecisionTimeline.jsx          # Enriched decisions with rationale
│   └── BlockerTracker.jsx            # Open blockers with severity + daysOpen
```

---

## 🔑 API Reference

### Dashboard Response (entity model)
```json
{
  "source": "entity-model",
  "topics": [{ "name": "string", "count": 1 }],
  "decisions": ["string"],
  "openQuestions": ["string"],
  "actionItems": ["string"],
  "enrichedDecisions": [{ "text", "rationale", "topicName", "timestamp" }],
  "enrichedBlockers": [{ "text", "severity", "daysOpen", "topicName", "resolved" }],
  "enrichedActions": [{ "text", "status", "assignee", "topicName" }],
  "projectState": { "stage", "momentum", "openBlockerCount", "unresolvedActionCount", "activeTopicCount" },
  "signals": [], "activity": [], "participants": [], "discussionBreakdown": [], "messageTypes": {}
}
```

---

## 🤖 AI Context Building

### Entity-Aware (active when ProjectState exists)
```
1. ProjectState.pinnedContext  — ~100 token pre-built project summary
2. Active Decisions            — top 3, with rationale
3. Open Blockers               — sorted by severity
4. Active Topics               — top 6 by count
5. Relevant Documents          — top 5 chunks by cosine similarity
6. Pending Actions             — top 5 non-completed
7. Recent Summaries            — last 3 from current discussion
8. Recent Messages             — last 30 from current discussion
```

### Extraction Pipeline (per message)
```
New message arrives
→ Build window of last 8 messages from discussion
→ Concatenate as "Author: text" lines
→ Send to LLM (temp=0.1) for candidate extraction
→ Deterministic validation:
    Filter 1: minimum 15 chars
    Filter 2: not in noise set
    Filter 3: words appear in conversation window
    Filter 4: decisions must contain commitment language
→ KnowledgeAggregator:
    Semantic dedup (topics: 0.82, others: 0.90 cosine threshold)
    Upsert entities with topic linking
    Recompute ProjectState + pinnedContext
```

---

## 🗄️ Knowledge Graph Scripts

```bash
# After first deploy or major pipeline change:
node src/scripts/reset-and-reextract.js          # wipe + re-extract all projects
node src/scripts/verify-knowledge-model.js        # verify counts + orphan decisions

# One-time migration from ProjectInsights:
node src/scripts/migrate-knowledge-model.js
node src/scripts/backfill-topic-embeddings.js
node src/scripts/rebuild-pinned-context.js
node src/scripts/clean-noisy-entities.js
```

---

## ⚙️ Environment Variables

### Backend (`.env`)
```env
# Required
MONGODB_URI=mongodb://localhost:27017/collabai
JWT_SECRET=your-secret-key
GROQ_API_KEY=your-groq-api-key
ENCRYPTION_KEY=64-char-hex-string

# Optional
PORT=8080
NODE_ENV=development
CORS_ORIGINS=http://localhost:5173
SENDGRID_API_KEY=
FROM_EMAIL=noreply@collabai.com
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
RATE_LIMIT_USER_PER_MIN=20
RATE_LIMIT_PROJECT_PER_MIN=50
```

### Frontend (`.env`)
```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

---

## ⚠️ Known Limitations

| Area | Issue |
|------|-------|
| Multi-LLM | Only Groq works — others throw "coming soon" |
| API Keys | EncryptionService ready, keys still plaintext in DB |
| Decisions | `looksLikeDecision` filter requires commitment language — exploratory projects show 0 decisions until team makes explicit choices |
| Testing | No test suite |
| Monitoring | No Sentry, Prometheus, APM |
| Mobile | Desktop-first only |
| Caching | No Redis |

---

## 🔧 Required Before Public Launch

1. Migrate API keys to encrypted storage (EncryptionService already built)
2. Add production monitoring (Sentry + Prometheus)
3. Write comprehensive test suite
4. Complete multi-LLM integration
5. Add Redis caching for dashboard
6. Implement message pagination
7. Remove dead code (Room, roomService, messageService legacy, StructuredExtractor)

---

## 📄 License

MIT
