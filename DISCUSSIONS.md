# Discussions — Execution-Level System Document

## 1. Data Models

### Discussion
```
projectId        ObjectId → Project
title            String (required)
description      String
isMain           Boolean (default: false)
parentDiscussionId ObjectId → Discussion (null = root)
branchDepth      Number (0 = root, increments per branch level)
participants     [ObjectId → User]
creatorId        ObjectId → User
lastActivity     Date
messageCount     Number
status           'active' | 'archived'
```
Indexes: `{ projectId, status }`, `{ parentDiscussionId }`, `{ lastActivity: -1 }`

### Message
```
discussionId     ObjectId → Discussion
projectId        ObjectId → Project
userId           ObjectId → User (optional, null for AI)
user             String (username or 'CollabAI' or 'System')
text             String
timestamp        Number (ms epoch)
isAI             Boolean
```
Indexes: `{ discussionId, timestamp: 1 }`, `{ projectId, createdAt: -1 }`

---

## 2. HTTP API Routes

All routes require `Authorization: Bearer <token>` (JWT). All routes are under `/api/projects`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/:projectId/discussions` | member | List all active discussions for project |
| POST | `/:projectId/discussions` | member | Create a new parallel discussion |
| POST | `/:projectId/discussions/:discussionId/invite` | owner or participant | Add a project member to a discussion |
| POST | `/:projectId/discussions/:discussionId/invite-email` | owner or participant | Send email invite with project invite code + discussionId |
| POST | `/join` | authenticated | Join project by invite code; optionally join a specific discussion |
| POST | `/invite-preview` | authenticated | Preview project/discussion info before joining |

### GET `/:projectId/discussions`
Returns all discussions where `status = 'active'` or status field absent (legacy), sorted `isMain DESC, lastActivity DESC`. Participants are populated with `username, email`.

### POST `/:projectId/discussions`
Body: `{ name, description }`. Creates a new discussion via `discussionService.createDiscussion`. Creator and project owner are auto-added as participants. `isMain` is always `false` for user-created discussions.

### POST `/join`
Body: `{ inviteCode, discussionId? }`. Joins the project, then optionally calls `discussionService.joinDiscussion(discussionId, userId)` if `discussionId` is provided.

---

## 3. Discussion Lifecycle

### Creation
When a project is created, a main discussion is created automatically by `projectService.createProject`. It sets `isMain: true`. All subsequent discussions created by users have `isMain: false`.

### Branch structure
Discussions support a tree structure via `parentDiscussionId` and `branchDepth`. The schema includes `getLineage()` and `getChildren()` instance methods for graph traversal. The frontend does not currently render the tree — it shows a flat list.

### Participant management
- Creator + project owner are added on creation.
- `joinDiscussion(discussionId, userId)` uses `$addToSet` — idempotent.
- Only project members can be added to a discussion.

---

## 4. WebSocket Protocol

The server runs a single `WebSocketServer` attached to the HTTP server. All real-time discussion communication goes through WebSocket.

### Connection lifecycle

```
Client                          Server
  |                               |
  |-- WS connect ---------------→ |  handleConnection: assign clientId, init metadata
  |← (open) ----------------------|
  |-- { type: 'auth', token } --→ |  handleAuth: verify JWT, store userId + username in client meta
  |← { type: 'auth-success' } ---|
  |-- { type: 'join-project',    |
  |    projectId, discussionId } →|  handleJoinProject: verify membership, load last 50 messages
  |← { type: 'discussion-joined',|
  |    messages: [...],           |
  |    discussionId }             |
  |                               |
  |-- { type: 'project-chat',    |
  |    text } -------------------→|  handleProjectChat: save message, broadcast, trigger extraction
  |← { type: 'project-chat',     |
  |    message: { user, text,     |
  |    time, isAI } }             |  (broadcast to all clients in same discussionId)
