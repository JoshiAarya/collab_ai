# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **Note:** This describes the current `less-mess` branch — a deliberately simplified version of CollabAI. The app is a real-time team chat with an AI assistant (`@CollabAI`), per-discussion summaries, document/RAG context, and a saved-decision log ("Project Memory"). Earlier, more elaborate "intelligence pipeline" designs (sliding-window insight extraction, knowledge aggregation, strategic signals, and `Topic`/`Blocker`/`ActionItem`/`ProjectState` models) were removed and are **not** part of this branch.

## Development Commands

### Backend
```bash
cd backend
npm run dev          # nodemon watch mode on src/server.js
npm start            # production
# NOTE: `npm run setup` (src/scripts/setup.js) is currently BROKEN — it imports
# the dead roomService/messageService and a non-existent Room model. Do not rely on it.
```

### Frontend
```bash
cd frontend
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # production build
npm run lint         # ESLint
npm run preview      # preview production build
```

### Docker
```bash
docker-compose up --build   # full stack: MongoDB :27017, app :8080
```

## Required Environment Variables

### Backend (`backend/.env`)
```
MONGODB_URI=mongodb://localhost:27017/collabai
JWT_SECRET=...
GROQ_API_KEY=...
ENCRYPTION_KEY=...   # 64-char hex: openssl rand -hex 32
```

### Frontend (`frontend/.env`)
```
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_BASE_URL=ws://localhost:8080
```

## Architecture

### Frontend (React 19 + Vite 7)
Entry: `frontend/src/main.jsx` → `App.jsx` (ErrorBoundary > AuthProvider > ThemeProvider > AppContent)

Key components:
- `ProjectWorkspace.jsx` — main UI shell; owns Chat, Documents, Summaries, Settings, and the Dashboard (Project Memory) views. Contains embedded sub-components (`Settings`, `Documents`, `Summaries`, `AllDiscussionSummaries`, `CreateDiscussionModal`, `InviteToDiscussionModal`, `MessageBubble`).
- `Dashboard.jsx` — Project Memory: searchable card grid of saved decisions.
- `ModelSelector.jsx` — AI provider/model selection + per-project API key management.

Contexts: `AuthContext`, `ThemeContext` (persists to DB), `ToastContext`
Services: `services/api.js` (`APIService`), `services/websocket.js` (reconnect + queue), `services/projectService.js`. A bare fetch wrapper also lives at `utils/api.js` (`apiRequest`) and is used directly by some components.

### Backend (Node.js / Express 5 + ws)
Entry: `backend/src/server.js`. Mounts `/api/auth`, `/api/projects`, `/api/user`; serves the built frontend and `/docs` (Swagger) in production. App on `:8080`, MongoDB `:27017`.

Routes: `auth.js`, `projects.js` (project CRUD, discussions, messages, documents, summaries, decisions, API keys), `user.js`
WebSocket: `services/connectionManager.js` — heartbeat 30s, rate limiting; handles `join-project`, message broadcast, and AI streaming events.

### Models (`backend/src/models`)
`User`, `Project` (members, `activeLLM`, `apiKeys` Map — `select:false`), `Discussion`, `Message`, `MessageEmbedding`, `Document`, `DocumentChunk` (embedding[384]), `Summary`, `Decision` (the saved "Project Memory" entries; supports semantic search via embedding).

### Core (`backend/src/core`)
- `orchestrator/AIOrchestrator.js` — builds AI context and calls providers (streaming + non-streaming).
- `embeddings/EmbeddingService.js` — local embeddings via `@xenova/transformers` (384-dim).
- `vector/VectorStore.js` — cosine-similarity search over message/decision/document embeddings.
- `stability/` — `LLMGuardrails.js` (provider/model validation, timeouts, retries), `RateLimiter.js`, `TokenManager.js` (context trimming), `EncryptionService.js` (AES-256-GCM for API keys).

### AI Context Building (`AIOrchestrator.buildProjectContext`)
When `@CollabAI` is mentioned, context is assembled from: project info + current discussion, semantically-relevant past messages and decisions (via `VectorStore`), top document chunks, summaries of other discussions, last summaries, and recent messages. Falls back to loading recent decisions/documents directly when no embeddings exist.

### AI Streaming
`AIOrchestrator.handleStreamingRequest(params, onChunk)` streams token-by-token for **all** supported providers (`callGroqStreaming` / `callOpenAIStreaming` / `callAnthropicStreaming` / `callGoogleStreaming`), with a single-chunk fallback for anything else. `connectionManager.js` broadcasts `ai-stream-start` / `ai-stream-chunk` / `ai-stream-end`; the frontend renders the live text.

### Messages & Pagination
Initial load: the latest 50 messages arrive via the WebSocket `join-project` → `discussion-joined` event. Older messages load on demand via `GET /:projectId/discussions/:discussionId/messages?before=<timestamp>&limit=`, backed by cursor-based `discussionService.getDiscussionMessages(discussionId, { limit, before })` (returns `{ messages, hasMore, nextCursor }`). The frontend "Load older messages" button prepends results and preserves scroll position.

### Documents / RAG
`POST /:projectId/documents` accepts `.txt`/`.md` as JSON `{ title, content, fileType }`. `POST /:projectId/documents/upload-file` accepts **PDF** via multipart (`multer` memory storage, 10 MB cap), extracts text with `pdf-parse`, then reuses `documentService.uploadDocument`. All documents are chunked and embedded asynchronously into `DocumentChunk` for retrieval.

### Decisions (Project Memory)
Decisions are saved explicitly (optimistic save from the UI) and normalized/embedded in the background; extraction logic is inline in `routes/projects.js`, not a separate pipeline.

## Known Limitations

- **Multi-LLM**: Groq, OpenAI, Anthropic, and Google are all implemented in `AIOrchestrator.js` and allowed by `LLMGuardrails.js` (provide a per-project API key for the non-Groq ones; Groq uses `GROQ_API_KEY` from env). **DeepSeek/xAI** are still "coming soon" (greyed out in `ModelSelector.jsx`, not wired on the backend).
- **API Keys**: encrypted with `EncryptionService` (AES-256-GCM) via `encryptIfNeeded` on write and decrypted via `decryptForUse` on read. Backward-compatible with legacy plaintext keys (logs a warning) — there is **no migration script** to force re-encryption of old rows.
- **No test suite** — no automated tests exist.
- Dashboard / project mutations (stage, LLM config, API keys) are **owner-only**; chat, documents, summaries, and decisions are open to any project member.

## Dead Code — do not use or extend
`services/roomService.js`, `services/messageService.js` (only referenced by the broken `scripts/setup.js`). There is no `Room` model. The legacy `StructuredExtractor` / `ProjectInsights` concepts do not exist on this branch.
