# CollabAI Backend

Node.js/Express backend for CollabAI — a real-time collaborative workspace that builds and maintains engineering knowledge from team conversations.

## Stack

- **Node.js 20 / Express 5** — HTTP + WebSocket server
- **MongoDB 7** — primary data store
- **Groq API** — LLM inference (llama-3.1-8b-instant default)
- **Xenova all-MiniLM-L6-v2** — local 384-dim embeddings, no API cost
- **SendGrid** — email (optional)
- **Google OAuth** — optional

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
```

Required variables:
```env
MONGODB_URI=mongodb://localhost:27017/collab-ai
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
ENCRYPTION_KEY=64_char_hex   # openssl rand -hex 32
```

Optional:
```env
SENDGRID_API_KEY=
FROM_EMAIL=noreply@collabai.com
FRONTEND_URL=http://localhost:5173
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
PORT=8080
RATE_LIMIT_USER_PER_MIN=20
RATE_LIMIT_PROJECT_PER_MIN=50
```

### 3. Start
```bash
npm run dev    # development (nodemon)
npm start      # production
```

Server runs on `http://localhost:8080`
API docs at `http://localhost:8080/docs` (Swagger)

---

## API Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login |
| GET | `/api/auth/verify` | Verify JWT |
| POST | `/api/auth/google` | Google OAuth |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/projects` | Create project |
| GET | `/api/projects` | List user's projects |
| GET | `/api/projects/:id` | Get project |
| PATCH | `/api/projects/:id` | Update project (owner) |
| POST | `/api/projects/join` | Join via invite code |
| POST | `/api/projects/invite-preview` | Preview before joining |
| POST | `/api/projects/:id/invite-email` | Send invite email |
| PUT | `/api/projects/:id/llm` | Update LLM config |
| POST | `/api/projects/:id/api-key` | Save provider API key |

### Discussions
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/discussions` | List discussions |
| POST | `/api/projects/:id/discussions` | Create discussion |
| POST | `/api/projects/:id/discussions/:did/invite` | Invite member |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/documents` | List documents |
| POST | `/api/projects/:id/documents` | Upload document |

### Summaries
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/summaries` | List summaries |
| POST | `/api/projects/:id/discussions/:did/summarize` | Generate summary |
| PUT | `/api/projects/:id/discussions/:did/summaries/:sid` | Refine summary |
| DELETE | `/api/projects/:id/discussions/:did/summaries/:sid` | Delete summary |

### Dashboard
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects/:id/dashboard` | Dashboard data (owner only) |

### User
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/user/profile` | Get profile |
| PUT | `/api/user/profile` | Update profile |
| PUT | `/api/user/password` | Change password |
| GET | `/api/user/stats` | Get stats |

---

## WebSocket Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `auth` | `{ token }` | Authenticate |
| `join-project` | `{ projectId, discussionId }` | Join discussion |
| `project-chat` | `{ text }` | Send message |
| `ping` | — | Heartbeat |

### Server → Client
| Event | Description |
|-------|-------------|
| `auth-success` | Authentication confirmed |
| `discussion-joined` | Joined with message history |
| `project-chat` | New message (user or AI) |
| `ai-thinking` | AI is generating |
| `ai-error` | AI generation failed |
| `error` | General error |
| `pong` | Heartbeat response |

---

## Intelligence Pipeline

The backend extracts engineering knowledge from conversations incrementally.

### How it works

1. Every 7 messages, `InsightExtractor` runs a 14-message sliding window through the LLM
2. Extracted artifacts pass 4 deterministic validation layers (length, noise, grounding, commitment language)
3. `KnowledgeAggregator` merges each artifact into existing knowledge via substring + semantic similarity (≥ 0.80 cosine)
4. Text is normalized to neutral engineering language before storage
5. `ProjectState` is recomputed — stage, momentum, pinnedContext injected into every AI prompt

### Artifact types

| Type | Validation rule | Dashboard rule |
|------|----------------|----------------|
| Topic | Appears in conversation | `status === 'stable'` (seen ≥ 3×), decays after 30 days |
| Decision | Commitment language + system-level impact | Surfaces immediately (no frequency gate) |
| Blocker | Real constraint, not speculation | `occurrenceCount ≥ 2` OR `severity === 'high'` |
| Action | Concrete step with clear intent | Surfaces immediately |

### AI → Human validation

Decisions extracted from AI response windows are stored with `needsHumanValidation: true` and hidden from the dashboard. When a human message matches the same decision (substring or semantic), the flag is cleared and the decision surfaces.

---

## Project Structure

