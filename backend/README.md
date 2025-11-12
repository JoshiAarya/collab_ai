# CollabAI Backend

Real-time collaborative chat application with AI integration and MongoDB persistence.

## Features

- Real-time WebSocket messaging
- MongoDB persistent storage
- Google Gemini AI integration
- RESTful API endpoints
- Message history and context

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
MONGODB_URI=mongodb://localhost:27017/collab-chat
```

### 3. MongoDB Setup

**Option A: Local MongoDB**
- Install MongoDB locally
- Start MongoDB service
- Database will be created automatically

**Option B: MongoDB Atlas (Cloud)**
- Create free account at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create cluster and get connection string
- Update `MONGODB_URI` in `.env`

### 4. Database Initialization
```bash
npm run setup
```

### 5. Start Server
```bash
npm start        # Production
npm run dev      # Development with nodemon
```

## API Endpoints

- `GET /api/messages` - Get message history
- `GET /api/stats` - Get database statistics  
- `DELETE /api/messages/cleanup` - Clean old messages

## WebSocket Events

- `init` - Send recent messages to new clients
- `chat` - Handle incoming messages
- `error` - Error notifications

## Project Structure

```
backend/
├── config/
│   └── database.js      # MongoDB connection
├── models/
│   └── Message.js       # Message schema
├── services/
│   └── messageService.js # Database operations
├── scripts/
│   └── setup.js         # Database setup
└── index.js             # Main server file
```

## MongoDB Schema

### Messages Collection
```javascript
{
  _id: ObjectId,
  user: String,           # Username
  text: String,           # Message content
  timestamp: Number,      # Unix timestamp
  createdAt: Date,        # Auto-generated
  updatedAt: Date         # Auto-generated
}
```

## Development

The application uses Mongoose ODM for MongoDB operations with:
- Automatic connection management
- Schema validation
- Indexing for performance
- Error handling
- Graceful shutdown