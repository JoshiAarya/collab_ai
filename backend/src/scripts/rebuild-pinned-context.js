/**
 * Rebuilds pinnedContext for all projects that have entity model data.
 * Run after migration to populate the pinnedContext field.
 * Usage: node src/scripts/rebuild-pinned-context.js
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/database.js';
import ProjectState from '../models/ProjectState.js';
import KnowledgeAggregator from '../core/intelligence/KnowledgeAggregator.js';

async function run() {
  await connectDB();
  console.log('\n=== Rebuilding Pinned Contexts ===\n');

  const states = await ProjectState.find({}).lean();
  console.log(`Found ${states.length} ProjectState documents.\n`);

  for (const state of states) {
    const projectId = state.projectId;
    console.log(`Rebuilding: ${projectId}`);
    // Trigger a full recompute — this rebuilds pinnedContext
    await KnowledgeAggregator._recomputeProjectState(projectId);
    const updated = await ProjectState.findOne({ projectId }).lean();
    const tokens = Math.ceil((updated.pinnedContext?.length || 0) / 4);
    console.log(`  Stage: ${updated.stage} | PinnedCtx: ~${tokens} tokens`);
  }

  console.log('\n=== Done ===\n');
  process.exit(0);
}

run().catch(err => {
  console.error('Rebuild failed:', err.message);
  process.exit(1);
});
