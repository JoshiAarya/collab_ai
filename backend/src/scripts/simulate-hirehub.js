/**
 * simulate-hirehub.js
 *
 * nk and pk building a real-time multiplayer quiz platform — CodeDuel.
 * Players join rooms, get the same coding question simultaneously,
 * submit solutions, and get ranked by correctness + speed.
 *
 * System areas covered (intentionally distinct):
 *   - Room & matchmaking
 *   - Code execution / sandboxing
 *   - Real-time sync
 *   - Scoring & leaderboard
 *   - Question bank
 *
 * Usage:
 *   node src/scripts/simulate-hirehub.js
 *   node src/scripts/simulate-hirehub.js --reset
 *   node src/scripts/simulate-hirehub.js --delay=0
 */

import 'dotenv/config';
import connectDB from '../config/database.js';
import authService from '../services/authService.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import AIOrchestrator from '../core/orchestrator/AIOrchestrator.js';
import Project from '../models/Project.js';

const args     = process.argv.slice(2);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
const RESET    = process.env.RESET === 'true' || args.includes('--reset');

const PROJECT_TITLE = 'CodeDuel';
const PROJECT_DESC  =
  'A real-time multiplayer coding challenge platform where two players join a room, ' +
  'receive the same algorithmic problem simultaneously, write solutions in-browser, ' +
  'and get ranked by correctness and time-to-solve. Supports Python, JavaScript, and Java.';

