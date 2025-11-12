import express from "express";
import { WebSocketServer } from "ws";
import cors from "cors";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

const PORT = process.env.PORT || 8080;
const GEMINI_KEY = process.env.CHATBOT_API_KEY;

if (!GEMINI_KEY) {
  console.error("❌ Missing CHATBOT_API_KEY in .env");
  process.exit(1);
}

const app = express();
app.use(cors());

// --- Gemini setup ---
const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

// --- HTTP + WebSocket ---
const server = app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
const wss = new WebSocketServer({ server });

let messages = []; // in-memory chat history

// Broadcast helper
function broadcast(payload) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(JSON.stringify(payload));
  });
}

wss.on("connection", (ws) => {
  console.log("🔗 New WebSocket client connected");
  ws.send(JSON.stringify({ type: "init", messages }));

  ws.on("message", async (msg) => {
    const data = JSON.parse(msg);
    if (data.type !== "chat") return;

    const message = { user: data.user, text: data.text, time: Date.now() };
    messages.push(message);
    broadcast({ type: "chat", message });

    // --- AI Trigger ---
    if (data.text.startsWith("@CollabAI")) {
      const prompt = data.text.replace("@CollabAI", "").trim();

      // Generate context-aware reply
      const aiReply = await callGeminiWithContext(prompt, messages);

      const aiMessage = {
        user: "CollabAI 🤖",
        text: aiReply,
        time: Date.now(),
      };
      messages.push(aiMessage);
      broadcast({ type: "chat", message: aiMessage });
    }
  });
});

// --- Gemini contextual chat ---
async function callGeminiWithContext(prompt, fullMessages) {
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

    // Convert our in-memory chat into Gemini's history format
    const history = [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        ...fullMessages.map((m) => ({
          role: m.user === "CollabAI 🤖" ? "model" : "user",
          parts: [{ text: `${m.user}: ${m.text}` }],
        })),
      ];
      

    // Start a chat with all previous messages
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
