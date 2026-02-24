# Real-Time AI Collaborative Workspace

A real-time collaborative workspace where multiple users work together with a shared AI assistant. Built as an MVP to demonstrate team-based AI collaboration with structured memory, project documents, parallel discussions, and a manager dashboard.

## 🎯 Core Problem

Current AI platforms (ChatGPT, Claude, Gemini, DeepSeek) follow a single-user, single-LLM model. Teams brainstorm individually with AI and manually merge ideas later, leading to:
- Loss of shared context
- Inconsistent AI outputs
- Poor collective decision tracking

This project builds a **shared AI workspace** where multiple users collaborate with the SAME AI.

---

## 🚀 Quick Start

### Option 1: Docker (Recommended)

**Prerequisites**: Docker and Docker Compose installed

```bash
# Windows
start.bat

# Linux/Mac
chmod +x start.sh
./start.sh
```

Access the app at http://localhost:3000

For detailed Docker instructions, see [DOCKER.md](DOCKER.md)

### Option 2: Local Development

**Prerequisites**: Node.js 18+, MongoDB

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

---

## 📊 SYSTEM STATUS & ARCHITECTURE

> **Last Updated:** Based on comprehensive codebase analysis

### Architecture Overview

```
Frontend (React) → WebSocket/HTTP → Backend (Node.js/Express) → MongoDB
                                    ↓
                                  Groq API (llama-3.1-8b-instant)
```

### Implementation Status

#### ✅ Fully Implemented (Production-Ready)
- **Authentication**: JWT + bcrypt, role-based access (Owner/Member)
- **Project Management**: Create/join via invite codes, ownership model
- **Real-Time Messaging**: WebSocket with heartbeat, auto-reconnection
- **Discussion System**: Main + parallel discussions, graph structure ready
- **AI Integration**: @CollabAI mentions, context building, Groq API
- **Model Selection**: UI for switching providers (Server/OpenAI/Anthropic/Google)
- **Document Upload**: Text/Markdown files with persistence
- **Summary Generation**: AI-powered summaries with refinement
- **Dashboard**: Real-time stats + AI-generated insights (topics, decisions, blockers)
- **Error Handling**: Centralized error handling with structured logging
- **User Profiles**: Full profile management with bio, theme preferences
- **Theme System**: Dark/Light mode with persistence
- **Docker Support**: Complete containerization with docker-compose

#### ⚠️ Partially Implemented
- **AI Context Building**: Works but no token counting, no semantic search
- **Dashboard Insights**: Real metrics + AI insights, but charts are dummy data
- **Discussion Graph**: Backend supports branching, frontend doesn't expose it
- **Multi-LLM Support**: UI complete, only Groq actually integrated

#### 🚧 Stubbed/Not Functional
- **AIOrchestrator.js**: Exists but NOT used (dead code)
- **VectorStore.js**: In-memory stub, NOT connected to documents
- **StructuredExtractor.js**: Regex-based stub, NOT used
- **Email Service**: UI only, no backend implementation
- **Google OAuth**: Button disabled, not implemented
- **Document Embeddings**: Schema ready, no generation logic
- **Vector Database**: No Pinecone/Weaviate integration

#### ❌ Missing Critical Features
1. **Real RAG Pipeline**: No embeddings, no semantic search, no chunking
2. **API Key Encryption**: Stored as plain text (security risk)
3. **Rate Limiting**: Config exists but not enforced
4. **Testing**: No unit/integration/E2E tests
5. **Monitoring**: No APM, error tracking, or metrics
6. **Caching**: No Redis, dashboard regenerates every time
7. **Token Counting**: Could exceed context windows
8. **OpenAI/Anthropic/Google Integration**: Only Groq works

### Subsystem Health

