/**
 * Verification utility — Task 2
 * Prints entity collection counts per project.
 * Usage: node src/scripts/verify-knowledge-model.js
 * Optional: node src/scripts/verify-knowledge-model.js <projectId>
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
import ProjectInsights from '../models/ProjectInsights.js';

async function verifyProject(projectId) {
  const [topics, decisions, blockers, actions, orphanDecisions, state, legacy] = await Promise.all([
    Topic.countDocuments({ projectId }),
    Decision.countDocuments({ projectId }),
    Blocker.countDocuments({ projectId }),
    ActionItem.countDocuments({ projectId }),
    // FIX 3: count decisions not linked to any topic
    Decision.countDocuments({ projectId, topicId: null }),
    ProjectState.findOne({ projectId }).lean(),
    ProjectInsights.findOne({ projectId }).lean()
  ]);

  const statePresent = !!state;
  const legacyPresent = !!legacy;

  console.log(`\nProject: ${projectId}`);
  console.log(`  Topics         : ${topics}`);
  console.log(`  Decisions      : ${decisions}`);
  console.log(`  OrphanDecisions: ${orphanDecisions}`);
  console.log(`  Blockers       : ${blockers}`);
  console.log(`  ActionItems    : ${actions}`);
  console.log(`  ProjectState   : ${statePresent ? 'present' : 'MISSING'}`);
  console.log(`  Legacy PI      : ${legacyPresent ? 'present' : 'absent'}`);

  if (statePresent) {
    console.log(`  Stage       : ${state.stage}`);
    console.log(`  Momentum    : ${state.momentum?.trend} (${state.momentum?.recentMessageCount} msgs/week)`);
    console.log(`  OpenBlockers: ${state.openBlockerCount}`);
    console.log(`  OpenActions : ${state.unresolvedActionCount}`);
    const pinnedLen = state.pinnedContext?.length || 0;
    const pinnedTokens = Math.ceil(pinnedLen / 4);
    console.log(`  PinnedCtx   : ${pinnedLen} chars (~${pinnedTokens} tokens)`);
    if (state.pinnedContext) {
      console.log(`  --- Pinned Context ---`);
      console.log(state.pinnedContext);
      console.log(`  ---------------------`);
    }
  }

  // Task 8: warn if pinned context is outside target range
  if (statePresent && state.pinnedContext) {
    const tokens = Math.ceil(state.pinnedContext.length / 4);
    if (tokens < 50) console.warn(`  [WARN] Pinned context may be too short (${tokens} tokens)`);
    if (tokens > 220) console.warn(`  [WARN] Pinned context exceeds 220 token target (${tokens} tokens)`);
  }

  return { topics, decisions, orphanDecisions, blockers, actions, statePresent };
}

async function run() {
  await connectDB();
  console.log('\n=== Knowledge Model Verification ===');

  const targetId = process.argv[2];

  if (targetId) {
    await verifyProject(targetId);
  } else {
    // All projects that have entity data
    const projectIds = await Topic.distinct('projectId');
    if (projectIds.length === 0) {
      console.log('\nNo entity model data found. Run migrate-knowledge-model.js first.');
      process.exit(0);
    }
    for (const pid of projectIds) {
      await verifyProject(pid.toString());
    }
  }

  console.log('\n=== Done ===\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
