/**
 * simulate-conversation.js
 *
 * Creates a project + discussion and replays a hardcoded conversation,
 * triggering the full extraction pipeline on each message.
 *
 * Usage:
 *   node --experimental-vm-modules src/scripts/simulate-conversation.js
 *   # or if package.json has "type":"module":
 *   node src/scripts/simulate-conversation.js
 *
 * Options (env vars):
 *   DELAY_MS=800   — ms between messages (default 800, set 0 for instant)
 *   RESET=true     — delete existing project with same title before creating
 */

import 'dotenv/config';
import connectDB from '../config/database.js';
import authService from '../services/authService.js';
import projectService from '../services/projectService.js';
import discussionService from '../services/discussionService.js';
import InsightExtractor from '../core/intelligence/InsightExtractor.js';
import KnowledgeAggregator from '../core/intelligence/KnowledgeAggregator.js';
import AIOrchestrator from '../core/orchestrator/AIOrchestrator.js';
import Project from '../models/Project.js';

// ─── Config ──────────────────────────────────────────────────────────────────

const args     = process.argv.slice(2);
const DELAY_MS = parseInt(process.env.DELAY_MS ?? args.find(a => a.startsWith('--delay='))?.split('=')[1] ?? '800', 10);
const RESET    = process.env.RESET === 'true' || args.includes('--reset');

// ─── Project definition ───────────────────────────────────────────────────────

const PROJECT_TITLE = 'BidPulse';
const PROJECT_DESC  =
  'A centralized platform designed to scrape, normalize, and analyze procurement data ' +
  'from government portals like GeM (Government e-Marketplace) and eProcure. It provides ' +
  'small-to-medium enterprises with smart keyword alerts, historical pricing trends, and ' +
  'automated document mirroring to ensure they never miss a bidding opportunity.';

// ─── Conversation ─────────────────────────────────────────────────────────────
// Format: { user: 'nk' | 'pk', text: '...' }