| Component | Status | Notes |
|-----------|--------|-------|
| Authentication | 🟢 Green | Solid JWT implementation |
| Real-Time Messaging | 🟢 Green | WebSocket stable |
| AI Integration (Groq) | 🟢 Green | Working end-to-end |
| Project Management | 🟢 Green | Complete CRUD |
| Summary Generation | 🟢 Green | AI summaries working |
| Dashboard | 🟡 Yellow | Real data + dummy charts |
| Multi-LLM Support | 🟡 Yellow | UI ready, only Groq works |
| Document Upload | 🟡 Yellow | Works, no embeddings |
| Vector Store/RAG | 🔴 Red | Stubbed, not functional |
| AI Orchestration | 🔴 Red | Exists but bypassed |
| Email Service | 🔴 Red | Not implemented |
| Testing | 🔴 Red | No tests |
| Security | 🟡 Yellow | Auth good, keys unencrypted |

### Critical Risks

⚠️ **SECURITY**: API keys stored unencrypted in MongoDB  
⚠️ **COST**: No token counting or rate limiting on AI calls  
⚠️ **PERFORMANCE**: No caching, dashboard regenerates every load  
⚠️ **RELIABILITY**: No tests, no monitoring, no error tracking  
⚠️ **SCALABILITY**: No pagination, no batch operations  

### Production Readiness

✅ **Ready for**: Demo, pilot, internal testing  
❌ **NOT ready for**: Public launch, production deployment

**Required before production:**
1. Encrypt API keys
2. Implement rate limiting
3. Add token counting
4. Set up monitoring (Sentry, Prometheus)
5. Add comprehensive tests
6. Implement caching (Redis)
7. Complete multi-LLM integration
8. Implement real RAG with embeddings

---

## 🚀 Features

### ✅ Fully Working
- **Project-Centric Workspace**: Create projects with problem statements, invite team members
- **Shared Multi-User Chat**: Real-time collaboration with WebSocket + auto-reconnection
- **AI Integration**: Invoke CollabAI with `@CollabAI` mentions (Groq API)
- **Parallel Discussions**: Multiple focused conversations per project
- **Document Upload**: Upload text/markdown files for AI context
- **Memory & Summarization**: AI-generated summaries with refinement capability
- **Dashboard**: Real-time stats + AI insights (topics, decisions, blockers, next steps)
- **Model Selection**: UI for switching LLM providers (Server/OpenAI/Anthropic/Google)
- **Authentication**: JWT + bcrypt with role-based access (Owner/Member)

### ⚠️ Partially Working
- **Multi-LLM Support**: UI complete, but only Groq (Server) actually works
- **AI Context**: Includes documents + summaries + messages, but no semantic search
- **Discussion Graph**: Backend supports branching, frontend doesn't expose it
- **Dashboard Charts**: Real metrics work, activity charts are dummy data

### 🚧 Not Implemented
- **Vector Database**: No embeddings, no semantic search (VectorStore is stubbed)
- **OpenAI/Anthropic/Google**: Throw "coming soon" errors
- **Email Notifications**: UI exists, no backend
- **Rate Limiting**: Not enforced
- **API Key Encryption**: Stored as plain text
- **Testing**: No test suite

### 🎨 Tech Stack
- **Frontend**: React 19, WebSocket, Vite, Marked (markdown), DOMPurify
- **Backend**: Node.js, Express, WebSocket (ws library)
- **Database**: MongoDB (Mongoose)
- **AI**: Groq API (llama-3.1-8b-instant) - OpenAI/Anthropic/Google stubbed
- **Auth**: JWT tokens, bcrypt password hashing

### ⚠️ Known Limitations & Technical Debt
- **Security**: API keys stored unencrypted in MongoDB
- **Performance**: No caching (Redis), dashboard regenerates every load
- **AI**: No token counting (could exceed context limits), no rate limiting
- **RAG**: Simple "fetch last N" instead of semantic search
- **Testing**: No test suite (unit/integration/E2E)
- **Monitoring**: No APM, error tracking, or metrics
- **Multi-LLM**: Only Groq works, others throw errors
- **Code**: AIOrchestrator, VectorStore, StructuredExtractor exist but unused

## 📦 Setup

### Prerequisites
- Node.js 18+
- MongoDB (local or Atlas)
- Google Gemini API key

### Backend Setup

