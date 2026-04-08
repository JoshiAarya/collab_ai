/**
 * Backfills embeddings for topics that were migrated before embedding generation was added.
 * Safe to run multiple times — skips topics that already have embeddings.
 * Usage: node src/scripts/backfill-topic-embeddings.js
 */
import dotenv from 'dotenv';
dotenv.config();
import connectDB from '../config/database.js';
import Topic from '../models/Topic.js';
import EmbeddingService from '../core/embeddings/EmbeddingService.js';

await connectDB();
console.log('\n=== Backfilling Topic Embeddings ===\n');

const topics = await Topic.find({ embedding: null }).lean();
console.log(`Found ${topics.length} topics without embeddings.\n`);

let done = 0, failed = 0;
for (const t of topics) {
  try {
    const embedding = await EmbeddingService.embedText(t.name);
    await Topic.findByIdAndUpdate(t._id, { $set: { embedding } });
    done++;
    if (done % 10 === 0) console.log(`  ${done}/${topics.length}...`);
  } catch (err) {
    console.warn(`  [WARN] ${t.name}: ${err.message}`);
    failed++;
  }
}

console.log(`\nDone: ${done} | Failed: ${failed}`);
process.exit(0);
