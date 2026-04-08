import 'dotenv/config';
import connectDB from '../../config/database.js';
import authService from '../../services/authService.js';
import projectService from '../../services/projectService.js';
import discussionService from '../../services/discussionService.js';
import InsightExtractor from '../../core/intelligence/InsightExtractor.js';
import KnowledgeAggregator from '../../core/intelligence/KnowledgeAggregator.js';
import AIOrchestrator from '../../core/orchestrator/AIOrchestrator.js';
import SignalClassifier from '../../core/extraction/SignalClassifier.js';
import SignalBuffer from '../../core/extraction/SignalBuffer.js';
import SignalNormalizer from '../../core/extraction/SignalNormalizer.js';
import Project from '../../models/Project.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function runSimulation({ projectTitle, projectDesc, usersToCreate, conversations }) {
  const args = process.argv.slice(2);
  const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
  const RESET = process.env.RESET === 'true' || args.includes('--reset');
  const AUTO_CONFIRM = args.includes('--auto-confirm-tier2');

  const normalizedTitle = projectTitle.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const LOG_FILE = path.join(__dirname, `../../../simulate-${normalizedTitle}.log`);
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'w' });

  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  process.stdout.write = (chunk, ...args) => { logStream.write(chunk); return origStdoutWrite(chunk, ...args); };
  process.stderr.write = (chunk, ...args) => { logStream.write(chunk); return origStderrWrite(chunk, ...args); };

  function write(line) { process.stdout.write(line); }
  function log(msg) { write(`[simulate-buildboard] ${msg}\n`); }

  async function getOrCreateUser(username) {
    const User = (await import('../../models/User.js')).default;
    const existing = await User.findOne({ username }).lean();
    if (existing) { log(`Found existing user: ${username}`); return existing; }
    const result = await authService.register(username, `${username}@buildboard.test`, 'Test1234!');
    log(`Created user: ${username}`);
    return result.user;
  }

  await connectDB();
  log('DB connected');

  if (RESET) {
    const deleted = await Project.deleteOne({ title: projectTitle });
    if (deleted.deletedCount) log(`Deleted existing project "${projectTitle}"`);
  }

  const userMap = {};
  for (const username of usersToCreate) {
    userMap[username] = await getOrCreateUser(username);
  }

  const mainUser = userMap[usersToCreate[0]];

  let project;
  const existing = await Project.findOne({ title: projectTitle }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(projectTitle, projectDesc, mainUser._id);
    log(`Created project: ${project._id}`);
  }

  // Join other users
  for (let i = 1; i < usersToCreate.length; i++) {
    const u = userMap[usersToCreate[i]];
    try { await projectService.joinProject(project.inviteCode, u._id); log(`${usersToCreate[i]} joined project`); }
    catch { log(`${usersToCreate[i]} already a member`); }
  }

  // Find or create discussion threads
  const existingDiscussions = await discussionService.getProjectDiscussions(project._id);
  const threadsMap = {};

  // For each required thread in conversations
  const { threadSummaries } = await import('./buildboard-data.js');
  const requiredThreads = [...new Set(conversations.map(c => c.thread))];

  for (const threadName of requiredThreads) {
    let disc = existingDiscussions.find(d => d.title === threadName || (threadName === 'Main' && d.isMain));
    if (!disc) {
      const summaryContent = (threadSummaries && threadSummaries[threadName])
        ? threadSummaries[threadName]
        : `Discussion thread focused on ${threadName} implementation details`;
      disc = await discussionService.createDiscussion(project._id, threadName, summaryContent, mainUser._id, mainUser._id);
      log(`Created discussion thread: ${threadName} (${disc._id})`);
    } else {
      log(`Using discussion thread: ${threadName} (${disc._id})`);
    }
    threadsMap[threadName] = disc;

    // Join all users to this discussion
    for (const username of usersToCreate) {
      const u = userMap[username];
      try { await discussionService.joinDiscussion(disc._id, u._id); } catch { /* already in */ }
    }
  }

  const llmConfig = { provider: 'groq', model: 'llama-3.3-70b-versatile' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}\n`);
  log(`Replaying ${conversations.length} messages (delay: ${DELAY_MS}ms)...\n`);

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const Message = (await import('../../models/Message.js')).default;
  const Discussion = (await import('../../models/Discussion.js')).default;
  const now = Date.now();
  const startTime = now - (30 * 24 * 60 * 60 * 1000);
  const timeStep = Math.floor((30 * 24 * 60 * 60 * 1000) / (conversations.length || 1));

  for (let i = 0; i < conversations.length; i++) {
    const { thread, user: username, text } = conversations[i];
    const user = userMap[username];
    const discussion = threadsMap[thread];

    const simulatedTime = new Date(startTime + (i * timeStep));
    const message = await discussionService.addMessage(
      discussion._id, project._id, user._id, username, text, false
    );
    await Message.findByIdAndUpdate(message._id, { timestamp: simulatedTime });
    await Discussion.findByIdAndUpdate(discussion._id, { lastActivity: simulatedTime });

    write(`  [${String(i + 1).padStart(2, '0')}/${conversations.length}] [${thread}] ${username}: ${text.substring(0, 72)}...\n`);

    if (text.length >= 30) {
      let nextContext = '';
      for (let j = i + 1; j < Math.min(i + 3, conversations.length); j++) {
        nextContext += ' ' + conversations[j].text;
      }

      try {
        const signal = SignalClassifier.classify(message, nextContext);
        if (signal) {
          const pending = await SignalBuffer.addSignal(project._id, discussion._id, signal);
          let processSignal = false;

          if (signal.tier === 1) {
            processSignal = true;
          } else if (AUTO_CONFIRM) {
            processSignal = true;
            await SignalBuffer.confirmSignal(pending._id);
          }

          if (processSignal) {
            const normalized = await SignalNormalizer.normalize(signal);
            await KnowledgeAggregator.mergeInsights({
              projectId: project._id,
              discussionId: discussion._id,
              extracted: normalized
            });
            if (signal.tier === 1) await SignalBuffer.autoCapture(pending._id);
            write(`         ↳ Signal classified [Tier ${signal.tier} ${signal.type}]: ${normalized.decisions[0]?.text || normalized.blockers[0]?.text || normalized.actionItems[0]?.text || ''}\n`);
          } else {
            write(`         ↳ Signal classified [Tier ${signal.tier} ${signal.type}] - waiting for review\n`);
          }
        } else {
          write(`         ↳ skipped (no signal)\n`);
        }
      } catch (err) {
        write(`         ↳ skipped (${err.message})\n`);
      }
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  const mainDisc = threadsMap['Main'];
  if (mainDisc) {
    const aiService = (await import('../../services/aiService.js')).default;
    const summaryService = (await import('../../services/summaryService.js')).default;

    for (const [threadName, disc] of Object.entries(threadsMap)) {
      if (threadName === 'Main') continue;

      log(`Summarizing ${threadName} conversation...`);
      try {
        const summaryContent = await aiService.generateSummary(
          project._id,
          disc._id,
          llmConfig,
          `Summarize the key architectural and technical decisions in this ${threadName} thread.`
        );

        const savedSummary = await summaryService.createSummary(
          project._id,
          disc._id,
          summaryContent,
          'discussion',
          llmConfig.provider,
          await Message.countDocuments({ discussionId: disc._id })
        );
      } catch (err) {
        log(`Failed to summarize ${threadName}: ${err.message}`);
      }
    }
  }

  log('\nDone. Open the dashboard to see results.');
  log(`Project ID: ${project._id}`);
  log(`Full log saved to: ${LOG_FILE}`);
  logStream.end();
  setTimeout(() => process.exit(0), 100);
}
