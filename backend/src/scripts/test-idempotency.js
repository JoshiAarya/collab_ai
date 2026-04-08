/**
 * Idempotency test — Task 3
 * Runs KnowledgeAggregator twice on the same extracted data.
 * Verifies no duplicates are created.
 * Usage: node src/scripts/test-idempotency.js <projectId>
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/database.js';
import Topic from '../models/Topic.js';
import Decision from '../models/Decision.js';
import Blocker from '../models/Blocker.js';
import ActionItem from '../models/ActionItem.js';
import KnowledgeAggregator from '../core/intelligence/KnowledgeAggregator.js';

const TEST_DISCUSSION_ID = '000000000000000000000001';

const SAMPLE_EXTRACTED = {
  topics: [
    { name: 'Idempotency Test Topic' },
    { name: 'Authentication' }
  ],
  decisions: [
    { text: 'Use JWT for authentication', rationale: 'Stateless and scalable', topicHint: 'Authentication' },
    { text: 'Store tokens in httpOnly cookies' }
  ],
  blockers: [
    { text: 'Redis not yet configured', severity: 'medium', topicHint: 'Authentication' }
  ],
  actionItems: [
    { text: 'Set up Redis instance', status: 'open', topicHint: 'Authentication' }
  ],
  messageId: null,
  source: 'test'
};

async function countEntities(projectId) {
  const [t, d, b, a] = await Promise.all([
    Topic.countDocuments({ projectId }),
    Decision.countDocuments({ projectId }),
    Blocker.countDocuments({ projectId }),
    ActionItem.countDocuments({ projectId })
  ]);
  return { topics: t, decisions: d, blockers: b, actionItems: a };
}

async function run() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Usage: node src/scripts/test-idempotency.js <projectId>');
    process.exit(1);
  }

  await connectDB();
  console.log(`\n=== Idempotency Test — Project: ${projectId} ===\n`);

  const before = await countEntities(projectId);
  console.log('Before first run:', before);

  // Run 1
  console.log('\nRun 1...');
  await KnowledgeAggregator.mergeInsights({
    projectId,
    discussionId: TEST_DISCUSSION_ID,
    extracted: SAMPLE_EXTRACTED
  });
  const after1 = await countEntities(projectId);
  console.log('After run 1:', after1);

  // Run 2 — same data
  console.log('\nRun 2 (same data)...');
  await KnowledgeAggregator.mergeInsights({
    projectId,
    discussionId: TEST_DISCUSSION_ID,
    extracted: SAMPLE_EXTRACTED
  });
  const after2 = await countEntities(projectId);
  console.log('After run 2:', after2);

  // Verify no duplicates
  console.log('\n=== Results ===');
  const pass = (
    after2.topics === after1.topics &&
    after2.decisions === after1.decisions &&
    after2.blockers === after1.blockers &&
    after2.actionItems === after1.actionItems
  );

  if (pass) {
    console.log('✅ PASS — No duplicates created on second run');
  } else {
    console.log('❌ FAIL — Duplicates detected:');
    if (after2.topics !== after1.topics) console.log(`  Topics: ${after1.topics} → ${after2.topics}`);
    if (after2.decisions !== after1.decisions) console.log(`  Decisions: ${after1.decisions} → ${after2.decisions}`);
    if (after2.blockers !== after1.blockers) console.log(`  Blockers: ${after1.blockers} → ${after2.blockers}`);
    if (after2.actionItems !== after1.actionItems) console.log(`  ActionItems: ${after1.actionItems} → ${after2.actionItems}`);
  }

  process.exit(pass ? 0 : 1);
}

run().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
