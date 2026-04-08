/**
 * reset-and-reextract.js
 * Wipes entity collections and re-extracts from each discussion once.
 * Usage: node src/scripts/reset-and-reextract.js [--dry-run]
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/database.js';
import Project from '../models/Project.js';
import Topic from '../models/Topic.js';
import Decision from '../models/Decision.js';
import Blocker from '../models/Blocker.js';
import ActionItem from '../models/ActionItem.js';
import ProjectState from '../models/ProjectState.js';
import InsightExtractor from '../core/intelligence/InsightExtractor.js';
import KnowledgeAggregator from '../core/intelligence/KnowledgeAggregator.js';
import discussionService from '../services/discussionService.js';

const DRY_RUN = process.argv.includes('--dry-run');

function mapLLMConfig(cfg) {
  return {
    provider: (!cfg?.provider || cfg.provider === 'server') ? 'groq' : cfg.provider,
    model: (!cfg?.model || cfg.model === 'server') ? 'llama-3.1-8b-instant' : cfg.model
  };
}

async function run() {
  await connectDB();
  console.log(`\n=== Reset & Re-extract${DRY_RUN ? ' [DRY RUN]' : ''} ===\n`);

  const [t, d, b, a, s] = await Promise.all([
    Topic.countDocuments({}), Decision.countDocuments({}),
    Blocker.countDocuments({}), ActionItem.countDocuments({}),
    ProjectState.countDocuments({})
  ]);
  console.log(`Before: Topics=${t} Decisions=${d} Blockers=${b} Actions=${a} States=${s}`);

  if (DRY_RUN) { console.log('\n[DRY RUN] No changes.'); process.exit(0); }

  // Wipe
  await Promise.all([
    Topic.deleteMany({}), Decision.deleteMany({}),
    Blocker.deleteMany({}), ActionItem.deleteMany({}),
    ProjectState.deleteMany({})
  ]);
  console.log('Wiped all entity collections.\n');

  const { default: AIOrchestrator } = await import('../core/orchestrator/AIOrchestrator.js');
  const projects = await Project.find({}).lean();
  console.log(`Processing ${projects.length} project(s)...\n`);

  for (const project of projects) {
    const projectId = project._id.toString();
    const llmConfig = mapLLMConfig(project.activeLLM);
    console.log(`Project: ${project.title}`);

    const discussions = await discussionService.getProjectDiscussions(projectId);

    for (const disc of discussions) {
      const discussionId = disc._id.toString();
      const messages = (await discussionService.getDiscussionMessages(disc._id, 200))
        .filter(m => m.user !== 'System');

      if (messages.length < 3) {
        console.log(`  [${disc.title}] skipped (${messages.length} messages)`);
        continue;
      }

      // Process in non-overlapping chunks of 15 messages
      const CHUNK = 15;
      let totalTopics = 0, totalDecisions = 0, totalBlockers = 0, totalActions = 0;

      for (let i = 0; i < messages.length; i += CHUNK) {
        const chunk = messages.slice(i, i + CHUNK);
        if (chunk.length < 3) continue;

        const chunkText = chunk.map(m => `${m.user}: ${m.text}`).join('\n');
        const lastMsg = chunk[chunk.length - 1];

        try {
          const extracted = await InsightExtractor._extract({
            projectId, discussionId,
            messageId: lastMsg._id,
            text: chunkText,
            conversationText: chunkText,
            source: lastMsg.isAI ? 'ai' : 'user',
            llmConfig,
            callProvider: AIOrchestrator.callProvider.bind(AIOrchestrator)
          });

          if (extracted.topics.length || extracted.decisions.length || extracted.blockers.length || extracted.actionItems.length) {
            await KnowledgeAggregator.mergeInsights({ projectId, discussionId, extracted: { ...extracted, messageId: lastMsg._id } });
            totalTopics += extracted.topics.length;
            totalDecisions += extracted.decisions.length;
            totalBlockers += extracted.blockers.length;
            totalActions += extracted.actionItems.length;
          }
        } catch (err) {
          console.warn(`  [${disc.title}] chunk failed: ${err.message}`);
        }

        await new Promise(r => setTimeout(r, 400));
      }

      console.log(`  [${disc.title}] topics=${totalTopics} decisions=${totalDecisions} blockers=${totalBlockers} actions=${totalActions}`);
    }

    await KnowledgeAggregator._recomputeProjectState(projectId);
    const state = await ProjectState.findOne({ projectId }).lean();
    console.log(`  → Stage: ${state?.stage} | Pinned: ~${Math.ceil((state?.pinnedContext?.length || 0) / 4)} tokens\n`);
  }

  const [t2, d2, b2, a2] = await Promise.all([
    Topic.countDocuments({}), Decision.countDocuments({}),
    Blocker.countDocuments({}), ActionItem.countDocuments({})
  ]);
  console.log(`=== Done ===`);
  console.log(`Topics=${t2} Decisions=${d2} Blockers=${b2} Actions=${a2}`);
  process.exit(0);
}

run().catch(err => { console.error('Failed:', err.message); process.exit(1); });
