/**
 * One-time cleanup: removes placeholder blockers created before Fix 1.
 * Safe to run multiple times.
 */
import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database.js';
import Blocker from '../models/Blocker.js';
import { normalizeText } from '../utils/normalizeText.js';

const PLACEHOLDERS = new Set(['none mentioned', 'no blockers', 'none', 'na', 'no blockers mentioned', 'n/a']);

await connectDB();
const all = await Blocker.find({}).lean();
const toDelete = all.filter(b => PLACEHOLDERS.has(normalizeText(b.text)));

console.log(`Found ${toDelete.length} placeholder blockers:`);
toDelete.forEach(b => console.log(`  "${b.text}"`));

if (toDelete.length > 0) {
  const ids = toDelete.map(b => b._id);
  const result = await Blocker.deleteMany({ _id: { $in: ids } });
  console.log(`Deleted: ${result.deletedCount}`);
} else {
  console.log('Nothing to delete.');
}

process.exit(0);