```

### Client metadata (per connection)
```js
{
  id: 'client_<timestamp>_<random>',
  userId: null,       // set after auth
  username: null,     // set after auth
  projectId: null,    // set after join-project
  discussionId: null, // set after join-project
  isAlive: true,      // heartbeat flag
  connectedAt: Date.now(),
  lastActivity: Date.now()
}
```

### Message types

| Type (client → server) | Description |
|------------------------|-------------|
| `auth` | `{ token }` — authenticate the connection |
| `join-project` | `{ projectId, discussionId }` — join a discussion room |
| `project-chat` | `{ text }` — send a message |
| `ping` | heartbeat ping |

| Type (server → client) | Description |
|------------------------|-------------|
| `auth-success` | `{ user: { userId, username } }` |
| `discussion-joined` | `{ messages: [...], discussionId }` — last 50 messages |
| `project-chat` | `{ message: { user, text, time, isAI } }` — broadcast to all in discussion |
| `ai-thinking` | `{ status: 'generating' }` — AI is processing |
| `ai-error` | `{ message }` — AI call failed |
| `pong` | heartbeat response |
| `error` | `{ message }` — generic error |

### Broadcast scope
`broadcastToDiscussion(discussionId, payload)` iterates all connected clients and sends to those whose `meta.discussionId === discussionId` and `ws.readyState === 1 (OPEN)`.

### Rate limiting
Per-client in-memory counter. Window: `config.rateLimitWindow` ms. Max messages: `config.wsRateLimitMaxMessages`. Exceeding returns `{ type: 'error', message: 'Rate limit exceeded' }`.

### Heartbeat
Server pings all clients every `config.wsHeartbeatInterval` ms. Clients that don't respond with `pong` are terminated on the next cycle (`isAlive` flag pattern).

---

## 5. Message Flow — Sending a Message

```
handleProjectChat(ws, data)
  │
  ├─ discussionService.addMessage(discussionId, projectId, userId, username, text, false)
  │    └─ new Message({ discussionId, projectId, userId, user, text, timestamp, isAI: false })
  │    └─ Discussion.findByIdAndUpdate: lastActivity, $inc messageCount
  │
  ├─ broadcastToDiscussion(discussionId, { type: 'project-chat', message })
  │
  ├─ _triggerExtractionForMessage(message, projectId, discussionId)  ← async, non-blocking
  │
  └─ if text.startsWith('@CollabAI'):
       handleAIInvocation(ws, text, projectId, discussionId, userId)
```

### AI invocation flow
```
handleAIInvocation
  │
  ├─ broadcastToDiscussion: { type: 'ai-thinking' }
  ├─ aiService.generateResponse(projectId, discussionId, prompt, activeLLM, userId)
  ├─ discussionService.addMessage(..., 'CollabAI', aiReply, true)
  └─ broadcastToDiscussion: { type: 'project-chat', message: { isAI: true } }
       └─ on error: save System error message, broadcast ai-error
