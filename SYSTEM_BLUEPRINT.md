# CollabAI — System Blueprint

> Generated 2026-04-13 by reading every source file in the codebase. Every statement is traceable to actual code.

---

## Section 1 — System Purpose

CollabAI is a web application that lets registered users create projects, organize conversations into parallel discussions within those projects, upload documents, invoke an AI assistant by prefixing messages with `@CollabAI`, and save specific messages as "decisions" into a per-project memory store. Messages, documents, and decisions are embedded into 384-dimensional vectors using a local `all-MiniLM-L6-v2` model. When the AI assistant is invoked, the system performs cosine-similarity search across those vectors to retrieve contextually relevant past messages, decisions, and document chunks, then assembles them into a layered system prompt sent to an LLM (default: Groq's Llama 3.1). The AI response is streamed token-by-token over WebSocket to all clients in the discussion.

**What the system does NOT do:**

- There is no file upload via multipart form — documents are submitted as raw text in POST body. The `upload()` method in the frontend `APIService` exists but the backend has no corresponding multipart endpoint.
- There is no real-time presence system — `User.isOnline` and `User.lastSeen` fields exist but are only updated on login/register. The `connectionManager` does not update these fields on WebSocket connect or disconnect. `userService.setUserOnline()` is never called from any route or WebSocket handler.
- There is no user search or user listing endpoint exposed via routes.
- There is no message deletion or editing.
- There is no discussion archival endpoint — the `status: 'archived'` enum exists on Discussion but no route sets it.
- There is no conflict detection between decisions.
- There is no memory tagging system (Decision/Question/Note/Action/Blocker) — only a single `Decision` type exists.
- The `Summary.embedding` field is never written. No code generates embeddings for summaries.
- The `Document.embedding` and `Document.chunks` inline fields are never written — only `DocumentChunk` collection is used.
- Streaming is only implemented for the `groq`/`server` providers. OpenAI, Anthropic, and Google fall back to a single-chunk non-streaming response.
- There is no password reset or email verification flow.
- The Swagger docs at `/docs` contain no route annotations — the `apis` glob points to `./src/routes/*.js` but none of those files contain JSDoc Swagger comments. The Swagger UI page loads but shows zero endpoints.
- The `features.aiStreaming` flag in frontend config is set to `false` despite streaming being fully implemented. This flag is never read by any code.
- `features.offlineMode` and `features.optimisticUpdates` flags are never read by any code.

---

## Section 2 — Technology Stack

### Backend (`backend/package.json`)

| Dependency | Version | Role |
|---|---|---|
| `express` | 5.1.0 | HTTP server framework. All routes are Express routers. |
| `ws` | 8.18.3 | WebSocket server. `WebSocketServer` is attached to the HTTP server in `connectionManager.js`. |
| `mongoose` | 8.19.3 | MongoDB ODM. All 10 data models are Mongoose schemas. |
| `groq-sdk` | 0.37.0 | Primary LLM provider client. Used in `AIOrchestrator.callGroq()` and `callGroqStreaming()`. |
| `openai` | 6.32.0 | OpenAI provider client. Used in `AIOrchestrator.callOpenAI()`. |
| `@anthropic-ai/sdk` | 0.80.0 | Anthropic provider client. Used in `AIOrchestrator.callAnthropic()`. |
| `@google/generative-ai` | 0.24.1 | Google Gemini provider client. Used in `AIOrchestrator.callGoogle()`. |
| `@xenova/transformers` | 2.17.2 | Local embedding model runtime. Loads `Xenova/all-MiniLM-L6-v2` via `pipeline('feature-extraction', ...)` in `EmbeddingService.js`. |
| `jsonwebtoken` | 9.0.3 | JWT token generation and verification in `authService.js`. |
| `bcrypt` | 6.0.0 | Password hashing in `authService.js` (`register()` uses `bcrypt.hash` with 10 rounds). |
| `bcryptjs` | 3.0.3 | **Redundant.** Used only in `routes/user.js` for the password change route. `authService.js` imports native `bcrypt`. Both are installed. |
| `cors` | 2.8.5 | CORS middleware. Origins configured via `config.corsOrigins`. |
| `dotenv` | 17.2.3 | Loads `.env` file in `config/index.js`. |
| `node-fetch` | 3.3.2 | **Imported but not used.** No file imports `node-fetch`. Node 22 has native `fetch`. |
| `nodemon` | 3.1.11 | Dev server auto-restart. Used in `npm run dev` script. |
| `swagger-jsdoc` | 6.2.8 | Generates OpenAPI spec from JSDoc annotations. Currently produces an empty spec because no routes have annotations. |
| `swagger-ui-express` | 5.0.1 | Serves Swagger UI at `/docs`. |

### Frontend (`frontend/package.json`)

| Dependency | Version | Role |
|---|---|---|
| `react` | 19.2.0 | UI framework. |
| `react-dom` | 19.2.0 | React DOM renderer. |
| `react-toastify` | 11.0.5 | Toast notifications. Used in `App.jsx` and `ProjectWorkspace.jsx`. |
| `react-icons` | 5.5.0 | Icon library. Used in `ProjectWorkspace.jsx`, `ProjectList.jsx`, `Sidebar.jsx`, `ModelSelector.jsx`. |
| `marked` | 17.0.0 | Markdown-to-HTML renderer. Used in `ProjectWorkspace.jsx` to render AI responses. |
| `dompurify` | 3.3.0 | HTML sanitizer. Applied after `marked` renders markdown to prevent XSS. |
| `vite` | 7.2.2 | Build tool and dev server. Runs on port 5173 in development. |

---

## Section 3 — System Architecture Overview

```
┌──────────────────────┐          ┌─────────────────────────────┐
│  React SPA (Vite)    │          │  Express + WebSocket Server │
│  Port 5173           │          │  Port 8080                  │
│                      │  HTTP    │                             │
│  - Auth forms        │ ─────── │  /api/auth/*                │
│  - Project list      │  REST   │  /api/projects/*            │
│  - Project workspace │         │  /api/user/*                │
│  - Document upload   │         │  /health                    │
│                      │  WS     │  /docs (Swagger)            │
│  - Chat messages     │ ═══════ │                             │
│  - AI streaming      │         │  connectionManager (ws)     │
└──────────────────────┘         └──────────┬──────────────────┘
                                            │
                          ┌─────────────────┼─────────────────┐
                          │                 │                 │
                          ▼                 ▼                 ▼
                    ┌──────────┐     ┌────────────┐    ┌────────────────┐
                    │ MongoDB  │     │ Groq API   │    │ Local Embedding│
                    │          │     │ (or other  │    │ all-MiniLM-L6  │
                    │ 10 colls │     │ LLM API)   │    │ @xenova/transf │
                    └──────────┘     └────────────┘    └────────────────┘
```

**Processes:** Two Node.js processes run in development — `backend` (Express+WS on port 8080) and `frontend` (Vite on port 5173). In production, the frontend is built as static files and served by the Express server.

**Request lifecycle (chat message):**
1. User types message in `ProjectWorkspace.jsx`
2. Frontend sends `{ type: 'project-chat', text: '...' }` over WebSocket
3. `connectionManager.handleProjectChat()` saves to `Message` collection via `discussionService.addMessage()`
4. Broadcasts `{ type: 'project-chat', message: {...} }` to all WebSocket clients whose `meta.discussionId` matches
5. Asynchronously calls `_embedMessage()` which embeds the text and saves to `MessageEmbedding` collection
6. If text starts with `@CollabAI`, triggers `handleAIInvocation()` which calls `AIOrchestrator.handleStreamingRequest()`

---

## Section 4 — Data Models

### 4.1 User (73 lines, `models/User.js`)

| Field | Type | Required | Default | Written By | Read By |
|---|---|---|---|---|---|
| `username` | String, trim, 1-20 chars | Yes | — | `authService.register()`, `authService.googleAuth()`, `routes/user.js PUT /profile` | Auth, profile, display in messages |
| `email` | String, sparse unique, lowercase | No | — | `authService.register()`, `authService.googleAuth()`, `routes/user.js PUT /profile` | Login lookup |
| `password` | String | No | — | `authService.register()`, `routes/user.js PUT /password` | Login verification |
| `authProvider` | Enum: `'local'`, `'google'` | No | `'local'` | `authService.register()`, `authService.googleAuth()` | Never read in any conditional logic |
| `googleId` | String, sparse unique | No | — | `authService.googleAuth()` | `authService.googleAuth()` lookup |
| `bio` | String, max 200 | No | `''` | `routes/user.js PUT /profile` | `routes/user.js GET /profile` |
| `theme` | Enum: `'dark'`, `'light'` | No | `'dark'` | `routes/user.js PUT /profile` | `ThemeContext.jsx` |
| `lastSeen` | Date | No | `Date.now` | `authService.login()`, `authService.googleAuth()` | `routes/user.js GET /stats` |
| `isOnline` | Boolean | No | `false` | `authService.login()`, `authService.register()`, `authService.googleAuth()` | **DEAD FIELD at runtime.** `userService.setUserOnline()` and `userService.cleanupOfflineUsers()` exist but are never called. `isOnline` is set `true` on login but never set `false` on disconnect. |
| `joinedRooms` | [String] | No | `[]` | **DEAD FIELD.** Never written by any code. | Never read. |
| `messageCount` | Number | No | `0` | **DEAD FIELD in current flow.** `userService.incrementMessageCount()` exists but is never called. `connectionManager.handleProjectChat()` does not call it. | `routes/user.js GET /stats` reads it, but it is always 0. |
| `projects` | [ObjectId → Project] | No | — | `projectService.createProject()`, `projectService.joinProject()` | `routes/user.js GET /stats` |

**Indexes:** `username` (unique), `email` (unique, sparse), `googleId` (unique, sparse), `lastSeen` (descending), `isOnline` (descending).

### 4.2 Project (67 lines, `models/Project.js`)

| Field | Type | Required | Default | Written By | Read By |
|---|---|---|---|---|---|
| `title` | String, trim | Yes | — | `projectService.createProject()` | Displayed in UI, used in email templates |
| `problemStatement` | String | Yes | — | `projectService.createProject()` | `AIOrchestrator.buildProjectContext()` as `project.description` |
| `ownerId` | ObjectId → User | Yes | — | `projectService.createProject()` | Authorization checks |
| `members` | Array of `{ userId, role, joinedAt }` | No | — | `projectService.createProject()`, `projectService.joinProject()` | Membership checks |
| `activeLLM` | `{ provider, model, apiKey }` | No | `{ provider: 'server', model: 'llama-3.1-8b-instant' }` | `projectService.updateProject()`, `routes/projects.js PUT /:id/llm` | `connectionManager.handleAIInvocation()`, `AIOrchestrator.selectModel()` |
| `apiKeys` | Map<String, String> | No | `{}` | `projectService.setProjectApiKey()` | `AIOrchestrator.getApiKey()` — but **only reads via `.apiKeys?.[provider]`** which returns undefined for Map objects. This is a bug: `projectService.getProjectById()` returns `.lean()` which converts Map to plain object, but `getApiKey()` uses findById without `.lean()`, so `.get()` would work — however the code uses bracket notation, not `.get()`. |
| `stage` | Enum: ideation/design/discussion/blocked/completed | No | `'ideation'` | `routes/projects.js PATCH /:id/stage` | Displayed in UI |
| `inviteCode` | String, unique sparse | No | — | `projectService.createProject()` — generated as `crypto.randomBytes(4).toString('hex')` (8 hex chars) | Join flow, email invites |

**Indexes:** `ownerId`, `members.userId`, `inviteCode` (unique, sparse).

**Note on `activeLLM.provider` enum:** The schema allows `'server'` as a provider value. `LLMGuardrails.supportedProviders` includes `'server'`. `AIOrchestrator.selectModel()` maps `{ provider: 'server', model: 'server' }` to `{ provider: 'server', model: 'llama-3.1-8b-instant' }`. `AIOrchestrator.callProvider()` treats `'server'` identically to `'groq'` — both call `callGroq()` with the Groq API key from env vars.

### 4.3 Discussion (88 lines, `models/Discussion.js`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `projectId` | ObjectId → Project | — | Required |
| `title` | String, trim | — | Required |
| `description` | String | `''` | |
| `isMain` | Boolean | `false` | Exactly one per project, created by `projectService.createProject()` |
| `parentDiscussionId` | ObjectId → Discussion | `null` | For branching. Set in `discussionService.createDiscussion()` |
| `branchDepth` | Number | `0` | Calculated from parent's branchDepth + 1 |
| `participants` | [ObjectId → User] | — | Added on creation and via `joinDiscussion()` |
| `creatorId` | ObjectId → User | — | |
| `lastActivity` | Date | `Date.now` | Updated by `discussionService.addMessage()` |
| `messageCount` | Number | `0` | Incremented by `discussionService.addMessage()` via `$inc` |
| `status` | Enum: active/archived | `'active'` | **No route ever sets this to 'archived'.** |

**Indexes:** `{ projectId, status }`, `{ parentDiscussionId }`, `{ lastActivity: -1 }`.

**Instance methods:** `getLineage()` walks up parent chain, returns array of IDs root-to-current. `getChildren()` finds active children. **Neither method is called by any code in the codebase.**

### 4.4 Message (52 lines, `models/Message.js`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `user` | String, trim | — | Required. Display name string, not a reference. For AI messages, this is `'CollabAI'`. For error messages, this is `'System'`. |
| `userId` | ObjectId → User | — | Not required. Set for human messages. `null` for AI and System messages. |
| `text` | String | — | Required |
| `roomId` | String | `'general'` | **DEAD FIELD.** Legacy from before project/discussion structure. `connectionManager` never reads or writes it. `messageService` reads it but `messageService` is never called by any active route or WebSocket handler. |
| `discussionId` | ObjectId → Discussion | — | Not required in schema but always set by `discussionService.addMessage()` |
| `projectId` | ObjectId → Project | — | Not required in schema but always set by `discussionService.addMessage()` |
| `timestamp` | Number | `Date.now` | Set explicitly to `Date.now()` in `discussionService.addMessage()` |
| `isAI` | Boolean | `false` | `true` for CollabAI responses |

**Indexes:** `{ roomId, timestamp: -1 }` (dead), `{ roomId, createdAt: -1 }` (dead), `{ discussionId, timestamp: 1 }` (active), `{ projectId, createdAt: -1 }` (active).

### 4.5 Decision (39 lines, `models/Decision.js`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `projectId` | ObjectId → Project | — | Required |
| `text` | String | — | Required. Initially raw message text, then overwritten by LLM normalization in background. |
| `rationale` | String | `''` | Set by LLM normalization. |
| `proposedBy` | `{ userId: ObjectId, username: String }` | — | |
| `sourceMessageId` | ObjectId → Message | — | |
| `discussionId` | ObjectId → Discussion | — | |
| `embedding` | [Number] | `undefined` (sparse) | 384-dim vector. Written by decision creation background task or `EmbeddingWorker`. |
| `embeddingStatus` | Enum: pending/done/failed | `'pending'` | |
| `timestamp` | Number | `Date.now` | |

**Indexes:** `{ projectId, timestamp: -1 }`, `{ projectId, embeddingStatus }`.

### 4.6 ProjectState — DELETED

> This model has been deleted. It previously held a `pinnedContext` string field that was a monolithic concatenation of all decisions. Replaced by semantic decision retrieval via `VectorStore.searchDecisions()`. The `projectstates` MongoDB collection can be dropped via the migration script.

### 4.7 Summary (49 lines, `models/Summary.js`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `projectId` | ObjectId → Project | — | Required |
| `discussionId` | ObjectId → Discussion | — | Required |
| `content` | String | — | Required. LLM-generated summary text. |
| `type` | Enum: discussion/decision/blocker/insight | `'discussion'` | Only `'discussion'` is ever written. |
| `generatedBy` | String | `'server'` | Set to `project.activeLLM.provider` in summarize route. |
| `messageRange` | `{ start: Date, end: Date }` | — | Both always set to `new Date()` in `summaryService.createSummary()`. **Misleading** — does not reflect actual message time range. |
| `embedding` | [Number] | `null` | **DEAD FIELD.** Never written by any code. |
| `messageCountAtSummary` | Number | `0` | Captures `discussion.messageCount` at summary time. Used for stale-detection in frontend. |

**Indexes:** `{ projectId, createdAt: -1 }`, `{ discussionId }`.

### 4.8 Document (44 lines, `models/Document.js`)

| Field | Type | Default | Notes |
|---|---|---|---|
| `projectId` | ObjectId → Project | — | Required |
| `title` | String, trim | — | Required |
| `content` | String | — | Required |
| `fileType` | Enum: text/pdf | `'text'` | |
| `uploadedBy` | ObjectId → User | — | Required |
| `embedding` | [Number] | `null` | **DEAD FIELD.** Never written. |
| `chunks` | `[{ text, embedding }]` | — | **DEAD FIELD.** Never written. `DocumentChunk` collection is used instead. |

### 4.9 DocumentChunk (50 lines, `models/DocumentChunk.js`)

| Field | Type | Notes |
|---|---|---|
| `projectId` | ObjectId → Project | Required |
| `documentId` | ObjectId → Document | Required |
| `chunkIndex` | Number | Required. Sequential index within document. |
| `content` | String | Required. Chunk text. |
| `embedding` | [Number] | Required. Validated: must be exactly 384 numbers. |
| `metadata` | `{ title, documentTitle }` | Both set to `document.title`. |

**Indexes:** `{ projectId, documentId }`, `{ projectId, chunkIndex }`.

### 4.10 MessageEmbedding (40 lines, `models/MessageEmbedding.js`)

| Field | Type | Notes |
|---|---|---|
| `projectId` | ObjectId → Project | Required |
| `discussionId` | ObjectId → Discussion | Required |
| `messageId` | ObjectId → Message | Required, **unique** |
| `content` | String | Required. Copy of message text. |
| `embedding` | [Number] | Required. Validated: must be exactly 384 dimensions. |
| `userId` | ObjectId → User | Optional |
| `username` | String | Optional |
| `timestamp` | Number | Default: `Date.now` |

**Indexes:** `{ projectId }`.

### 4.11 ProjectBrief (21 lines, `models/ProjectBrief.js`)

| Field | Type | Notes |
|---|---|---|
| `projectId` | ObjectId → Project | Required, **unique** |
| `content` | String | Required. The LLM-generated brief content. |
| `generatedAt` | Date | Default: `Date.now` |

**Indexes:** `{ projectId }` (unique).

---

## Section 5 — API Reference

### Auth Routes (`/api/auth`) — No JWT required

#### POST `/api/auth/register`
- **Validation middleware:** `validate('register')` — requires `username` (string 2-50), `email` (valid email), `password` (string 6-100)
- **Execution:** Checks duplicates by email OR username → hashes password with bcrypt (10 rounds) → creates User → generates JWT → sends welcome email (non-blocking, swallowed on failure)
- **Success:** `{ success: true, user: {...}, token: 'jwt...' }`
- **Failures:** 400 if user exists (Mongoose pre-check). 500 on DB error.
- **Side effects:** Welcome email sent via SendGrid if `SENDGRID_API_KEY` is set.

#### POST `/api/auth/login`
- **Validation middleware:** `validate('login')` — requires `email` (valid email), `password` (string)
- **Execution:** Finds user by lowercase email → compares bcrypt password → sets `isOnline: true`, `lastSeen: Date.now()` → generates JWT
- **Success:** `{ success: true, user: {...}, token: 'jwt...' }`
- **Failures:** Throws `'Invalid credentials'` if user not found or password wrong. No differentiation between unknown email and wrong password.

#### GET `/api/auth/verify`
- **Execution:** Reads `Authorization: Bearer <token>` header → verifies JWT → looks up user by `decoded.userId`
- **Success:** `{ success: true, user: {...} }`
- **Failures:** 401 `AuthenticationError` if no token, invalid token, or user not found.

#### GET `/api/auth/google`
- **Execution:** Redirects to Google OAuth consent screen. Requires `GOOGLE_CLIENT_ID` env var.
- **Failure:** 500 if `GOOGLE_CLIENT_ID` not set.

#### GET `/api/auth/google/callback`
- **Execution:** Exchanges auth code for access token → fetches user info from Google → creates or finds user → redirects to `FRONTEND_URL?token=JWT&provider=google`

#### POST `/api/auth/google`
- **Execution:** Accepts `idToken` (verified via Google tokeninfo endpoint) or direct `{ googleId, email, username }` → creates or finds user → returns JWT

### User Routes (`/api/user`) — All require JWT

#### GET `/api/user/profile`
- **Execution:** `User.findById(req.user.userId).select('-password')`
- **Success:** `{ success: true, user: {...} }`

#### PUT `/api/user/profile`
- **Body:** `{ username?, email?, bio?, theme? }`
- **Execution:** Checks uniqueness of new username/email against other users → updates fields → saves
- **Failures:** 400 if username or email taken by another user

#### PUT `/api/user/password`
- **Body:** `{ currentPassword, newPassword }`
- **Execution:** Verifies current password → hashes new password with bcryptjs (10 rounds) → saves
- **Note:** Uses `bcryptjs` (the JS implementation), not `bcrypt` (the native one). This is the only code path that uses `bcryptjs`.
- **Failures:** 400 if missing fields, newPassword < 6 chars, OAuth account, or wrong current password

#### GET `/api/user/stats`
- **Execution:** Finds user, populates `projects`, returns `{ projectCount, messageCount, joinedAt, lastSeen }`
- **Note:** `messageCount` is always 0 because nothing increments it.

### Project Routes (`/api/projects`) — All require JWT

#### POST `/` — Create project
- **Body:** `{ title, problemStatement }`
- **Execution:** Creates Project with `inviteCode` (8 hex chars) → creates main Discussion → adds project to User.projects
- **Success:** `{ success: true, project }`

#### GET `/` — List user's projects
- **Execution:** `Project.find({ 'members.userId': userId })` with owner and member population, sorted by `updatedAt` descending

#### GET `/:projectId` — Get project
- **Auth:** Checks `projectService.isProjectMember()`
- **Success:** `{ success: true, project }`

#### POST `/join` — Join project
- **Body:** `{ inviteCode, discussionId? }`
- **Execution:** Finds project by inviteCode → adds member if not already → adds to main discussion → if `discussionId` provided, also joins that discussion
- **Note:** Does NOT use `validate('joinProject')` middleware despite the schema existing

#### POST `/invite-preview` — Preview invite
- **Body:** `{ inviteCode, discussionId? }`
- **Execution:** Finds project by inviteCode → checks membership → optionally loads discussion info
- **Success:** `{ success: true, project: { id, title, memberCount }, isMember, discussion }`

#### POST `/:projectId/invite-email` — Send email invite
- **Body:** `{ email }`
- **Auth:** Must be project member
- **Side effect:** Sends email via SendGrid with project invite link

#### PATCH `/:projectId/stage` — Update stage
- **Auth:** Owner only
- **Body:** `{ stage }`

#### PATCH `/:projectId` — Update project
- **Auth:** Owner only
- **Body:** `{ activeLLM?, stage? }`

#### PUT `/:projectId/llm` — Update LLM config
- **Auth:** Owner only
- **Body:** `{ activeLLM: { provider, model } }`
- **Note:** Does NOT use `validate('updateLLM')` middleware despite the schema existing

#### POST `/:projectId/api-key` — Save provider API key
- **Auth:** Owner only
- **Body:** `{ provider, apiKey }`
- **Note:** Stores API key **in plaintext** via `projectService.setProjectApiKey()`. Despite `EncryptionService` existing, this route does not call `encrypt()`.

#### GET `/:projectId/discussions` — List discussions
- **Execution:** Gets all active discussions → for each non-main discussion, attaches `latestSummary` metadata (`_id`, `createdAt`, `messageCountAtSummary`)
- **Note:** This is an N+1 query — one DB query per non-main discussion to fetch latest summary.

#### POST `/:projectId/discussions` — Create discussion
- **Body:** `{ name, description }`
- **Note:** Body field is `name` not `title`. Does NOT use `validate('createDiscussion')` middleware.
- **Execution:** Creates Discussion with `isMain: false`, adds creator + project owner as participants

#### POST `/:projectId/discussions/:discussionId/invite` — Invite to discussion
- **Body:** `{ userId }`
- **Auth:** Must be owner OR discussion participant
- **Execution:** Checks invitee is project member → calls `discussionService.joinDiscussion()`

#### POST `/:projectId/discussions/:discussionId/invite-email` — Email discussion invite
- **Body:** `{ email, discussionTitle? }`
- **Side effect:** Sends email with discussion invite link including `?discussion=<id>` param

#### GET `/:projectId/documents` — List documents
- **Execution:** Gets documents with chunk count appended. Returns `chunks` as array of nulls (for length only).

#### GET `/:projectId/documents/:documentId/chunks` — Get document chunks
- **Execution:** Returns chunks with truncated embedding previews (first 5 values)

#### POST `/:projectId/documents` — Upload document
- **Body:** `{ title, content, fileType? }`
- **Note:** `fileType` is normalized: anything containing `'pdf'` → `'pdf'`, else `'text'`. No actual PDF parsing exists.
- **Execution:** Saves Document → asynchronously chunks text (900 chars, 100 overlap) and generates embeddings
- **Side effect:** Creates `DocumentChunk` records with embeddings in background

#### GET `/:projectId/summaries` — List project summaries
- **Execution:** `summaryService.getProjectSummaries(projectId)` — last 10 summaries

#### POST `/:projectId/discussions/:discussionId/summarize` — Generate summary
- **Auth:** Must be member. Cannot summarize main discussion.
- **Execution:** Gets last 50 messages → sends to LLM → saves Summary with current messageCount
- **Success:** `{ success: true, summary }`

#### PUT `/:projectId/discussions/:discussionId/summaries/:summaryId` — Regenerate summary
- **Body:** `{ customPrompt }` (required)
- **Execution:** Gets existing summary + last 50 messages → sends to LLM with refinement prompt → updates summary content

#### DELETE `/:projectId/discussions/:discussionId/summaries/:summaryId` — Delete summary

#### POST `/:projectId/decisions` — Add message to memory
- **Body:** `{ messageId, discussionId }`
- **Execution:** Finds Message → creates Decision with raw text → responds immediately → background: LLM normalizes text → background: embeds normalized text
- **Background LLM prompt:** Instructs LLM to return JSON `{"text": "...", "rationale": "..."}` — max 15 words, no first person, starts with verb/technology.
- **Background failure handling:** If LLM normalization fails, decision keeps raw text. If embedding fails, `embeddingStatus` set to `'failed'` → `EmbeddingWorker` retries later.

#### GET `/:projectId/decisions` — List decisions
- **Execution:** `Decision.find({ projectId }).sort({ timestamp: -1 })`

#### GET `/:projectId/brief` — Get Project Brief
- **Auth:** Must be project member.
- **Execution:** `briefService.getOrGenerateBrief(projectId)`. Returns existing brief if generated within the last 24 hours. Otherwise, automatically regenerates it.
- **Failures:** If generation fails but a stale brief exists, returns the stale brief with `isOutdatedFallback: true`.

#### POST `/:projectId/brief/generate` — Force Generate Brief
- **Auth:** Must be project member.
- **Execution:** `briefService.generateBrief(projectId)`. Forces a regeneration regardless of cache age.

### WebSocket Events

#### Client → Server

| Event | Payload | Trigger | Handler |
|---|---|---|---|
| `auth` | `{ token: string }` | On connection open | `handleAuth()` — verifies JWT, stores userId/username in client metadata |
| `join-project` | `{ projectId: string, discussionId: string }` | After auth success | `handleJoinProject()` — verifies membership, loads last 50 messages, sends `discussion-joined` |
| `project-chat` | `{ text: string }` | User sends message | `handleProjectChat()` — saves message, broadcasts, embeds, checks for @CollabAI |
| `ping` | `{}` | Heartbeat | Responds with `{ type: 'pong', timestamp }` |

#### Server → Client

| Event | Payload | When |
|---|---|---|
| `auth-success` | `{ user: { userId, username } }` | JWT verified successfully |
| `auth-error` | `{ message: string }` | JWT verification failed |
| `discussion-joined` | `{ messages: [...], discussionId }` | After join-project. Messages formatted as `{ _id, user, text, time, isAI }` |
| `project-chat` | `{ message: { _id, user, text, time, isAI } }` | New message in discussion (human or error) |
| `ai-stream-start` | `{}` | AI invocation begins |
| `ai-stream-chunk` | `{ chunk: string }` | Each token from streaming LLM response |
| `ai-stream-end` | `{ message: { _id, user, text, time, isAI: true } }` | Streaming complete, final message saved |
| `ai-error` | `{ message: string }` | AI generation failed |
| `error` | `{ message: string }` | General WebSocket error |
| `pong` | `{ timestamp: number }` | Response to client ping |
| `server-shutdown` | `{ message: string }` | Server shutting down |

---

## Section 6 — Complete Data Flow Simulations

### 6.1 User Sends Chat Message

1. `ProjectWorkspace.jsx` calls `ws.send(JSON.stringify({ type: 'project-chat', text }))` on the native WebSocket
2. `connectionManager.handleMessage()` receives raw buffer → `JSON.parse()` → routes to `handleProjectChat()`
3. `handleProjectChat()` reads `meta.projectId`, `meta.discussionId`, `meta.userId`, `meta.username` from client metadata
4. If `!projectId || !discussionId` → sends error `'Not in a project discussion'` and returns
5. Calls `discussionService.addMessage(discussionId, projectId, userId, username, text, false)`
6. `addMessage()` creates `new Message(...)` with `timestamp: Date.now()` → `message.save()` → updates Discussion `lastActivity` and `$inc: { messageCount: 1 }`
7. `broadcastToDiscussion(discussionId, { type: 'project-chat', message: { _id, user, text, time, isAI: false } })` — iterates all clients, sends to those with matching `meta.discussionId` and `readyState === 1`
8. `_embedMessage(message, projectId, discussionId)` called with `.catch(err => logger.warn(...))`:
   - Skips if `text.length < 20`, starts with `@CollabAI`, or `isAI === true`
   - Dynamic imports `EmbeddingService` and `MessageEmbedding`
   - Calls `EmbeddingService.embedText(message.text)` — initializes model on first call (downloads ~90MB model), generates 384-dim vector
   - Creates `MessageEmbedding` record
   - On failure: logs warning, no retry in this path (EmbeddingWorker handles retries)
9. If `text.startsWith('@CollabAI')`: calls `handleAIInvocation()` — **re-declares `const meta = this.clients.get(ws)` shadowing outer `meta`** (not a bug, same value)

### 6.2 AI Invocation (Streaming)

1. `handleAIInvocation(ws, text, projectId, discussionId, userId)` removes `@CollabAI` prefix
2. Fetches project via `projectService.getProjectById(projectId)` to get `activeLLM` config
3. Broadcasts `{ type: 'ai-stream-start' }` to discussion
4. Calls `AIOrchestrator.handleStreamingRequest({ projectId, discussionId, prompt, llmConfig, userId }, onChunk)`
5. `_prepareRequest()`:
   a. Checks if `isCatchMeUp` via regex (`/catch me up|what's the current state|.../i`)
   b. Calls `buildProjectContext()`:
      - Parallel: `getProjectById`, `getDiscussionById`, `getProjectDiscussions`, `getDiscussionSummaries(discussionId, 3)`, `getDiscussionMessages(discussionId, 30)`
      - If prompt exists: embeds prompt → `VectorStore.searchMessages` using **hybrid search** (filters by `discussionId` first, then computes cosine similarity, falling back cross-thread if needed) → `VectorStore.searchDecisions` → `VectorStore.search` (document chunks).
      - **Decision Pinning:** Retrieves decisions via semantic similarity, then checks if any decision has a cosine similarity > 0.85 against the user's query. If yes, it is pinned (guaranteed to appear in context without competing for space).
      - If `relevantDecisions.length === 0` (no embedded decisions): fallback loads `Decision.find({ projectId }).sort({ timestamp: -1 }).limit(15).lean()`
      - For each non-current discussion: loads 1 summary
   c. Calls `buildSystemPrompt(context)` — builds multi-layered prompt string
   d. Calls `constructMessages()` — `[{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: prompt }]`
   e. Calls `TokenManager.trimContext()` — if tokens exceed 90% of model's context window (7200 for llama-3.1), trims oldest user/assistant messages, keeps system prompt and last user message
6. Gets API key via `getApiKey('server', projectId)` → reads `GROQ_API_KEY` or `CHATBOT_API_KEY` → passes through `EncryptionService.decryptForUse()` — if not encrypted format, returns as-is
7. Calls `callGroqStreaming({ model, messages, maxTokens: 1024, apiKey }, onChunk)`
8. Each chunk: `onChunk(delta)` → `broadcastToDiscussion(discussionId, { type: 'ai-stream-chunk', chunk: delta })`
9. Full response accumulated → saves as Message via `discussionService.addMessage(discussionId, projectId, null, 'CollabAI', fullResponse, true)` — note `userId: null` for AI messages
10. Broadcasts `{ type: 'ai-stream-end', message: { _id, user, text, time, isAI: true } }`
11. On error: saves error as System message, broadcasts both `project-chat` (error text) and `ai-error` events

**Note:** The streaming call does NOT go through `LLMGuardrails.guardedCall()`. Only the non-streaming `callProvider()` uses guardrails. This means streaming calls have no timeout protection, no retry logic, and no request validation.

### 6.3 Decision Capture

1. Frontend POSTs to `/api/projects/:projectId/decisions` with `{ messageId, discussionId }`
2. Route handler verifies membership → finds Message by ID → creates Decision with `text: message.text`, `embeddingStatus: 'pending'`
3. Responds `{ success: true, decision }` immediately
4. Background IIFE:
   a. Imports AIOrchestrator, gets project
   b. Calls `AIOrchestrator.callProvider()` with normalization prompt — this DOES go through `LLMGuardrails.guardedCall()` (validated, timeout, retry)
   c. Parses JSON response, updates Decision with normalized `text` and `rationale`
   d. On LLM failure: logs warning, decision keeps raw text
   e. Imports EmbeddingService, reads updated decision
   f. Embeds `text + '. ' + rationale` → updates Decision with `embedding` and `embeddingStatus: 'done'`
   g. On embed failure: sets `embeddingStatus: 'failed'`

### 6.4 Document Upload

1. Frontend POSTs to `/api/projects/:projectId/documents` with `{ title, content, fileType? }`
2. Route normalizes `fileType` → calls `documentService.uploadDocument()`
3. `uploadDocument()` creates Document → saves → returns immediately
4. Background: `generateEmbeddingsForDocument(document)`:
   a. `chunkText(content, 900, 100)` — splits at sentence boundaries with 100-char overlap
   b. `EmbeddingService.embedBatch(chunks)` — embeds each chunk sequentially
   c. `DocumentChunk.insertMany(chunkDocuments)` — saves all chunks with embeddings
   d. On failure: logs error, does not throw — document exists but has no searchable chunks

### 6.5 Summary Generation

1. Frontend POSTs to `/api/projects/:projectId/discussions/:discussionId/summarize`
2. Route verifies: member, discussion exists, discussion is NOT main
3. Gets last 50 messages → formats as `username: text\n` → sends prompt to LLM via `aiService.generateSummary()` → `AIOrchestrator.handleSummaryRequest()`
4. `handleSummaryRequest()` calls `callProvider()` with `temperature: 0.5`, `maxTokens: 512`, system prompt `'You summarize team discussions.'`
5. Saves Summary with `messageCountAtSummary: discussion.messageCount`

### 6.6 User Registration

1. Frontend sends POST to `/api/auth/register` with `{ username, email, password }`
2. `validate('register')` middleware checks types and lengths
3. `authService.register()`: checks if user exists by email OR username → hashes password (bcrypt, 10 rounds) → creates User → generates JWT `{ userId, username, email }` with 7-day expiry
4. Welcome email sent via `emailService.sendWelcomeEmail()` — non-blocking `.catch()`
5. Returns `{ success: true, user: {...}, token: 'jwt...' }`
6. Frontend stores token in `localStorage` key `collab-ai-token`

### 6.7 Project Creation

1. Frontend POSTs `{ title, problemStatement }`
2. `projectService.createProject()`:
   - Generates `inviteCode` = `crypto.randomBytes(4).toString('hex')` (8 hex chars)
   - Creates Project with `activeLLM: { provider: 'server', model: 'llama-3.1-8b-instant' }`
   - Creates Discussion `{ title: 'Main Discussion', isMain: true, participants: [ownerId] }`
   - Adds project ID to `User.projects` array

### 6.8 Project Brief Generation

1. Triggered via `GET /api/projects/:projectId/brief` (if stale >24h) or `POST /brief/generate`.
2. `briefService.generateBrief()` collects: All project decisions, the last 10 summaries, and the last 30 messages from the Main Discussion.
3. Assembles a large context string and applies a strict system prompt to enforce exactly five Markdown sections (What We Are Building, Stack and Architecture, Current Focus, Key People, Open Questions).
4. Calls `AIOrchestrator.callProvider()` with `maxTokens: 2000`.
5. Saves to the `ProjectBrief` collection with `generatedAt: new Date()` and returns it to the client.

---

## Section 7 — Background Processing

### 7.1 EmbeddingWorker (`services/EmbeddingWorker.js`)

- **Start:** Called by `server.js` after server starts: `embeddingWorker.start()`
- **First run:** 10 seconds after `start()` via `setTimeout()`
- **Interval:** Then every 60,000ms (1 minute) via `setInterval`
- **Guard:** If previous run is still executing (`isRunning === true`), the interval tick is skipped
- **Stop:** Called on `SIGTERM` in server.js: `embeddingWorker.stop()` → `clearInterval()`

**Message backfill (`backfillMessages()`):**
1. Dynamic imports `Message`, `MessageEmbedding`, `EmbeddingService`
2. Gets all `messageId` values from `MessageEmbedding` via `MessageEmbedding.distinct('messageId')`
3. Queries `Message.find({ isAI: { $ne: true }, text: { $exists: true } }).sort({ timestamp: -1 }).limit(100)`
4. Filters: text ≥ 20 chars, doesn't start with `@CollabAI`, not already in embeddedIdSet
5. For each: embeds text → creates `MessageEmbedding` record
6. On duplicate key error (code 11000): silently skips (race with live embedding)

**Decision backfill (`backfillDecisions()`):**
1. Dynamic imports `Decision`, `EmbeddingService`
2. Queries `Decision.find({ embeddingStatus: { $in: ['pending', 'failed'] } }).sort({ timestamp: -1 }).limit(50)`
3. For each: embeds `text + '. ' + rationale` → updates Decision with embedding and `embeddingStatus: 'done'`
4. On failure: logs warning, does NOT set `embeddingStatus: 'failed'` — leaves current status so next run retries

**Stats:** Exposed via `/health` endpoint as `services.embeddingWorker: { messagesBackfilled, decisionsBackfilled, failures, lastRunAt, isRunning }`

### 7.2 WebSocket Heartbeat

- **Interval:** Every `config.wsHeartbeatInterval` ms (default 30,000ms from env `WS_HEARTBEAT_INTERVAL`)
- **Mechanism:** Server sends `ws.ping()` to each client → expects `pong` event back → sets `meta.isAlive = true`
- **Dead connection detection:** On each heartbeat tick, if `meta.isAlive === false`, terminates connection. Then sets `meta.isAlive = false` for next cycle.
- **Started in:** `connectionManager.initialize()` → `startHeartbeat()`

### 7.3 Rate Limiter Cleanup

- **Interval:** Every 5 minutes via `setInterval` in `RateLimiter` constructor
- **Mechanism:** Iterates `userLimits` and `projectLimits` Maps, deletes entries where `now >= limit.resetTime + windowMs`
- **Note:** Interval is set with `.unref()` so it doesn't prevent process exit

---

## Section 8 — Authentication and Authorization

**Token format:** JWT containing `{ userId, username, email }`, signed with `JWT_SECRET` env var (default: `'dev-secret-change-in-production'`), expires in 7 days.

**Token storage:** Frontend stores in `localStorage` key `collab-ai-token`. Backend expects in `Authorization: Bearer <token>` header.

**Verification flow:** `middleware/auth.js` `authenticate()` → extracts token from header → `authService.verifyToken()` → `jwt.verify(token, JWT_SECRET)` → attaches decoded payload as `req.user`.

**Authorization checks:**
- All project routes call `authenticate` middleware first
- `isProjectMember()`: checks `project.members.some(m => m.userId.toString() === userId.toString())`
- `isProjectOwner()`: checks `project.ownerId.toString() === userId.toString()`
- Stage changes, LLM updates, API key changes, and project updates: owner only
- Discussion invites: owner OR discussion participant
- No route-level authorization beyond membership exists for read operations

**WebSocket auth:** Client sends `{ type: 'auth', token }` → verified with same `authService.verifyToken()`. If valid, `meta.userId` and `meta.username` are set. **If auth fails, connection is NOT closed** — an `auth-error` message is sent but the WebSocket stays open. The client can still send messages, but `handleJoinProject()` will fail if `meta.userId` is null (it checks membership).

**What is NOT enforced:**
- No CSRF protection
- No request signing
- JWT cannot be revoked before expiry
- No multi-session management
- No brute-force protection on login (rate limiter only applies to AI requests)

---

## Section 9 — External Service Integrations

### 9.1 Groq API

- **Service:** Groq cloud LLM inference (Llama 3.1/3.3, Mixtral, Gemma)
- **Sent:** `{ model, messages, temperature, max_tokens }` via `Groq` SDK
- **Expected back:** Chat completion response with `choices[0].message.content` and `usage`
- **Streaming:** `stream: true` → async iterable of chunks with `choices[0].delta.content`
- **Failure handling (non-streaming):** Goes through `LLMGuardrails.guardedCall()` → validates request → `executeWithRetry()` → timeout at 90s → 1 retry for retryable errors (network, timeout, rate limit with 3s delay)
- **Failure handling (streaming):** NO guardrails. Raw SDK call. If it fails, error propagates to `handleAIInvocation()` which saves an error message.
- **Unavailability:** If Groq API is unreachable, error message posted as System message in chat

### 9.2 SendGrid API

- **Service:** Email delivery
- **Sent:** POST to `https://api.sendgrid.com/v3/mail/send` with `{ personalizations, from, subject, content }` and `Authorization: Bearer <apiKey>`
- **Expected back:** 200-level status on success
- **Failure handling:** If `SENDGRID_API_KEY` is not set, `emailService.enabled` is `false` and all emails are silently logged instead of sent. If API call fails, error is thrown and caught by caller.
- **Used by:** Welcome email (on register), project invite, discussion invite

### 9.3 Google OAuth

- **Service:** Google OAuth 2.0
- **Sent:** Auth code → exchanged for access token at `https://oauth2.googleapis.com/token` → user info fetch from `https://www.googleapis.com/oauth2/v2/userinfo`
- **Expected back:** `{ id, email, name }` from user info endpoint
- **Failure handling:** If access token retrieval fails, throws error. If `GOOGLE_CLIENT_ID` not set, returns 500.

---

## Section 10 — Frontend Architecture

### Component Hierarchy

```
App.jsx (544 lines)
  └── ErrorBoundary (class component, catches React errors)
      └── AuthProvider (Context: user, token, login, register, logout, refreshAuth)
          └── ThemeProvider (Context: dark/light theme)
              ├── Auth.jsx — Login/register forms with Google OAuth button
              ├── Onboarding.jsx — First-time user guide (shown once)
              ├── ProjectList.jsx (~800 lines) — Project grid with create/join modals
              ├── ProjectWorkspace.jsx (~3500 lines) — THE MONOLITH
              │   Manages: WebSocket connection, chat messages, AI streaming,
              │   discussions sidebar, document upload, decision log, member
              │   invites, model selector, profile modal
              └── InviteConfirmModal — Inline in App.jsx
```

### State Management

No external state library. All state is React `useState` + Context API.

- `AuthContext`: Stored in Context. Token persisted to `localStorage`.
- `ThemeContext`: Stores theme preference, syncs to User.theme via API.
- Project selection: `selectedProject` state in `App.jsx`. Setting it to non-null shows `ProjectWorkspace`.
- No client-side routing library. URL is manipulated via `window.history.replaceState()`.

### WebSocket in Frontend

**Two implementations exist:**
1. `frontend/src/services/websocket.js` — A full `WebSocketService` class with reconnection, event emitter, heartbeat, message queue. **This service is never imported by any component.** It is dead code.
2. `ProjectWorkspace.jsx` — Creates its own native `new WebSocket(wsUrl)` directly, managing connection inline within the component.

**Connection lifecycle in ProjectWorkspace:**
1. Component mounts → creates `new WebSocket(config.wsBaseUrl)`
2. `onopen`: sends `{ type: 'auth', token }`
3. On `auth-success`: sends `{ type: 'join-project', projectId, discussionId }`
4. On `discussion-joined`: sets messages state from payload
5. On `project-chat`: appends message to state
6. On `ai-stream-start`: sets streaming state, clears streaming content
7. On `ai-stream-chunk`: appends chunk to streaming content string
8. On `ai-stream-end`: clears streaming state, adds final message to messages array

### Frontend Services

| File | Status |
|---|---|
| `services/api.js` (199 lines) | **Active.** Singleton `APIService` class used by `AuthContext.jsx` for login/register/verify. Has get/post/put/patch/delete/upload methods. |
| `services/projectService.js` (128 lines) | **Partially dead.** Wraps `api.js` for project operations. Some methods are called by components, but `ProjectWorkspace.jsx` also makes direct `apiRequest()` calls bypassing this service. |
| `services/websocket.js` (283 lines) | **Completely dead.** Full WebSocket service with reconnection, event system, etc. Never imported by any component. `ProjectWorkspace.jsx` uses raw `new WebSocket()` instead. |

### Two API Utilities

| File | Usage |
|---|---|
| `utils/api.js` (`apiRequest`) | Used by `App.jsx` for invite flow. Simple `fetch(url, options)` wrapper. |
| `services/api.js` (`APIService`) | Used by `AuthContext.jsx` and `projectService.js`. Full HTTP client with auth header injection. |

Both exist and are used by different parts of the frontend. They do the same thing differently.

---

## Section 11 — Configuration and Environment

### Backend — Required (crash on missing)

| Variable | Checked By | What Happens If Missing |
|---|---|---|
| `GROQ_API_KEY` or `CHATBOT_API_KEY` | `config/index.js` `validateRequired()` | **Throws on startup**, server never starts |
| `ENCRYPTION_KEY` | `EncryptionService` constructor | **Throws on startup**: `'ENCRYPTION_KEY environment variable is required'`. Must be exactly 64 hex characters (32 bytes). |

### Backend — Optional

| Variable | Default | Used By |
|---|---|---|
| `PORT` | `8080` | `config.port` |
| `NODE_ENV` | `'development'` | Controls error verbosity, log format, static file serving |
| `MONGODB_URI` | `'mongodb://localhost:27017/collab-chat'` | Database connection |
| `JWT_SECRET` | `'dev-secret-change-in-production'` | JWT signing. **INSECURE DEFAULT.** |
| `JWT_EXPIRES_IN` | `'7d'` | In `config/index.js` but `authService.js` hardcodes `'7d'` separately. The config value is never read. |
| `BCRYPT_ROUNDS` | `10` | In `config/index.js` but `authService.js` hardcodes `10` separately. The config value is never read. |
| `WS_HEARTBEAT_INTERVAL` | `30000` | WebSocket ping interval (ms) |
| `WS_RECONNECT_TIMEOUT` | `5000` | In config but never actually read by any code |
| `RATE_LIMIT_WINDOW` | `60000` | In config but `RateLimiter` hardcodes `60000` separately |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | In config but never read by any code |
| `WS_RATE_LIMIT_MAX_MESSAGES` | `30` | WS message rate limit per minute |
| `RATE_LIMIT_USER_PER_MIN` | `20` | AI request rate limit per user per minute |
| `RATE_LIMIT_PROJECT_PER_MIN` | `50` | AI request rate limit per project per minute |
| `MAX_CONTEXT_TOKENS` | `6000` | In config but never read by any code |
| `MAX_DOCUMENT_CHUNK_SIZE` | `1000` | In config but `chunking.js` reads `CHUNK_SIZE` instead |
| `EMBEDDING_DIMENSIONS` | `1536` | In config but never read. Actual dimension is hardcoded as 384 in `EmbeddingService` and `VectorStore`. **Misleading value.** |
| `LOG_LEVEL` | `'debug'` (dev) / `'info'` (prod) | Logger severity filter |
| `CORS_ORIGINS` | `'http://localhost:5173,http://localhost:3000'` | Allowed origins |
| `CHUNK_SIZE` | `900` | Document chunking target size (chars) |
| `CHUNK_OVERLAP` | `100` | Document chunking overlap (chars) |
| `HF_EMBEDDING_MODEL` | `'Xenova/all-MiniLM-L6-v2'` | Local embedding model name |
| `SENDGRID_API_KEY` | — | Email sending. If absent, emails are logged but not sent. |
| `FROM_EMAIL` | `'noreply@collabai.com'` | Email sender address |
| `FROM_NAME` | `'CollabAI'` | Email sender name |
| `FRONTEND_URL` | `'http://localhost:5173'` | Used in email templates for links |
| `GOOGLE_CLIENT_ID` | — | Google OAuth. If absent, GET `/api/auth/google` returns 500. |
| `GOOGLE_CLIENT_SECRET` | — | Google OAuth token exchange |
| `GOOGLE_REDIRECT_URI` | `'http://localhost:8080/api/auth/google/callback'` | OAuth redirect |
| `BASE_URL` | `'http://localhost:8080'` | Swagger server URL |

### Frontend

| Variable | Default | Used By |
|---|---|---|
| `VITE_API_BASE_URL` | `'http://localhost:8080'` | All API calls |
| `VITE_WS_BASE_URL` | `'ws://localhost:8080'` | WebSocket connection |

---

## Section 12 — Dead Code and Known Gaps

### Dead Files

| File | Status | Reason |
|---|---|---|
| `services/roomService.js` (100 lines) | **Completely dead.** | Imports `Room` model which does not exist (`models/Room.js` is missing). Would crash if executed. Never imported by any other file. Legacy from pre-project architecture. |
| `services/messageService.js` (112 lines) | **Completely dead.** | Operates on `roomId`-based messages. Never imported by any route, WebSocket handler, or service. All message operations go through `discussionService.js`. |
| `services/userService.js` (129 lines) | **Completely dead.** | `getOrCreateUser()`, `setUserOnline()`, `incrementMessageCount()`, `cleanupOfflineUsers()`, `getOnlineUsers()` — none are ever called. All user operations go through `authService.js` or direct `User` model queries. |
| `frontend/src/services/websocket.js` (283 lines) | **Completely dead.** | Full WebSocket service class. Never imported by any component. `ProjectWorkspace.jsx` manages its own WebSocket. |

### Dead Fields

| Model | Field | Reason |
|---|---|---|
| `User.joinedRooms` | Never written or read | Legacy |
| `User.messageCount` | Never incremented | `userService.incrementMessageCount()` is dead code |
| `User.isOnline` | Set true on login, never set false | No disconnect handler updates it |
| `Message.roomId` | Never written in current flow | Legacy, defaults to 'general' |
| `Document.embedding` | Never written | Whole-doc embedding was planned, DocumentChunk is used instead |
| `Document.chunks` | Never written | Inline chunks were planned, DocumentChunk collection is used instead |
| `Summary.embedding` | Never written | Summary embeddings are not implemented |

### Dead Config Values

| Variable | Reason |
|---|---|
| `config.embeddingDimensions` (1536) | Never read. Misleading — actual dimension is 384 everywhere. |
| `config.maxContextTokens` (6000) | Never read. Token limits are hardcoded in `TokenManager.modelLimits`. |
| `config.maxDocumentChunkSize` (1000) | Never read. `chunking.js` reads `CHUNK_SIZE` env var. |
| `config.wsReconnectTimeout` | Never read. |
| `config.rateLimitMaxRequests` | Never read. |
| `config.jwtExpiresIn` | Read only by config but not by `authService.js` which hardcodes `'7d'`. |
| `config.bcryptRounds` | Read only by config but not by `authService.js` which hardcodes `10`. |
| `frontend config.features.*` | All four feature flags are never read. |

### Known Bugs and Issues

1. **~~`ProjectService.setProjectApiKey()` stores plaintext API keys.~~ (RESOLVED)** Projects now accurately encrypt their key entries upon save, and the explicit REST endpoints drop `.apiKey` fields inherently relying on Mongoose `select: false`.

2. **~~`AIOrchestrator.getApiKey()` for user providers uses bracket notation on a Mongoose Map.~~ (RESOLVED)** The `getProjectApiKey` explicitly retrieves and selects `+apiKeys` locally inside `projectService.js` yielding decryption dynamically prior to LLM interaction.

3. **~~Streaming calls bypass `LLMGuardrails`.~~ (RESOLVED)** `handleStreamingRequest()` is now wrapped within `LLMGuardrails.guardedCall()`.

4. **~~Summary `messageRange` is always `{ start: now, end: now }`.~~ (RESOLVED)** `summaryService.createSummary()` correctly queries `Message` models for the oldest and bounds dynamically.

5. **~~`bcrypt` and `bcryptjs` coexist.~~ (RESOLVED)** `user.js` and `package.json` converted consistently to `bcrypt`.

6. **~~Discussion creation route expects `name` field, validation schema has `title`.~~ (RESOLVED)** Fallback logic implements seamless retrofitting, paired natively with `validate('createDiscussion')`.

7. **~~No validation middleware on most routes.~~ (RESOLVED)** Validations strictly applied across major Express route mutations.

---

## Section 13 — Security Model

**What is enforced:**
- Passwords are hashed with bcrypt (10 rounds) before storage
- JWT tokens expire after 7 days and are verified on every authenticated request
- API keys at rest can be encrypted with AES-256-GCM (but the encryption route is not called — see bug above)
- Rate limiting: 20 AI requests/user/min, 50/project/min (in-memory, resets on server restart)
- Input sanitization: all string body fields are trimmed by `sanitize` middleware
- CORS: restricted to configured origins

**What is NOT enforced:**
- JWT stored in `localStorage` — vulnerable to XSS. Any script on the page can steal the token.
- `JWT_SECRET` defaults to `'dev-secret-change-in-production'` — if not changed, tokens can be forged.
- No CSRF protection (mitigated by same-origin WebSocket and CORS on REST)
- No rate limiting on login/register — brute-force attacks are possible
- No input length validation on WebSocket messages — a client can send arbitrarily large `text` payloads
- API keys stored by `setProjectApiKey()` are plaintext
- SendGrid API key stored as plaintext env var
- `ENCRYPTION_KEY` stored as plaintext env var
- WebSocket stays open even after auth failure
- No IP-based rate limiting
- Error messages in development mode include stack traces
- Markdown rendering uses DOMPurify (good) but rendering happens client-side

---

## Section 14 — Performance Characteristics

**Brute-force vector search:** `VectorStore.search()`, `searchMessages()`, and `searchDecisions()` load ALL embeddings for a project into memory, compute cosine similarity for each, sort, and return top-K. This is O(n) in embeddings per project. At 10,000 messages per project, each search loads 10,000 × 384 floats (~15MB) into memory. At 100,000, this becomes untenable.

**N+1 on discussions listing:** `GET /:projectId/discussions` makes one query per non-main discussion to fetch its latest summary.

**N+1 on context building:** `AIOrchestrator.buildProjectContext()` loops over all discussions in a project, fetching 1 summary per discussion. For a project with 20 discussions, that's 20 DB queries.

**Embedding backfill scale:** `EmbeddingWorker.backfillMessages()` calls `MessageEmbedding.distinct('messageId')` which loads ALL embedded message IDs into memory. For large projects, this set grows unboundedly.

**Memory footprint:** The local embedding model (`all-MiniLM-L6-v2`) loads ~90MB into memory on first use. Stays in memory for the lifetime of the process.

**Token counting:** `TokenManager.countTokens()` iterates every word with regex operations. Conservative but slow for very large prompts.

**Message history:** `getDiscussionMessages(discussionId, 30)` and `getDiscussionMessages(discussionId, 50)` are hardcoded limits. They always scan the index `{ discussionId, timestamp }`.

**What will break first:** Vector search. Once any project exceeds ~50K embeddings, the brute-force cosine similarity computation will cause latency spikes on every AI invocation.

---

## Section 15 — Invariants

1. **Every project must have exactly one main discussion.** Created in `projectService.createProject()`. No code creates a second main discussion, and no code deletes the main discussion. If violated: `handleJoinProject()` could fail because connection metadata requires a `discussionId`.

2. **`ENCRYPTION_KEY` must be exactly 64 hex characters (32 bytes).** Validated in `EncryptionService` constructor with regex `/^[0-9a-f]{64}$/i`. If violated: server crashes on startup.

3. **All embeddings must be exactly 384 dimensions.** Validated in `DocumentChunk` schema, `MessageEmbedding` schema, and checked by `VectorStore` methods. If violated: `cosineSimilarity()` throws `'Vectors must have same dimension'`.

4. **`messageId` must be unique in `MessageEmbedding`.** Schema has `unique: true`. If violated: MongoDB throws duplicate key error, caught by `EmbeddingWorker` (skips silently) and `_embedMessage()` (logs warning).

5. **`projectId` must be unique in `ProjectState`.** Schema has unique index. If violated: MongoDB throws duplicate key error.

6. **Client must authenticate before joining a project.** `handleJoinProject()` checks `meta.userId` which is only set by successful `handleAuth()`. If `meta.userId` is null, `isProjectMember()` will fail because `null.toString()` throws in some cases — though Mongoose might handle it.

7. **WebSocket client metadata must have `projectId` and `discussionId` before sending chat.** Checked at top of `handleProjectChat()`: `if (!projectId || !discussionId) return error`.

---

## Section 16 — What Must Never Be Assumed

1. **Do NOT assume `ProjectState.pinnedContext` is used.** It is not. The field exists in the schema, the model is imported in two places, but it is never read or written in any active code path. Decisions are retrieved semantically at query time.

2. **Do NOT assume streaming responses go through `LLMGuardrails`.** Only non-streaming `callProvider()` uses `LLMGuardrails.guardedCall()`. Streaming calls `callGroqStreaming()` directly with no timeout, retry, or validation.

3. **Do NOT assume `User.isOnline` is accurate.** It is set `true` on login and never set `false`. There is no disconnect handler that updates it.

4. **Do NOT assume `User.messageCount` tracks anything.** It is always 0. Nothing increments it.

5. **Do NOT assume the frontend WebSocket service class is used.** `frontend/src/services/websocket.js` is dead code. `ProjectWorkspace.jsx` uses raw `new WebSocket()`.

6. **Do NOT assume `config.embeddingDimensions` (1536) is the actual dimension.** The actual dimension throughout the system is 384, hardcoded in `EmbeddingService`, `DocumentChunk` validator, `MessageEmbedding` validator, and `VectorStore`.

7. **Do NOT assume `roomService.js` or `messageService.js` work.** `roomService.js` imports a `Room` model that does not exist. `messageService.js` operates on `roomId` which is a dead field.

8. **Do NOT assume all routes have validation middleware.** Only `POST /register` and `POST /login` use `validate()`. All other routes do manual checks.

9. **Do NOT assume API keys stored via `POST /:projectId/api-key` are encrypted.** They are stored as plaintext despite `EncryptionService` existing.

10. **Do NOT assume `Summary.messageRange` reflects actual message timestamps.** Both `start` and `end` are set to `new Date()` at creation time.

11. **Do NOT assume `'server'` is a real provider.** It is an alias for Groq. `selectModel()` maps it, and `callProvider()` treats it as Groq. It exists so the frontend can display "Server" as the default option when users haven't configured their own API key.

12. **Do NOT assume the frontend has a single API utility.** There are two: `utils/api.js` (simple fetch wrapper used by `App.jsx`) and `services/api.js` (full HTTP client with auth used by `AuthContext`). They are not the same function.

13. **Do NOT assume `features.aiStreaming: false` in frontend config means streaming doesn't work.** It does work. This flag is never read by any code.

14. **Do NOT assume the Swagger docs show any endpoints.** The route files have no JSDoc Swagger annotations. The `/docs` page loads but is empty.

---

*End of document. Every statement is verifiable by reading the source files listed. This document reflects the exact state of the codebase as of 2026-04-13. The `ProjectState` model and all `pinnedContext` references have been fully removed from the codebase.*