```bash
cd backend
npm install

# Configure environment
cp .env.example .env
# Edit .env and add:
# CHATBOT_API_KEY=your_gemini_api_key
# MONGODB_URI=mongodb://localhost:27017/collab-ai
# JWT_SECRET=your_secret_key
# PORT=8080

# Initialize database
npm run setup

# Start server
npm start
```

### Frontend Setup

```bash
cd frontend
npm install

# Start dev server
npm run dev
```

Frontend runs on `http://localhost:5173`
Backend runs on `http://localhost:8080`

## 🎮 Usage

1. **Sign Up**: Create an account
2. **Create Project**: Add title and problem statement
3. **Invite Team**: Share the invite code with 3-5 members
4. **Collaborate**: Chat in real-time, invoke AI with `@CollabAI`
5. **Upload Documents**: Add context documents for AI
6. **View Dashboard**: (Owner only) See insights, topics, decisions

## 📁 Project Structure

```
backend/
├── src/
│   ├── config/         # Database connection
│   ├── middleware/     # Auth middleware
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   └── server.js       # Main server
frontend/
├── src/
│   ├── components/     # React components
│   ├── contexts/       # Auth context
│   └── App.jsx         # Main app
```

## 🔑 Key Endpoints

### Auth
- `POST /api/auth/register` - Register user
- `POST /api/auth/login` - Login
- `GET /api/auth/verify` - Verify token

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - Get user projects
- `POST /api/projects/join` - Join via invite code
- `GET /api/projects/:id/discussions` - Get discussions
- `POST /api/projects/:id/discussions` - Create discussion
- `GET /api/projects/:id/documents` - Get documents
- `POST /api/projects/:id/documents` - Upload document
- `GET /api/projects/:id/dashboard` - Get dashboard (owner)

### WebSocket Events
- `auth` - Authenticate connection
- `join-project` - Join project discussion
- `project-chat` - Send message
- `discussion-joined` - Receive messages
- `project-chat` - Receive new message

## 🤖 AI Features

### CollabAI Invocation
Type `@CollabAI <your question>` in chat to invoke the AI.

### Context Priority (Current Implementation)
1. **Project Metadata** (title, description)
2. **Current Discussion** (title, description)
3. **Other Discussions** (summaries from parallel discussions)
4. **Uploaded Documents** (top 3, truncated to 2000 chars each)
5. **AI-Generated Summaries** (last 3 from current discussion)
6. **Recent Chat Messages** (last 30 messages)

⚠️ **Limitations:**
- No semantic search (documents fetched by recency, not relevance)
- No token counting (could exceed model context window)
- No chunking strategy (documents simply truncated)
- No embeddings (VectorStore exists but not connected)

### Server LLM
Uses Groq API (llama-3.1-8b-instant) as the default "Server" model for:
- Chat responses with @CollabAI
- Summarization
- Dashboard insights

### Multi-LLM Support (Partial)
- ✅ **Groq**: Fully working
- ❌ **OpenAI**: UI ready, throws "coming soon" error
- ❌ **Anthropic**: UI ready, throws "coming soon" error  
- ❌ **Google**: UI ready, throws "coming soon" error

API keys are stored per-project but **unencrypted** in MongoDB.

## 🎯 MVP Scope

This is an MVP built under time constraints. Focus is on:
- ✅ Working end-to-end flow (authentication → projects → discussions → AI)
- ✅ Clear value demonstration (shared AI context, real-time collaboration)
- ✅ Modular architecture (easy to extend)
- ⚠️ Some features stubbed where needed (vector DB, multi-LLM, email)

**Production-Ready For:**
- Internal demos
- Pilot programs (3-10 teams)
- Proof of concept
- Development/testing

**NOT Production-Ready For:**
- Public launch
- Large-scale deployment
- Security-critical applications
- High-traffic scenarios

**Out of Scope:**
- CRDT/Google Docs editing
- Auto conflict resolution
- AI agents talking to each other
- Production deployment infrastructure
- Enterprise compliance (SOC2, HIPAA, etc.)

## 🔧 Required Before Production