```
backend/src/
├── config/
│   ├── database.js          # MongoDB connection
│   ├── index.js             # Config + env vars
│   └── swagger.js           # OpenAPI spec
├── core/
│   ├── embeddings/
│   │   └── EmbeddingService.js    # Xenova, 384-dim, lazy init
│   ├── intelligence/
│   │   ├── InsightExtractor.js    # Sliding window extraction + validation
│   │   ├── KnowledgeAggregator.js # Merge, dedup, normalize, ProjectState
│   │   ├── ProjectInsightsAggregator.js  # Legacy flat aggregator
│   │   └── StrategicSignalEngine.js      # 4 signals, <10ms
│   ├── orchestrator/
│   │   └── AIOrchestrator.js      # Central hub, context builder
│   ├── stability/
│   │   ├── EncryptionService.js   # AES-256-GCM
│   │   ├── LLMGuardrails.js       # Validation, timeout, retry
│   │   ├── RateLimiter.js         # Per-user + per-project limits
│   │   └── TokenManager.js        # Token counting + trimming
│   └── vector/
│       └── VectorStore.js         # Cosine similarity on DocumentChunks
├── middleware/
│   ├── auth.js              # JWT verification
│   ├── errorHandler.js      # 8 custom error classes
│   └── validation.js        # Request validation
├── models/
│   ├── User.js · Project.js · Discussion.js · Message.js
│   ├── Document.js · DocumentChunk.js · Summary.js
│   ├── Topic.js · Decision.js · Blocker.js · ActionItem.js
│   ├── ProjectState.js · ProjectInsights.js (legacy)
│   └── Room.js (legacy, unused)
├── routes/
│   ├── auth.js
│   ├── projects.js
│   └── user.js
├── services/
│   ├── aiService.js · authService.js · projectService.js
│   ├── connectionManager.js · discussionService.js
│   ├── documentService.js · summaryService.js
│   ├── emailService.js · userService.js
│   └── messageService.js / roomService.js (legacy, unused)
├── utils/
│   ├── chunking.js          # 900-char chunks, 100-char overlap
│   ├── logger.js            # Structured logging, 4 specialized loggers
│   └── normalizeText.js     # Text normalization utilities
└── server.js
```

---

## Models

### Topic
```javascript
{
  projectId, name, normalizedName,
  embedding: [Number],        // 384-dim
  count: Number,              // times seen
  status: 'candidate' | 'stable' | 'parked',
  firstSeenAt, lastSeenAt,
  sourceDiscussionIds: [ObjectId]
}
```

### Decision
```javascript
{
  projectId, text, rationale,
  topicId, discussionId, messageId,
  supportingMessageIds: [ObjectId],
  occurrenceCount: Number,
  needsHumanValidation: Boolean,  // true = from AI, awaiting human confirmation
  status: 'active' | 'superseded' | 'reverted'
}
```

### Blocker
```javascript
{
  projectId, text,
  severity: 'low' | 'medium' | 'high',
  topicId, discussionId,
  supportingMessageIds: [ObjectId],
  occurrenceCount: Number,
  resolved: Boolean, resolvedAt, raisedAt
}
```

### ActionItem
```javascript
{
  projectId, text,
  status: 'open' | 'in-progress' | 'completed',
  topicId, blockerId, discussionId,
  supportingMessageIds: [ObjectId],
  occurrenceCount: Number
}
```

### ProjectState
```javascript
{
  projectId,
  stage: 'ideation' | 'discussion' | 'blocked',
  momentum: { trend: 'rising'|'stable'|'falling', recentMessageCount, previousMessageCount },
  openBlockerCount, unresolvedActionCount, activeTopicCount,
  lastDecisionAt,
  pinnedContext: String,   // ~100 tokens, injected into every AI system prompt
  lastUpdated
}
```

---

## Rate Limits

| Scope | Limit | Window |
|-------|-------|--------|
| Per user | 20 requests | 60 seconds |
| Per project | 50 requests | 60 seconds |
| WebSocket messages | 30 messages | 60 seconds |

Configurable via `RATE_LIMIT_USER_PER_MIN` and `RATE_LIMIT_PROJECT_PER_MIN`.

---

## Troubleshooting

**MongoDB connection failed**
- Verify `MONGODB_URI` in `.env`
- Check MongoDB is running: `mongod`

**AI not responding**
- Check `GROQ_API_KEY` is set and valid
- Check rate limits in logs

**Embeddings not generating**
- First run downloads the Xenova model (~25MB), may take a moment
- Check disk space

**WebSocket not connecting**
- Verify `CORS_ORIGINS` includes your frontend URL
- Check `JWT_SECRET` matches between auth and WS auth
