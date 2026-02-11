import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/database.js";

// Routes
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';

// Services
import projectService from './services/projectService.js';
import discussionService from './services/discussionService.js';
import aiService from './services/aiService.js';
import authService from './services/authService.js';

// Legacy support
import messageService from "./services/messageService.js";
import roomService from "./services/roomService.js";
import userService from "./services/userService.js";

dotenv.config();

// Connect to MongoDB
await connectDB();

// Initialize default rooms (legacy)
await roomService.initializeDefaultRooms();

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.CHATBOT_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Missing CHATBOT_API_KEY in .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' })); // For document uploads

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);

// Legacy API Routes (keep for backward compatibility)
app.get('/api/messages', async (req, res) => {
  try {
    const { roomId = 'general', limit = 50, skip = 0 } = req.query;
    const messages = await messageService.getAllMessages(roomId, parseInt(limit), parseInt(skip));
    res.json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/rooms', async (req, res) => {
  try {
    const rooms = await roomService.getAllRooms();
    const roomStats = await messageService.getRoomsWithStats();
    
    const roomsWithStats = rooms.map(room => {
      const stats = roomStats.find(s => s.roomId === room.name) || { messageCount: 0 };
      return { ...room, ...stats };
    });
    
    res.json({ success: true, rooms: roomsWithStats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/rooms', async (req, res) => {
  try {
    const { name, description, createdBy } = req.body;
    const room = await roomService.createRoom(name, description, createdBy);
    res.json({ success: true, room });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const { roomId } = req.query;
    const messageCount = await messageService.getMessageCount(roomId);
    res.json({ success: true, stats: { messageCount } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/messages/cleanup', async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const deletedCount = await messageService.deleteOldMessages(parseInt(days));
    res.json({ success: true, deletedCount });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/online', async (req, res) => {
  try {
    const users = await userService.getOnlineUsers();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/users/stats', async (req, res) => {
  try {
    const users = await userService.getAllUsersWithStats();
    res.json({ success: true, users });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// HTTP Server
const server = app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);

// WebSocket Server
const wss = new WebSocketServer({ server });

// Store client connections with metadata
const clients = new Map(); // ws -> { userId, username, projectId, discussionId, roomId }

// Periodic cleanup
setInterval(async () => {
  await userService.cleanupOfflineUsers(5);
}, 2 * 60 * 1000);

// Broadcast helpers
function broadcastToRoom(roomId, payload) {
  clients.forEach((meta, ws) => {
    if (ws.readyState === 1 && meta.roomId === roomId) {
      ws.send(JSON.stringify(payload));
    }
  });
}

function broadcastToDiscussion(discussionId, payload) {
  clients.forEach((meta, ws) => {
    if (ws.readyState === 1 && meta.discussionId === discussionId) {
      ws.send(JSON.stringify(payload));
    }
  });
}

wss.on("connection", async (ws) => {
  console.log("🔗 New WebSocket client connected");
  
  // Initialize client metadata
  clients.set(ws, { roomId: 'general' });

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      const clientMeta = clients.get(ws);

      // Handle authentication
      if (data.type === "auth") {
        try {
          const decoded = authService.verifyToken(data.token);
          clientMeta.userId = decoded.userId;
          clientMeta.username = decoded.username;
          
          ws.send(JSON.stringify({ 
            type: "auth-success", 
            user: { userId: decoded.userId, username: decoded.username }
          }));
        } catch (error) {
          ws.send(JSON.stringify({ type: "auth-error", error: "Invalid token" }));
        }
        return;
      }

      // Handle project context switch
      if (data.type === "join-project") {
        const { projectId, discussionId } = data;
        
        // Verify membership
        if (clientMeta.userId) {
          const isMember = await projectService.isProjectMember(projectId, clientMeta.userId);
          if (!isMember) {
            ws.send(JSON.stringify({ type: "error", message: "Not a project member" }));
            return;
          }
        }

        clientMeta.projectId = projectId;
        clientMeta.discussionId = discussionId;

        // Send discussion messages
        const messages = await discussionService.getDiscussionMessages(discussionId, 50);
        const formattedMessages = messages.map(m => ({
          user: m.user,
          text: m.text,
          time: m.timestamp,
          isAI: m.isAI
        }));

        ws.send(JSON.stringify({ 
          type: "discussion-joined", 
          messages: formattedMessages,
          discussionId
        }));
        return;
      }

      // Handle project chat messages
      if (data.type === "project-chat") {
        const { text } = data;
        const { projectId, discussionId, userId, username } = clientMeta;

        if (!projectId || !discussionId) {
          ws.send(JSON.stringify({ type: "error", message: "Not in a project discussion" }));
          return;
        }

        // Save message
        const message = await discussionService.addMessage(
          discussionId,
          projectId,
          userId,
          username,
          text,
          false
        );

        // Broadcast to discussion
        broadcastToDiscussion(discussionId, {
          type: "project-chat",
          message: {
            user: message.user,
            text: message.text,
            time: message.timestamp,
            isAI: false
          }
        });

        // Check for AI invocation
        if (text.startsWith("@CollabAI")) {
          const prompt = text.replace("@CollabAI", "").trim();
          
          // Get project config
          const project = await projectService.getProjectById(projectId);
          
          // Generate AI response
          const aiReply = await aiService.generateResponse(
            projectId,
            discussionId,
            prompt,
            project.activeLLM
          );

          // Save AI message
          const aiMessage = await discussionService.addMessage(
            discussionId,
            projectId,
            null,
            "CollabAI",
            aiReply,
            true
          );

          // Broadcast AI response
          broadcastToDiscussion(discussionId, {
            type: "project-chat",
            message: {
              user: aiMessage.user,
              text: aiMessage.text,
              time: aiMessage.timestamp,
              isAI: true
            }
          });
        }

        return;
      }

      // Legacy room-based chat (backward compatibility)
      if (data.type === "join-room") {
        const roomId = data.roomId || 'general';
        clientMeta.roomId = roomId;
        
        const recentMessages = await messageService.getRecentMessages(roomId, 50);
        const formattedMessages = recentMessages.map(msg => ({
          user: msg.user,
          text: msg.text,
          time: msg.timestamp,
          roomId: msg.roomId
        }));
        
        ws.send(JSON.stringify({ 
          type: "room-switched", 
          messages: formattedMessages, 
          currentRoom: roomId 
        }));
        return;
      }

      if (data.type === "chat") {
        const currentRoom = clientMeta.roomId || 'general';
        
        await userService.getOrCreateUser(data.user);
        const savedMessage = await messageService.createMessage(data.user, data.text, currentRoom);
        await userService.incrementMessageCount(data.user);
        await roomService.updateRoomActivity(currentRoom);
        
        const message = { 
          user: savedMessage.user, 
          text: savedMessage.text, 
          time: savedMessage.timestamp,
          roomId: savedMessage.roomId
        };
        
        broadcastToRoom(currentRoom, { type: "chat", message });

        // Legacy AI trigger
        if (data.text.startsWith("@CollabAI")) {
          const prompt = data.text.replace("@CollabAI", "").trim();
          const recentMessages = await messageService.getRecentMessages(currentRoom, 20);
          const contextMessages = recentMessages.map(msg => ({
            user: msg.user,
            text: msg.text,
            time: msg.timestamp
          }));

          // Use server LLM for legacy mode
          const project = { activeLLM: { provider: 'server', model: 'gemini-2.0-flash' } };
          const aiReply = await aiService.generateResponse(
            null,
            null,
            prompt,
            project.activeLLM
          );

          const aiSavedMessage = await messageService.createMessage("CollabAI", aiReply, currentRoom);
          
          const aiMessage = {
            user: aiSavedMessage.user,
            text: aiSavedMessage.text,
            time: aiSavedMessage.timestamp,
            roomId: aiSavedMessage.roomId
          };
          
          broadcastToRoom(currentRoom, { type: "chat", message: aiMessage });
        }
      }

    } catch (error) {
      console.error("Error handling message:", error);
      ws.send(JSON.stringify({ 
        type: "error", 
        message: "Failed to process message" 
      }));
    }
  });

  // Send initial data (legacy mode)
  try {
    const rooms = await roomService.getAllRooms();
    ws.send(JSON.stringify({ type: "rooms", rooms }));
    
    const recentMessages = await messageService.getRecentMessages('general', 50);
    const formattedMessages = recentMessages.map(msg => ({
      user: msg.user,
      text: msg.text,
      time: msg.timestamp,
      roomId: msg.roomId
    }));
    
    ws.send(JSON.stringify({ type: "init", messages: formattedMessages, currentRoom: 'general' }));
  } catch (error) {
    console.error("Error loading initial data:", error);
  }

  ws.on('close', () => {
    clients.delete(ws);
  });
});

console.log("🚀 CollabAI Server ready with project support");