### Critical (Security & Stability)
1. ✅ Encrypt API keys at rest
2. ✅ Implement rate limiting (per-user, per-project)
3. ✅ Add token counting for AI context
4. ✅ Set up monitoring (Sentry, Prometheus)
5. ✅ Add comprehensive test suite
6. ✅ Implement caching layer (Redis)

### Important (Features & Performance)
7. ✅ Complete OpenAI/Anthropic/Google integration
8. ✅ Implement real RAG with embeddings
9. ✅ Add pagination for messages
10. ✅ Implement email notifications
11. ✅ Add discussion branching UI
12. ✅ Optimize database queries with compound indexes

### Nice to Have (UX & Polish)
13. Message editing/deletion
14. Typing indicators
15. File preview
16. Search functionality
17. Mobile responsive design
18. Dark/light theme toggle

## 📝 Notes

- Typical project size: 3-5 users
- Documents: Text or Markdown (PDF parsing not implemented)
- Embeddings: Schema ready, generation logic missing
- Dashboard: Mix of real metrics and dummy charts
- AI Model: Groq llama-3.1-8b-instant (8K context window)
- WebSocket: Auto-reconnects up to 10 times with exponential backoff

## 🏗️ Architecture Notes

### What Works Well
- Modular service layer (easy to extend)
- Centralized error handling
- Structured logging
- WebSocket connection management
- JWT authentication
- Discussion graph structure (backend)

### What Needs Work
- AIOrchestrator exists but isn't used (integrate it)
- VectorStore exists but isn't connected (implement real RAG)
- StructuredExtractor exists but isn't used (decide on extraction strategy)
- Frontend should use projectService.js instead of direct fetch()
- Remove legacy Room system (dead code)
- Consolidate AI context building logic

### Data Flow
```
User types @CollabAI
  ↓
Frontend sends via WebSocket
  ↓
connectionManager receives message
  ↓
discussionService saves to MongoDB
  ↓
aiService.buildContext() fetches:
  - Project metadata
  - Discussion info
  - Other discussions + summaries
  - Documents (top 3, truncated)
  - Summaries (last 3)
  - Recent messages (last 30)
  ↓
aiService.generateResponse() calls Groq API
  ↓
discussionService saves AI response
  ↓
WebSocket broadcasts to all clients
  ↓
Frontend updates UI
```

## 🐛 Known Limitations

### Security
- ⚠️ API keys stored unencrypted in MongoDB
- ⚠️ No rate limiting enforced (users can spam AI calls)
- ⚠️ No prompt injection protection
- ⚠️ CORS enabled for development (needs restriction in production)

### Performance
- ⚠️ No caching (dashboard regenerates every load)
- ⚠️ No pagination (messages loaded with simple limit)
- ⚠️ No batch operations (dashboard loads data sequentially)
- ⚠️ No database query optimization beyond basic indexes

### AI & Context
- ⚠️ No token counting (could exceed context window)
- ⚠️ No semantic search (documents fetched by recency)
- ⚠️ No chunking strategy (documents truncated arbitrarily)
- ⚠️ No retry logic for AI API failures
- ⚠️ Cross-discussion context loads ALL discussions (could be slow)

### Features
- ⚠️ Only Groq LLM works (OpenAI/Anthropic/Google stubbed)
- ⚠️ No email notifications (UI exists, no backend)
- ⚠️ No discussion branching UI (backend ready, frontend missing)
- ⚠️ No message editing/deletion
- ⚠️ No typing indicators
- ⚠️ Dashboard activity charts are dummy data

### Code Quality
- ⚠️ No test suite (unit/integration/E2E)
- ⚠️ No monitoring or observability
- ⚠️ AIOrchestrator, VectorStore, StructuredExtractor exist but unused (dead code)
- ⚠️ Legacy Room system still present (not used)
- ⚠️ Hardcoded URLs in frontend (should use config)

### Architecture
- ⚠️ VectorStore stubbed (no real RAG)
- ⚠️ AIOrchestrator bypassed (direct API calls instead)
- ⚠️ StructuredExtractor unused (dashboard uses AI JSON extraction)
- ⚠️ No horizontal scaling strategy
- ⚠️ No load balancing

## 📄 License

MIT
