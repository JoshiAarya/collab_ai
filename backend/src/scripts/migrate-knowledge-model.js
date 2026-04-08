/**
 * Migration: ProjectInsights → Entity Knowledge Model
 * Populates Topic, Decision, Blocker, ActionItem from existing ProjectInsights.
 * Safe to run multiple times (all upserts).
 * Does NOT delete ProjectInsights.
 *
 * Usage: node src/scripts/migrate-knowledge-model.js
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/database.js';
import ProjectInsights from '../models/ProjectInsights.js';
import Topic from '../models/Topic.js';
import Decision from '../models/Decision.js';
import Blocker from '../models/Blocker.js';
import ActionItem from '../models/ActionItem.js';
import ProjectState from '../models/ProjectState.js';
import { normalizeText, normalizeTopicName } from '../utils/normalizeText.js';

async function migrateTopics(projectId, topics) {
  let count = 0;
  for (const t of topics) {
    if (!t?.name) continue;
    const normalizedName = normalizeTopicName(t.name);
    if (!normalizedName) continue;
    try {
      await Topic.findOneAndUpdate(
        { projectId, normalizedName },
        {
          $set: { name: t.name.trim(), lastSeenAt: new Date() },
          $max: { count: t.count || 1 },
          $setOnInsert: {
            firstSeenAt: new Date(),
            status: 'active',
            embedding: null,
            sourceDiscussionIds: []
          }
        },
        { upsert: true }
      );
      count++;
    } catch (err) {
      console.warn(`  [WARN] Topic "${t.name}": ${err.message}`);
    }
  }
  return count;
}

async function migrateDecisions(projectId, decisions) {
  let count = 0;
  for (const d of decisions) {
    const text = typeof d === 'string' ? d : d?.text;
    if (!text || text.trim().length < 5) continue;
    try {
      await Decision.findOneAndUpdate(
        { projectId, text: text.trim() },
        {
          $set: {
            status: 'active',
            timestamp: d.timestamp || new Date(),
            ...(d.discussionId && { discussionId: d.discussionId })
          }
        },
        { upsert: true }
      );
      count++;
    } catch (err) {
      console.warn(`  [WARN] Decision "${text.substring(0, 40)}": ${err.message}`);
    }
  }
  return count;
}

async function migrateBlockers(projectId, blockers) {
  let count = 0;
  for (const b of blockers) {
    const text = typeof b === 'string' ? b : b?.text;
    if (!text || text.trim().length < 5) continue;
    try {
      await Blocker.findOneAndUpdate(
        { projectId, text: text.trim() },
        {
          $set: {
            severity: b.severity || 'medium',
            resolved: b.resolved || false,
            raisedAt: b.timestamp || new Date(),
            ...(b.discussionId && { discussionId: b.discussionId })
          }
        },
        { upsert: true }
      );
      count++;
    } catch (err) {
      console.warn(`  [WARN] Blocker "${text.substring(0, 40)}": ${err.message}`);
    }
  }
  return count;
}

async function migrateActionItems(projectId, actionItems) {
  let count = 0;
  for (const a of actionItems) {
    const text = typeof a === 'string' ? a : a?.text;
    if (!text || text.trim().length < 5) continue;
    try {
      await ActionItem.findOneAndUpdate(
        { projectId, text: text.trim() },
        {
          $set: {
            status: a.status || 'open',
            ...(a.discussionId && { discussionId: a.discussionId })
          }
        },
        { upsert: true }
      );
      count++;
    } catch (err) {
      console.warn(`  [WARN] ActionItem "${text.substring(0, 40)}": ${err.message}`);
    }
  }
  return count;
}

async function migrateProjectState(projectId, insight) {
  const openBlockers = (insight.blockers || []).filter(b => !b.resolved).length;
  const openActions = (insight.actionItems || []).filter(a => a.status !== 'completed').length;
  const activeTopics = (insight.topics || []).length;
  // FIX 10: always create ProjectState — this is the migration signal
  try {
    await ProjectState.findOneAndUpdate(
      { projectId },
      {
        $set: {
          openBlockerCount: openBlockers,
          unresolvedActionCount: openActions,
          activeTopicCount: activeTopics,
          lastUpdated: new Date()
        },
        // $setOnInsert ensures stage/momentum defaults are set on first creation
        $setOnInsert: {
          stage: 'ideation',
          momentum: { recentMessageCount: 0, previousMessageCount: 0, trend: 'stable' },
          pinnedContext: ''
        }
      },
      { upsert: true }
    );
    console.log(`  ProjectState created/updated for ${projectId}`);
  } catch (err) {
    console.warn(`  [WARN] ProjectState: ${err.message}`);
  }
}

async function run() {
  await connectDB();
  console.log('\n=== Knowledge Model Migration ===\n');

  const allInsights = await ProjectInsights.find({}).lean();
  console.log(`Found ${allInsights.length} ProjectInsights documents.\n`);

  if (allInsights.length === 0) {
    console.log('Nothing to migrate.');
    process.exit(0);
  }

  let totals = { projects: 0, topics: 0, decisions: 0, blockers: 0, actions: 0 };

  for (const insight of allInsights) {
    const pid = insight.projectId;
    console.log(`Project: ${pid}`);

    const t = await migrateTopics(pid, insight.topics || []);
    const d = await migrateDecisions(pid, insight.decisions || []);
    const b = await migrateBlockers(pid, insight.blockers || []);
    const a = await migrateActionItems(pid, insight.actionItems || []);
    await migrateProjectState(pid, insight);

    console.log(`  Topics: ${t} | Decisions: ${d} | Blockers: ${b} | Actions: ${a}`);

    totals.projects++;
    totals.topics += t;
    totals.decisions += d;
    totals.blockers += b;
    totals.actions += a;
  }

  console.log('\n=== Migration Complete ===');
  console.log(`Projects : ${totals.projects}`);
  console.log(`Topics   : ${totals.topics}`);
  console.log(`Decisions: ${totals.decisions}`);
  console.log(`Blockers : ${totals.blockers}`);
  console.log(`Actions  : ${totals.actions}`);
  console.log('\nProjectInsights preserved. Run validation before removing it.');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