const CONVERSATION = [
  { user: 'nk', text: "So the core loop is: two players join a room, they both get the same question at the exact same time, they code, they submit, we rank them." },
  { user: 'pk', text: "The hardest part is the simultaneous question delivery. If one player gets it 200ms before the other, the whole fairness model breaks." },
  { user: 'nk', text: "We use WebSockets for the room. When both players are connected and ready, the server emits the question to both in a single broadcast event." },
  { user: 'pk', text: "What about the matchmaking? Do we do skill-based or just first-come-first-served?" },
  { user: 'nk', text: "Start with a simple queue — first two players waiting get matched. We can add ELO-based matching later once we have enough users." },
  { user: 'pk', text: "The code execution is the scary part. We can't just run arbitrary user code on the server. One infinite loop and the whole thing goes down." },
  { user: 'nk', text: "We run each submission inside a Docker container with a hard 5-second CPU timeout and 64MB memory limit. Kill the container after." },
  { user: 'pk', text: "Spinning up a Docker container per submission is going to be too slow. Cold start is like 800ms minimum." },
  { user: 'nk', text: "We keep a pool of warm containers — say 10 pre-started ones per language. Assign one to a submission, run it, recycle it back to the pool." },
  { user: 'pk', text: "How do we prevent a submission from reading files or making network calls? Just the timeout isn't enough." },
  { user: 'nk', text: "We use seccomp profiles to block all syscalls except the ones needed to run the code. No file I/O, no network, no fork." },
  { user: 'pk', text: "Actually I looked into it more — Docker with seccomp still has too much attack surface for untrusted code. We should use Firecracker microVMs instead." },
  { user: 'nk', text: "You're right. Firecracker boots in under 125ms, has a minimal attack surface, and gives us proper VM-level isolation. We switch to Firecracker for code execution." },
  { user: 'pk', text: "OK so the execution is isolated. Now the scoring — how do we rank? Just who finishes first?" },
  { user: 'nk', text: "Correctness first, then time. If both players pass all test cases, the faster one wins. If one fails, the other wins regardless of time." },
  { user: 'pk', text: "We need to store the test cases somewhere. And they need to be hidden from the client — can't just send them with the question." },
  { user: 'nk', text: "Test cases live in the database, never sent to the client. The execution container fetches them server-side and runs the submission against them." },
  { user: 'pk', text: "What database are we using for the question bank? These questions have structured data — title, description, constraints, test cases, difficulty." },
  { user: 'nk', text: "We use MongoDB for the question bank. Each question is a document with embedded test cases. Easy to query by difficulty and tag." },
  { user: 'pk', text: "Wait — we're going to need to do complex queries on questions. Filter by difficulty AND tag AND not-seen-by-user. MongoDB's query planner is going to struggle with that compound index." },
  { user: 'nk', text: "Good point. We switch to Postgres for the question bank. Questions and test cases as separate tables with foreign keys. The compound queries will be much cleaner." },
  { user: 'pk', text: "And for the leaderboard? We need fast reads — top 100 players globally, and per-room rankings during a live match." },
  { user: 'nk', text: "We keep a sorted set in Redis for the global leaderboard. Score is ELO rating. Reads are O(log n) and writes are instant." },
  { user: 'pk', text: "The per-room leaderboard during a live match is different — it's just two players, updated in real time as they submit." },
  { user: 'nk', text: "That's just a WebSocket broadcast. When player A submits and passes, we immediately push their result to both clients. No database needed for that." },
  { user: 'pk', text: "What about reconnection? If a player's connection drops mid-match, do they lose?" },
  { user: 'nk', text: "We give them a 30-second reconnect window. The room state is held in memory on the server. If they reconnect within 30s, they resume. After that, forfeit." },
  { user: 'pk', text: "Room state in memory is risky if the server restarts. Should we persist it somewhere?" },
  { user: 'nk', text: "We write room state to Redis with a 10-minute TTL. On reconnect, the server checks Redis first before declaring a forfeit." },
  { user: 'pk', text: "The question selection — do we pick randomly or do we track which questions a user has already seen?" },
  { user: 'nk', text: "We track seen questions per user in Postgres. When starting a match, we pick a question that neither player has seen before at the requested difficulty." },
  { user: 'pk', text: "What if there are no unseen questions left at that difficulty? The question bank will run dry for active users." },
  { user: 'nk', text: "We reset the seen list once a user has seen 80% of questions at a difficulty. Treat it like a deck — reshuffle when almost exhausted." },
  { user: 'pk', text: "For the code editor in the browser, are we building our own or using something off the shelf?" },
  { user: 'nk', text: "We embed Monaco Editor — same engine as VS Code. It gives us syntax highlighting, autocomplete, and keybindings for free." },
  { user: 'pk', text: "Monaco is heavy. Initial load is going to be slow on bad connections." },
  { user: 'nk', text: "We lazy-load it. The landing page and matchmaking screen load fast. Monaco only loads when the player is actually in a room and the match starts." },
  { user: 'pk', text: "One more thing — spectator mode. Can people watch a live match without playing?" },
  { user: 'nk', text: "Yes, spectators join the room WebSocket as read-only subscribers. They get all the same events but can't submit. We cap spectators at 50 per room." },
  { user: 'pk', text: "Alright. So the order is: WebSocket room system first, then code execution sandbox, then scoring, then leaderboard, then question bank tooling." },
  { user: 'nk', text: "Agreed. I'll start on the room and matchmaking WebSocket server. You set up the Firecracker microVM pool for execution." },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Logger — captures ALL output (stdout + stderr) to log file ───────────────
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Manual Decision Extraction ──────────────────────────────────────────────
async function triggerDecisionAPI(projectId, messageId, text, username, discussionId) {
  const isDecision = /we will|we should|i'll write|in postgres|we need|let's use|we keep 5|we switch|we write/i.test(text);
  if (!isDecision) return;

  try {
    const AIOrchestrator = (await import('../core/orchestrator/AIOrchestrator.js')).default;
    const Decision = (await import('../models/Decision.js')).default;
    const EmbeddingService = (await import('../core/embeddings/EmbeddingService.js')).default;
    const User = (await import('../models/User.js')).default;

    const user = await User.findOne({ username });

    const prompt = `You are normalizing a raw engineering conversation message into a clean decision record.
Speaker: ${username}
Raw message: "${text}"

Write a single clean declarative statement capturing the decision made. Rules:
- Start with a verb or technology name
- Maximum 15 words
- Never use first person
- Never quote the raw text verbatim
- If the message contains a clear reason, extract it as rationale separately

Return ONLY valid JSON with no markdown: {"text": "...", "rationale": "..."}
Rationale can be empty string if no clear reason given.`;

    const response = await AIOrchestrator.callProvider({
        requestId: require('crypto').randomUUID(),
        provider: 'groq',
        model: 'llama-3.1-8b-instant',
        prompt,
        projectId,
        userId: user._id,
        maxTokens: 1024
    });

    let parsed;
    try {
      const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch(e) {
      write('         ↳ error parsing LLM response\n');
      return;
    }

    const decision = await Decision.create({
      projectId,
      text: parsed.text,
      rationale: parsed.rationale || '',
      proposedBy: {
        userId: user._id,
        username
      },
      sourceMessageId: messageId,
      discussionId
    });

    // Embed the decision for semantic retrieval
    try {
      const textToEmbed = parsed.text + (parsed.rationale ? '. ' + parsed.rationale : '');
      const embedding = await EmbeddingService.embedText(textToEmbed);
      if (embedding) {
        await Decision.findByIdAndUpdate(decision._id, { embedding, embeddingStatus: 'done' });
      }
    } catch (embedErr) {
      await Decision.findByIdAndUpdate(decision._id, { embeddingStatus: 'failed' });
    }
    write(`         ↳ decision saved: ${parsed.text.substring(0, 40)}\n`);
  } catch (err) {
    write(`         ↳ decision fail: ${err.message}\n`);
  }
}
const LOG_FILE = path.join(__dirname, '../../../simulate-codeduel.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

// Intercept all stdout/stderr so logger output is also captured
const origStdoutWrite = process.stdout.write.bind(process.stdout);
const origStderrWrite = process.stderr.write.bind(process.stderr);
process.stdout.write = (chunk, ...args) => { logStream.write(chunk); return origStdoutWrite(chunk, ...args); };
process.stderr.write = (chunk, ...args) => { logStream.write(chunk); return origStderrWrite(chunk, ...args); };

function write(line) { process.stdout.write(line); }
function log(msg) { write(`[simulate-codeduel] ${msg}\n`); }

async function getOrCreateUser(username) {
  const User = (await import('../models/User.js')).default;
  const existing = await User.findOne({ username }).lean();
  if (existing) { log(`Found existing user: ${username}`); return existing; }
  const result = await authService.register(username, `${username}@codeduel.test`, 'Test1234!');
  log(`Created user: ${username}`);
  return result.user;
}

async function main() {
  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: PROJECT_TITLE });
    if (deleted.deletedCount) log(`Deleted existing project "${PROJECT_TITLE}"`);
  }

  const nk = await getOrCreateUser('nk');
  const pk = await getOrCreateUser('pk');
  const userMap = { nk, pk };

  let project;
  const existing = await Project.findOne({ title: PROJECT_TITLE }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(PROJECT_TITLE, PROJECT_DESC, nk._id);
    log(`Created project: ${project._id}`);
  }

  try { await projectService.joinProject(project.inviteCode, pk._id); log('pk joined'); }
  catch { log('pk already a member'); }

  const discussions = await discussionService.getProjectDiscussions(project._id);
  let discussion = discussions.find(d => d.isMain) || discussions[0];
  if (!discussion) {
    discussion = await discussionService.createDiscussion(project._id, 'Main', '', nk._id, nk._id);
    log(`Created discussion: ${discussion._id}`);
  } else {
    log(`Using discussion: ${discussion._id}`);
  }

  try { await discussionService.joinDiscussion(discussion._id, pk._id); } catch { /* already in */ }

  const fullProject = await projectService.getProjectById(project._id);
  const llmConfig =  { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}\n`);
  log(`Replaying ${CONVERSATION.length} messages (delay: ${DELAY_MS}ms)...\n`);

  for (let i = 0; i < CONVERSATION.length; i++) {
    const { user: username, text } = CONVERSATION[i];
    const user = userMap[username];

    const message = await discussionService.addMessage(
      discussion._id, project._id, user._id, username, text, false
    );

    write(`  [${String(i + 1).padStart(2, '0')}/${CONVERSATION.length}] ${username}: ${text.substring(0, 72)}...\n`);

    await triggerDecisionAPI(project._id, message._id, text, username, discussion._id);
    
    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  log('\nDone. Open the dashboard to see results.');
  log(`Project ID: ${project._id}`);
  log(`Full log saved to: ${LOG_FILE}`);
  logStream.end();
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