```

---

## 6. Intelligence Extraction Pipeline

Triggered non-blocking after every user message via `_triggerExtractionForMessage`. Skips messages shorter than 30 characters and `@CollabAI` invocations.

### Stage 1 — Rate gate (InsightExtractor)

In-memory counter per `discussionId`. Increments on every call. Resets to 0 when it reaches `MIN_MESSAGES_BETWEEN_EXTRACTIONS` (currently 5). Only the 5th message triggers the LLM call. Counter resets on server restart.

```
count = (extractionCounters.get(discussionId) || 0) + 1
if count < 5 → return empty (skip)
else → reset counter to 0, proceed
```

### Stage 2 — Window building

Fetches the last `WINDOW_SIZE` (14) messages from the discussion, excluding `user === 'System'`. Combines into a single text block:
```
nk: <message text>
pk: <message text>
...
User: <current message text>
```

### Stage 3 — Overlap guard

Checks if ≥ 90% of the window's message IDs are already referenced in `supportingMessageIds` across existing Decisions, ActionItems, and Blockers for this project. If so, skips extraction — the window has already been substantially processed.

```
coveredIds = union of supportingMessageIds from all artifacts that reference any windowMessageId
overlap ratio = |coveredIds ∩ windowMessageIds| / |windowMessageIds|
if ratio >= 0.9 → skip
```

### Stage 4 — LLM extraction

Calls `AIOrchestrator.callProvider` with:
- `temperature: 0.1`
- `maxTokens: 1000`
- `systemPrompt`: "You are an engineering knowledge extractor. Return ONLY valid JSON."
- `prompt`: `buildExtractionPrompt(combinedWindowText)`

The extraction prompt instructs the LLM to return JSON with four arrays: `topics`, `decisions`, `blockers`, `actionItems`. Key rules enforced in the prompt:
- Decisions MUST start with a choice verb (`use / adopt / store / keep / switch to / standardize on / deploy / migrate to`) and MUST NOT use an indefinite article (`use a pool` → action, not decision)
- One decision per technology — if Meilisearch appears multiple times, extract ONE
- Actions must have explicit execution intent
- Blockers must be real constraints, not speculative concerns

### Stage 5 — Validation (validateExtractedEntities)

Four filters applied to each artifact type:

| Filter | Decisions | Blockers | Actions | Topics |
|--------|-----------|----------|---------|--------|
| `meetsMinLength` (≥15 chars) | ✓ | ✓ | ✓ | — |
| `notNoise` (not in NOISE_EXACT set, ≥3 words) | ✓ | ✓ | ✓ | — |
| `appearsInConversation` (≥2 key words found in window text) | ✓ | ✓ | ✓ | ✓ |
| `looksLikeDecision` (matches DECISION_PATTERNS, no UNCERTAINTY_PATTERNS) | ✓ | — | — | — |

`looksLikeDecision` patterns (current):
- `we('ll|will|are going to|have decided|decided|chose|are using|will use)`
- `let's (use|go with|adopt|switch to|deploy|standardize)`
- `going with`, `decided (to use|on)`
- `we('ve|have) (chosen|selected|picked|agreed|adopted)`
- `our (approach|stack|architecture|solution|choice) (is|will be)`
- `(use|adopt|store|keep|switch to|standardize on|mirror) <non-article word>`
- `we should (use|adopt|store|keep|switch to|deploy|standardize on|migrate to)`

### Stage 6 — Aggregation (KnowledgeAggregator.mergeInsights)

Runs in order: Topics → Blockers → Decisions → Actions → ProjectState recompute.

#### Topics
1. Generate embedding for topic name
2. Semantic dedup against existing topics (threshold: 0.82) — if match, increment `count`, update `lastSeenAt`
3. If no match, upsert by `{ projectId, normalizedName }` — increment `count`
4. Promote to `status: 'stable'` when `count >= 3`
5. Topic decay: topics with `status: 'stable'` and `lastSeenAt < 30 days ago` → `status: 'parked'`

#### Blockers
1. Noise filter + placeholder check
2. Semantic cluster check (threshold: 0.85) — if match, increment `occurrenceCount`, update `lastSeenAt`
3. If no cluster match, infer severity (pattern-based, does NOT trust LLM high severity blindly):
   - High: `blocking|blocked|crash|crashing|failing|failed|unusable|impossible|...`
   - Medium: `slow|captcha|forbidden|403|performance|storage|constraint|expire|...`
   - Low: `minor|cleanup|refactor|nice to have|...`
   - Default: medium
4. Upsert by `{ projectId, text, resolved: false }`

#### Decisions
1. Noise filter
2. `_isLowLevelImplementationDecision` — rejects low-level verbs (hash/map/parse/...) unless ARCH_SIGNALS present
3. `_isImplementationAction` — reclassifies to action if:
   - Starts with `use a/an` (technique, not tech choice)
   - Starts with impl verbs (add/implement/create/build/...) without a choice verb prefix
4. Substring containment dedup against existing decisions (normalized) → merge if match
5. Semantic similarity ≥ 0.80 → merge if match
6. New artifact: normalize text via `_normalizeArtifactText`, upsert by `{ projectId, text }`
7. AI-sourced decisions get `needsHumanValidation: true` — hidden from dashboard until a human message triggers a merge

#### Actions
Same dedup pipeline as decisions (substring → semantic → new), using `normalizeActionVerb` for normalization.

#### Text normalization (`_normalizeArtifactText`)
Applied on create and merge. Strips:
- Leading conversational prefixes: `we'll / let's / I think we / going with / decided to / ...`
- Inline fillers: `just / basically / probably / maybe / actually / really / ...`
- Orphaned leading `to ` after prefix stripping
Capitalizes result. Falls back to original if result is empty.

### Stage 7 — ProjectState recompute

After every aggregation call, `_recomputeProjectState` runs:

1. Topic decay (30-day rule)
2. Queries for dashboard counts with confidence-based gating:
   - Blockers shown: `occurrenceCount >= 2` OR `severity === 'high'`
   - Decisions shown: `status: 'active'`, `needsHumanValidation: { $ne: true }`
   - Topics shown: `status: 'stable'`
   - Actions shown: `status: { $ne: 'completed' }` (no frequency gate)
3. Computes momentum: compares message count in last 7 days vs prior 7 days → `rising / stable / falling`
4. Infers stage: `blocked` (open blockers + falling momentum) → `discussion` (has decisions) → `ideation`
5. Builds `pinnedContext` string (used as AI context prefix): stage, momentum, top 3 decisions, top 3 blockers, top 6 topics, top 3 actions
6. Upserts `ProjectState` (unique per project)

---

## 7. Frontend — ProjectWorkspace

### WebSocket connection
`ProjectWorkspace` manages its own raw `WebSocket` (not the `websocketService` singleton). On mount, `connectWebSocket()` creates a new socket, sends `auth`, and if `currentDiscussion` is already set, immediately sends `join-project`.

Auto-reconnect: on `onclose`, waits 3 seconds then calls `connectWebSocket()` again if not already connected.

### Discussion switching
`switchDiscussion(discussion)` clears messages, sets `isLoadingMessages: true`, sends `join-project` to the server. The server responds with `discussion-joined` containing the last 50 messages.

### Message sending
`sendMessage()` sends `{ type: 'project-chat', text }` over WebSocket. The server saves, broadcasts, and triggers extraction. The sender receives the broadcast back (same as all other clients in the discussion).

### AI mention
Typing `@CollabAI` in the input triggers `setAiThinking(true)`. The server handles the AI invocation and broadcasts `ai-thinking` then the AI response as a `project-chat` message with `isAI: true`.

### Discussion visibility
Non-owners only see discussions where they are a participant or `isMain: true`. Owners see all discussions.

---

## 8. Key Constraints and Invariants

- A project always has exactly one `isMain: true` discussion, created at project creation time.
- Messages are never deleted. The discussion `messageCount` is an increment-only counter.
- Extraction counters are in-memory — they reset on server restart. A restarted server will re-extract from the next message after restart.
- `supportingMessageIds` on artifacts is an append-only set (`$addToSet`). It is used only for the overlap guard, not for display.
- `needsHumanValidation` on decisions is a one-way flag: set to `true` on AI-sourced creation, cleared to `false` when a human message triggers a merge. Never set back to `true`.
- Blocker `occurrenceCount` starts at 1 on creation (`$setOnInsert`). The dashboard gate is `>= 2`, so a blocker must appear in at least two extraction windows to surface.
- Topic `status` transitions: `candidate` → `stable` (count >= 3) → `parked` (not seen in 30 days). No reverse transition.
