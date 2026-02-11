# CollabAI Backend

Real-time collaborative AI workspace backend with MongoDB persistence, WebSocket messaging, and multi-LLM support.

## Features

- **Real-time WebSocket messaging** for project discussions
- **MongoDB persistent storage** for projects, messages, documents
- **Google Gemini AI integration** (server LLM)
- **Multi-LLM support** (extensible to OpenAI, Claude, etc.)
- **JWT authentication** with email/password
- **Project-based collaboration** with invite codes
- **Document upload & RAG** for context-aware AI
- **Dashboard insights** for project owners
- **Parallel discussions** within projects

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and configure:

```env
CHATBOT_API_KEY=your_google_gemini_api_key
PORT=8080
MONGODB_URI=mongodb://localhost:27017/collab-ai
JWT_SECRET=your_super_secret_jwt_key
```

### 3. MongoDB Setup

**Option A: Local MongoDB**
- Install MongoDB locally
- Start MongoDB service: `mongod`
- Database will be created automatically

**Option B: MongoDB Atlas (Cloud)**
- Create free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create cluster and get connection string
- Update `MONGODB_URI` in `.env`

### 4. Database Initialization
```bash
npm run setup
```

This creates default rooms for backward compatibility.

### 5. Start Server
```bash
npm start        # Production
npm run dev      # Development with nodemon
```

Server runs on `http://localhost:8080`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/verify` - Verify JWT token
- `POST /api/auth/google` - Google OAuth (stubbed)

### Projects
- `POST /api/projects` - Create new project
- `GET /api/projects` - Get user's projects
- `GET /api/projects/:id` - Get project details
- `PATCH /api/projects/:id` - Update project (owner only)
- `POST /api/projects/join` - Join project via invite code

### Discussions
- `GET /api/projects/:id/discussions` - Get project discussions
- `POST /api/projects/:id/discussions` - Create parallel discussion

### Documents
- `GET /api/projects/:id/documents` - Get project documents
- `POST /api/projects/:id/documents` - Upload document

### Summaries
- `GET /api/projects/:id/summaries` - Get project summaries
- `POST /api/projects/:id/discussions/:discussionId/summarize` - Generate summary

### Dashboard
- `GET /api/projects/:id/dashboard` - Get dashboard insights (owner only)

### Legacy (Backward Compatibility)
- `GET /api/messages` - Get message history
- `GET /api/rooms` - Get rooms
- `POST /api/rooms` - Create room
- `GET /api/users/online` - Get online users

## WebSocket Events

### Client → Server
- `auth` - Authenticate with JWT token
- `join-project` - Join project discussion
- `project-chat` - Send message in project
- `join-room` - Join legacy room (backward compat)
- `chat` - Send legacy chat message

### Server → Client
- `auth-success` - Authentication successful
- `discussion-joined` - Joined discussion with message history
- `project-chat` - New message in project discussion
- `room-switched` - Switched to different room (legacy)
- `chat` - New chat message (legacy)
- `error` - Error notification

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── database.js          # MongoDB connection
│   ├── middleware/
│   │   └── auth.js              # JWT authentication
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Project.js           # Project schema
│   │   ├── Discussion.js        # Discussion schema
│   │   ├── Message.js           # Message schema
│   │   ├── Document.js          # Document schema
│   │   ├── Summary.js           # Summary schema
│   │   └── Room.js              # Room schema (legacy)
│   ├── routes/
│   │   ├── auth.js              # Auth endpoints
│   │   └── projects.js          # Project endpoints
│   ├── services/
│   │   ├── authService.js       # Auth logic
│   │   ├── projectService.js    # Project logic
│   │   ├── discussionService.js # Discussion logic
│   │   ├── messageService.js    # Message logic
│   │   ├── documentService.js   # Document logic
│   │   ├── summaryService.js    # Summary logic
│   │   ├── aiService.js         # AI integration
│   │   ├── roomService.js       # Room logic (legacy)
│   │   └── userService.js       # User logic
│   ├── scripts/
│   │   └── setup.js             # Database setup
│   └── server.js                # Main server file
├── .env.example                 # Environment template
├── package.json
└── README.md
```

## MongoDB Schemas

### User
```javascript
{
  username: String,
  email: String (unique),
  password: String (hashed),
  projects: [ObjectId],
  createdAt: Date
}
```

### Project
```javascript
{
  title: String,
  problemStatement: String,
  ownerId: ObjectId,
  members: [{ userId, role }],
  inviteCode: String (unique),
  stage: String (ideation/design/discussion/blocked),
  activeLLM: { provider, model, apiKey },
  createdAt: Date
}
```

### Discussion
```javascript
{
  projectId: ObjectId,
  title: String,
  description: String,
  isMain: Boolean,
  participants: [ObjectId],
  lastActivity: Date,
  messageCount: Number
}
```

### Message
```javascript
{
  discussionId: ObjectId,
  projectId: ObjectId,
  userId: ObjectId,
  user: String,
  text: String,
  timestamp: Number,
  isAI: Boolean
}
```

### Document
```javascript
{
  projectId: ObjectId,
  title: String,
  content: String,
  fileType: String,
  uploadedBy: ObjectId,
  uploadedAt: Date
}
```

### Summary
```javascript
{
  projectId: ObjectId,
  discussionId: ObjectId,
  content: String,
  type: String (discussion/project),
  generatedBy: String (llm provider),
  createdAt: Date
}
```

## AI Service

### Context Building (RAG)
Priority order:
1. **Documents** - Uploaded project documents
2. **Summaries** - AI-generated summaries
3. **Recent Messages** - Last N messages from discussion

### LLM Providers
- **Server LLM**: Uses your Gemini API key (default)
- **User LLMs**: OpenAI, Claude (stubbed for MVP)

### AI Features
- **Chat responses**: Context-aware replies with `@CollabAI`
- **Summarization**: Generate discussion summaries
- **Dashboard insights**: Extract topics, decisions, blockers

## Development

### Running Tests
```bash
npm test  # Not implemented yet
```

### Database Management
```bash
# Clean old messages (legacy)
curl -X DELETE "http://localhost:8080/api/messages/cleanup?days=30"

# Get stats
curl "http://localhost:8080/api/stats"
```

### Debugging
- Check MongoDB connection: Logs show "✅ MongoDB connected"
- Check WebSocket: Logs show "🔗 New WebSocket client connected"
- Check AI: Logs show "💭 Building context for Gemini..."

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `CHATBOT_API_KEY` | Google Gemini API key | Yes |
| `PORT` | Server port | No (default: 8080) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing | Yes |

## Security Notes

- Passwords are hashed with bcrypt
- JWT tokens expire (configurable)
- API keys stored encrypted (TODO for production)
- CORS enabled for development (restrict in production)

## Performance

- WebSocket for real-time updates (low latency)
- MongoDB indexes on frequently queried fields
- Message history limited to recent N messages
- Document content truncated for AI context

## Troubleshooting

**MongoDB connection failed**
- Check MongoDB is running: `mongod`
- Verify connection string in `.env`

**AI not responding**
- Check `CHATBOT_API_KEY` is set
- Verify Gemini API quota

**WebSocket not connecting**
- Check CORS settings
- Verify frontend URL matches

**Authentication failing**
- Check `JWT_SECRET` is set
- Verify token format: `Bearer <token>`

## Future Enhancements

- [ ] Vector database for better RAG
- [ ] OpenAI/Claude integration
- [ ] Real-time typing indicators
- [ ] File upload (PDF parsing)
- [ ] Email notifications
- [ ] Rate limiting
- [ ] API key encryption
- [ ] Comprehensive tests
