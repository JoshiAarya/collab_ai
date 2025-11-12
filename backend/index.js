import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import connectDB from "./config/database.js";
import messageService from "./services/messageService.js";
import roomService from "./services/roomService.js";
import userService from "./services/userService.js";

dotenv.config();

// Connect to MongoDB
await connectDB();

// Initialize default rooms
await roomService.initializeDefaultRooms();

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.CHATBOT_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Missing CHATBOT_API_KEY in .env");
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// API Routes for message management
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
    
    // Merge room data with stats
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

// User management endpoints
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

// --- Gemini setup ---
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- HTTP + WebSocket ---
const server = app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
const wss = new WebSocketServer({ server });

// Periodic cleanup of offline users (every 2 minutes)
setInterval(async () => {
  await userService.cleanupOfflineUsers(5); // Mark as offline after 5 minutes
}, 2 * 60 * 1000);



// Store client room subscriptions
const clientRooms = new Map();

// Broadcast helper for specific rooms
function broadcastToRoom(roomId, payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1 && clientRooms.get(client) === roomId) {
      client.send(JSON.stringify(payload));
    }
  });
}

wss.on("connection", async (ws) => {
  console.log("🔗 New WebSocket client connected");
  
  // Default to general room
  clientRooms.set(ws, 'general');
  
  try {
    // Send available rooms
    const rooms = await roomService.getAllRooms();
    ws.send(JSON.stringify({ type: "rooms", rooms }));
    
    // Send recent messages for general room
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
    ws.send(JSON.stringify({ type: "init", messages: [], rooms: [] }));
  }

  ws.on("message", async (msg) => {
    try {
      const data = JSON.parse(msg);
      
      // Handle room switching
      if (data.type === "join-room") {
        const roomId = data.roomId || 'general';
        clientRooms.set(ws, roomId);
        
        // Send recent messages for the new room
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
      
      // Handle chat messages
      if (data.type === "chat") {
        const currentRoom = clientRooms.get(ws) || 'general';
        
        // Get or create user
        await userService.getOrCreateUser(data.user);
        
        // Save message to database
        const savedMessage = await messageService.createMessage(data.user, data.text, currentRoom);
        
        // Update user stats and room activity
        await userService.incrementMessageCount(data.user);
        await roomService.updateRoomActivity(currentRoom);
        
        const message = { 
          user: savedMessage.user, 
          text: savedMessage.text, 
          time: savedMessage.timestamp,
          roomId: savedMessage.roomId
        };
        
        broadcastToRoom(currentRoom, { type: "chat", message });

        // --- AI Trigger ---
        if (data.text.startsWith("@CollabAI")) {
          const prompt = data.text.replace("@CollabAI", "").trim();

          // Get recent messages for context from current room
          const recentMessages = await messageService.getRecentMessages(currentRoom, 20);
          const contextMessages = recentMessages.map(msg => ({
            user: msg.user,
            text: msg.text,
            time: msg.timestamp
          }));

          // Generate context-aware reply
          const aiReply = await callGeminiWithContext(prompt, contextMessages);

          // Save AI response to database
          const aiSavedMessage = await messageService.createMessage("CollabAI 🤖", aiReply, currentRoom);
          
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
  
  // Clean up on disconnect
  ws.on('close', () => {
    clientRooms.delete(ws);
  });
});

// --- Gemini contextual chat ---
async function callGeminiWithContext(prompt, contextMessages) {
  try {
    console.log("💭 Building context for Gemini...");
    const SYSTEM_PROMPT = `
        You are CollabAI — an intelligent, real-time collaborative assistant in a multi-user workspace.
        You see multiple participants (User123, User456, etc.) working together.
        - Always respond as a helpful, neutral AI facilitator.
        - You can refer to users by their names if relevant.
        - Focus on summarizing, suggesting next steps, or solving problems, not meta commentary.
        - Be concise, natural, and context-aware.
        `;

    // Convert chat messages into Gemini's history format
    const history = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        ...contextMessages.map((m) => ({
          role: m.user === "CollabAI 🤖" ? "model" : "user",
          parts: [{ text: `${m.user}: ${m.text}` }],
        })),
      ];

    // Start a chat with context
    const chat = model.startChat({ history });

    // Send new user message
    const result = await chat.sendMessage(prompt);
    const reply = result.response.text();

    console.log("🧠 Gemini reply:", reply);
    return reply;
  } catch (err) {
    console.error("⚠️ Gemini error:", err.message);
    return "Sorry, CollabAI couldn't process that right now.";
  }
}
