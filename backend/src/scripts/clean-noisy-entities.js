/**
 * One-time cleanup: removes low-signal entities created before quality filters.
 * Safe to run multiple times.
 * Usage: node src/scripts/clean-noisy-entities.js
 */
import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database.js';
import Decision from '../models/Decision.js';
import Blocker from '../models/Blocker.js';
import ActionItem from '../models/ActionItem.js';
import { normalizeText } from '../utils/normalizeText.js';

const NOISE_EXACT = new Set([
  "we don't have that information", "we dont have that information",
  "not sure", "unknown", "none", "no blockers", "none mentioned",
  "no blockers mentioned", "lets take a closer look", "let's take a closer look",
  "we should think about it", "we should think about this",
  "n/a", "tbd", "to be determined", "need to check",
  "need to investigate", "will look into it", "will look into this",
  "all blockers are resolved", "blockers are resolved", "no blockers at this time"
]);

// Substring patterns — if the normalized text CONTAINS these, it's noise
const NOISE_SUBSTRINGS = [
  "take a closer look",
  "we've just resolved",
  "just resolved the blocker",
  "blockers are resolved",
  "we don't have that information",
  "high blockers are actually labeled",
  "introducing ourselves",
  "let's get started by introducing"
];

const FILLER = ['yes', 'no', 'ok', 'okay', 'sure', 'maybe', 'react', 'sounds good'];

function isNoise(text) {
  const norm = normalizeText(text);
  if (NOISE_EXACT.has(norm)) return true;
  if (FILLER.includes(norm)) return true;
  if (norm.length < 10) return true;
  if (NOISE_SUBSTRINGS.some(s => norm.includes(s))) return true;
  return false;
}

await connectDB();
console.log('\n=== Cleaning Noisy Entities ===\n');

// Clean decisions
const decisions = await Decision.find({}).lean();
let dDeleted = 0;
for (const d of decisions) {
  if (isNoise(d.text)) {
    await Decision.findByIdAndDelete(d._id);
    console.log(`  [DECISION REMOVED] "${d.text}"`);
    dDeleted++;
  }
}

// Clean blockers
const blockers = await Blocker.find({}).lean();
let bDeleted = 0;
for (const b of blockers) {
  if (isNoise(b.text)) {
    await Blocker.findByIdAndDelete(b._id);
    console.log(`  [BLOCKER REMOVED] "${b.text}"`);
    bDeleted++;
  }
}

// Clean action items
const actions = await ActionItem.find({}).lean();
let aDeleted = 0;
for (const a of actions) {
  if (isNoise(a.text)) {
    await ActionItem.findByIdAndDelete(a._id);
    console.log(`  [ACTION REMOVED] "${a.text}"`);
    aDeleted++;
  }
}

console.log(`\nDecisions removed : ${dDeleted}`);
console.log(`Blockers removed  : ${bDeleted}`);
console.log(`Actions removed   : ${aDeleted}`);
process.exit(0);
