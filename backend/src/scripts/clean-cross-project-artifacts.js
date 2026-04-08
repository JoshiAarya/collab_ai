/**
 * clean-cross-project-artifacts.js
 * Removes blockers/decisions/actions whose text has no keyword overlap
 * with the project's own messages — catches hallucinated or cross-project artifacts.
 *
 * Usage:
 *   node src/scripts/clean-cross-project-artifacts.js           # dry run
 *   node src/scripts/clean-cross-project-artifacts.js --delete  # actually delete
 */

import dotenv from 'dotenv';
dotenv.config();

import connectDB from '../config/database.js';
import Project from '../models/Project.js';
import Blocker from '../models/Blocker.js';
import Decision from '../models/Decision.js';
import ActionItem from '../models/ActionItem.js';
import '../models/User.js'; // must be imported BEFORE discussionService to register schema for populate
import '../models/Message.js'; // same reason
import discussionService from '../services/discussionService.js';

const DELETE = process.argv.includes('--delete');

const STOP_WORDS = new Set(['the','a','an','is','it','in','on','at','to','for','of','and','or','but','we','i','you','this','that','with','are','be','as','by','from','use','will','should','can','need']);

function keywordsOf(text) {
  return text.toLowerCase().split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
}

function appearsInCorpus(entityText, corpus) {
  const words = keywordsOf(entityText);
  if (!words.length) return true; // can't check, keep it
  const matches = words.filter(w => corpus.includes(w));
  if (words.length <= 2) return matches.length >= Math.min(2, words.length);
  return matches.length >= Math.ceil(words.length * 0.6);
}

async function run() {
  await connectDB();
  console.log(`\n=== Cross-Project Artifact Cleaner${DELETE ? ' [DELETE MODE]' : ' [DRY RUN]'} ===\n`);

  const projects = await Project.find({}).lean();
  let totalRemoved = 0;

  for (const project of projects) {
    const projectId = project._id;
    console.log(`\nProject: ${project.title}`);

    // Build full message corpus for this project
    const discussions = await discussionService.getProjectDiscussions(projectId);
    let corpus = '';
    for (const disc of discussions) {
      const messages = await discussionService.getDiscussionMessages(disc._id, 500);
      corpus += ' ' + messages.map(m => m.text || '').join(' ');
    }
    corpus = corpus.toLowerCase();

    if (corpus.trim().length < 50) {
      console.log('  Skipped — not enough messages to validate against');
      continue;
    }

    // Check blockers
    const blockers = await Blocker.find({ projectId }).lean();
    for (const b of blockers) {
      if (!appearsInCorpus(b.text, corpus)) {
        console.log(`  [BLOCKER] "${b.text.substring(0, 80)}" — NOT in conversation`);
        if (DELETE) await Blocker.findByIdAndDelete(b._id);
        totalRemoved++;
      }
    }

    // Check decisions
    const decisions = await Decision.find({ projectId }).lean();
    for (const d of decisions) {
      if (!appearsInCorpus(d.text, corpus)) {
        console.log(`  [DECISION] "${d.text.substring(0, 80)}" — NOT in conversation`);
        if (DELETE) await Decision.findByIdAndDelete(d._id);
        totalRemoved++;
      }
    }

    // Check actions
    const actions = await ActionItem.find({ projectId }).lean();
    for (const a of actions) {
      if (!appearsInCorpus(a.text, corpus)) {
        console.log(`  [ACTION] "${a.text.substring(0, 80)}" — NOT in conversation`);
        if (DELETE) await ActionItem.findByIdAndDelete(a._id);
        totalRemoved++;
      }
    }
  }

  console.log(`\n=== ${DELETE ? 'Deleted' : 'Would delete'} ${totalRemoved} artifact(s) ===`);
  if (!DELETE && totalRemoved > 0) {
    console.log('Run with --delete to actually remove them.');
  }
  process.exit(0);
}

run().catch(err => { console.error('Failed:', err.message); process.exit(1); });
