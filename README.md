# Real-Time AI Collaborative Workspace

A real-time collaborative workspace where multiple users work together with a shared AI assistant. Built as an MVP to demonstrate team-based AI collaboration with structured memory, project documents, parallel discussions, and a manager dashboard.

## 🎯 Core Problem

Current AI platforms (ChatGPT, Claude, Gemini, DeepSeek) follow a single-user, single-LLM model. Teams brainstorm individually with AI and manually merge ideas later, leading to:
- Loss of shared context
- Inconsistent AI outputs
- Poor collective decision tracking

This project builds a **shared AI workspace** where multiple users collaborate with the SAME AI.

## 🚀 Features

### ✅ Implemented
- **Project-Centric Workspace**: Create projects with problem statements, invite team members
- **Shared Multi-User Chat**: Real-time collaboration with WebSocket
- **AI Integration**: Invoke CollabAI with `@CollabAI` mentions
- **Parallel Discussions**: Multiple focused conversations per project
- **Document Upload**: Upload and reference project documents (RAG context)
- **Memory & Summarization**: AI-generated summaries for recall
- **Dashboard**: Project owner insights (stage, topics, decisions, blockers)
- **Multi-LLM Support**: Switch between server LLM and user API keys
- **Authentication**: Email/password auth with JWT

### 🎨 Tech Stack
- **Frontend**: React.js, WebSocket, Vite
- **Backend**: Node.js, Express, WebSocket (ws)
- **Database**: MongoDB (Mongoose)
- **AI**: Google Gemini (server LLM), extensible to OpenAI/Claude
- **Auth**: JWT tokens

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

### Context Priority (RAG)
1. **Uploaded Documents** (highest priority)
2. **AI-Generated Summaries**
3. **Recent Chat Messages**

### Server LLM
Uses your Gemini API key as the "in-house" server LLM for:
- Summarization
- Dashboard insights
- Default AI responses

## 🎯 MVP Scope

This is an MVP built under time constraints. Focus is on:
- ✅ Working end-to-end flow
- ✅ Clear value demonstration
- ✅ Convincing stubbed features where needed

**Out of Scope:**
- CRDT/Google Docs editing
- Auto conflict resolution
- AI agents talking to each other
- Production deployment
- Enterprise compliance

## 📝 Notes

- Typical project size: 3-5 users
- Documents: PDF or plain text (simplified for MVP)
- Embeddings: Can be mocked/simplified
- Dashboard: Hybrid refresh (button + periodic)

## 🐛 Known Limitations

- No real-time typing indicators
- Basic document parsing (text only)
- Simplified RAG (no vector DB)
- Dashboard insights may be basic
- No file size limits enforced

## 📄 License

MIT