const CONVERSATION = [
  { user: 'nk', text: "I'm looking at the GeM landing page—it's not just a simple search result. The whole thing is behind a multi-step redirect chain." },
  { user: 'pk', text: "Yeah, and the session cookies expire in like 15 minutes. We can't just use a simple Python requests script for this." },
  { user: 'nk', text: "We probably need Playwright. It's the only way to handle the client-side rendering and the session handshakes reliably." },
  { user: 'pk', text: "If we run headless browsers for every search, our memory usage is going to hit the ceiling on a standard VPS." },
  { user: 'nk', text: "What if we use a pool of persistent browser contexts? We keep 5 \"warm\" browsers open and rotate the tasks through them." },
  { user: 'pk', text: "That might work, but we still have to deal with the Captchas that pop up after every 5 or 6 automated searches." },
  { user: 'nk', text: "I'm looking at a solver API—it's a few cents per 1000 solves. We can integrate that directly into the Playwright flow." },
  { user: 'pk', text: "Fine, but the normalization is the real headache. GeM's JSON structure for tenders is a total mess." },
  { user: 'nk', text: "I'll write a transformer layer in TypeScript. We can define a strict Zod schema to ensure the final output is clean." },
  { user: 'pk', text: "We should store the raw HTML in S3 too, just in case we need to re-parse the data later when we add more fields." },
  { user: 'nk', text: "Good idea. We'll keep the metadata like \"Title,\" \"Value,\" and \"Closing Date\" in Postgres for the search filters." },
  { user: 'pk', text: "Wait, what if a tender is updated? The portals often post \"Corrigendums\" that change the whole scope." },
  { user: 'nk', text: "We can hash the main description text. If the hash changes on a subsequent crawl, we trigger a \"Revised\" status for that ID." },
  { user: 'pk', text: "How are we handling the search? Standard Postgres LIKE queries are going to be way too slow once we hit 50k tenders." },
  { user: 'nk', text: "Let's use Meilisearch. It's lightweight, supports typo tolerance, and it's much faster for a \"search-as-you-type\" UI." },
  { user: 'pk', text: "How do we keep Postgres and Meilisearch in sync?" },
  { user: 'nk', text: "I'll set up a cron job that runs every 10 minutes. It'll grab any new or updated rows from Postgres and push them to the Meilisearch index." },
  { user: 'pk', text: "That's safer than a DB trigger. We don't want the main ingestion to fail just because the search index is down." },
  { user: 'nk', text: "Exactly. Now, about the notifications—users will want to know the second a matching tender is found." },
  { user: 'pk', text: "We can let users save a search query. Every time the scraper finishes a cycle, we run those saved queries and find the \"delta.\"" },
  { user: 'nk', text: "We need to deduplicate the alerts. Nobody wants a separate email for 10 different tenders found in one hour." },
  { user: 'pk', text: "We'll batch them. We can send a \"New Matches\" digest every 4 hours using Resend or Amazon SES." },
  { user: 'nk', text: "I'm worried about the \"Category\" field. The portals use very broad categories that aren't helpful for filtering." },
  { user: 'pk', text: "We might need to run the descriptions through a small LLM or even just a keyword-based classifier to tag them better." },
  { user: 'nk', text: "Let's start with a regex-based tagger. If it contains \"workstation\" or \"monitor,\" tag it as \"IT Hardware.\"" },
  { user: 'pk', text: "Simple enough. I'll start on the scraper skeleton tonight. I need to figure out the best proxy rotation strategy." },
  { user: 'nk', text: "Use residential proxies. My local IP got flagged and hit with a 403 Forbidden error after only 10 minutes of testing." },
  { user: 'pk', text: "Already looking at a provider. I'll implement the rotation logic so every request looks like it's coming from a different city." },
  { user: 'nk', text: "Don't forget the \"Closing Date\" logic. If the tender is already expired, the scraper should skip the document download step." },
  { user: 'pk', text: "Obvious, but I'll add a \"Status\" check to the crawler. Speaking of documents, some of these PDFs are 50MB+." },
  { user: 'nk', text: "We have to mirror them on S3. The portals often delete the files once the bidding period ends, and users need them for reference." },
  { user: 'pk', text: "That's going to eat up storage fast. Maybe we only mirror files for tenders that match at least one user's \"Watchlist.\"" },
  { user: 'nk', text: "That's a smart way to limit the volume. We can always trigger a manual download if a user clicks an un-mirrored link." },
  { user: 'pk', text: "I'll build the \"Watchlist\" logic first. It'll act as a filter for the S3 uploader." },
  { user: 'nk', text: "I'll start on the Next.js frontend and the Meilisearch integration for the main dashboard." },
  { user: 'pk', text: "We should check the \"Terms of Service\" on GeM. We don't want a legal notice for aggressive crawling on week one." },
  { user: 'nk', text: "We're aggregating public data. As long as we keep the request frequency \"human-like\" with random delays, we should be fine." },
  { user: 'pk', text: "I'll add a \"jitter\" function to the scraper. It'll wait between 2 and 7 seconds between every page load." },
  { user: 'nk', text: "Perfect. The staging environment is ready; I'll push the basic Postgres schema to the repo in an hour." },
  { user: 'pk', text: "I'll pull it and start mapping the scraper output to those table columns." },
  { user: 'nk', text: "Let's also add a \"Tender Value\" parser. Some portals write it as \"1.5 Cr\" and others as \"15,000,000.\"" },
  { user: 'pk', text: "Ugh, I'll write a utility function to normalize everything to a BigInt in the smallest currency unit." },
  { user: 'nk', text: "Sounds like a plan. Let's sync again tomorrow once the first 100 tenders are successfully ingested." },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function log(msg) { console.log(`[simulate] ${msg}`); }

async function getOrCreateUser(username) {
  // Look up by username directly — avoids password issues with existing accounts
  const User = (await import('../models/User.js')).default;
  const existing = await User.findOne({ username }).lean();
  if (existing) {
    log(`Found existing user: ${username} (${existing._id})`);
    return existing;
  }
  // Create fresh test user
  const email    = `${username}@bidpulse.test`;
  const password = 'Test1234!';
  const result = await authService.register(username, email, password);
  log(`Created user: ${username}`);
  return result.user;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  await connectDB();
  log('DB connected');

  // Optionally wipe existing project
  if (RESET) {
    const deleted = await Project.deleteOne({ title: PROJECT_TITLE });
    if (deleted.deletedCount) log(`Deleted existing project "${PROJECT_TITLE}"`);
  }

  // 1. Get/create users
  const nk = await getOrCreateUser('nk');
  const pk = await getOrCreateUser('pk');
  const userMap = { nk, pk };

  // 2. Create project (owned by nk)
  let project;
  const existing = await Project.findOne({ title: PROJECT_TITLE }).lean();
  if (existing) {
    project = existing;
    log(`Reusing existing project: ${project._id}`);
  } else {
    project = await projectService.createProject(PROJECT_TITLE, PROJECT_DESC, nk._id);
    log(`Created project: ${project._id}`);
  }

  // 3. Add pk as member
  try {
    await projectService.joinProject(project.inviteCode, pk._id);
    log('pk joined project');
  } catch {
    log('pk already a member');
  }

  // 4. Get or create main discussion
  const discussions = await discussionService.getProjectDiscussions(project._id);
  let discussion = discussions.find(d => d.isMain) || discussions[0];
  if (!discussion) {
    discussion = await discussionService.createDiscussion(
      project._id, 'Main', '', nk._id, nk._id
    );
    log(`Created discussion: ${discussion._id}`);
  } else {
    log(`Using discussion: ${discussion._id}`);
  }

  // 5. Add pk to discussion
  try {
    await discussionService.joinDiscussion(discussion._id, pk._id);
  } catch { /* already in */ }

  // 6. Get LLM config
  const fullProject = await projectService.getProjectById(project._id);
  const llmConfig = fullProject.activeLLM || { provider: 'groq', model: 'llama-3.1-8b-instant' };
  log(`LLM: ${llmConfig.provider}/${llmConfig.model}`);

  // 7. Replay conversation
  log(`\nReplaying ${CONVERSATION.length} messages (delay: ${DELAY_MS}ms)...\n`);

  for (let i = 0; i < CONVERSATION.length; i++) {
    const { user: username, text } = CONVERSATION[i];
    const user = userMap[username];

    // Save message
    const message = await discussionService.addMessage(
      discussion._id,
      project._id,
      user._id,
      username,
      text,
      false  // not AI
    );

    process.stdout.write(`  [${String(i + 1).padStart(2, '0')}/${CONVERSATION.length}] ${username}: ${text.substring(0, 60)}...\n`);

    // Trigger extraction pipeline — same as connectionManager._triggerExtractionForMessage
    // extractFromMessage handles the rate gate internally (fires every 5th message)
    if (text.length >= 30) {
      try {
        const extracted = await InsightExtractor.extractFromMessage({
          projectId:    project._id,
          discussionId: discussion._id,
          messageId:    message._id,
          text,
          isAI:         false,
          llmConfig,
          callProvider: AIOrchestrator.callProvider.bind(AIOrchestrator)
        });

        const hasArtifacts =
          extracted.topics.length + extracted.decisions.length +
          extracted.blockers.length + extracted.actionItems.length > 0;

        // Always merge (even empty) so _recomputeProjectState runs after each window
        await KnowledgeAggregator.mergeInsights({
          projectId:    project._id,
          discussionId: discussion._id,
          extracted:    { ...extracted, messageId: message._id }
        });

        if (hasArtifacts) {
          process.stdout.write(
            `         ↳ extracted: ${extracted.decisions.length}d ${extracted.blockers.length}b ` +
            `${extracted.actionItems.length}a ${extracted.topics.length}t\n`
          );
        } else if (extracted.windowMessageIds?.length) {
          process.stdout.write(`         ↳ window processed, no new artifacts\n`);
        }
      } catch (err) {
        process.stdout.write(`         ↳ extraction skipped (${err.message})\n`);
      }
    }

    if (DELAY_MS > 0) await sleep(DELAY_MS);
  }

  log('\nDone. Open the dashboard in the UI to see results.');
  log(`Project ID: ${project._id}`);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
