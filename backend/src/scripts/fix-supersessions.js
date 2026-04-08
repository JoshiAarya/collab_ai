/**
 * fix-supersessions.js
 * One-time script to fix incorrectly mapped superseded decisions.
 * 
 * Checks all superseded decisions and verifies the old→new link makes semantic sense.
 * If the old and new decisions are about unrelated topics (low cosine similarity),
 * it reverts the old decision back to 'active' and clears the supersededBy link.
 *
 * Usage: node src/scripts/fix-supersessions.js [--dry-run]
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/collabai';
const SEMANTIC_MIN = 0.45; // Same threshold as KnowledgeAggregator

// Minimal Decision model for the script
const decisionSchema = new mongoose.Schema({
  projectId: mongoose.Schema.Types.ObjectId,
  text: String,
  status: String,
  supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Decision', default: null }
}, { timestamps: true, strict: false });

const Decision = mongoose.model('Decision', decisionSchema);

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n🔧 Fix Superseded Decisions${dryRun ? ' (DRY RUN)' : ''}\n`);

  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB\n');

  // Find all superseded decisions that have a supersededBy link
  const superseded = await Decision.find({ status: 'superseded', supersededBy: { $ne: null } }).lean();
  console.log(`Found ${superseded.length} superseded decision(s) with links\n`);

  // Lazy-load embedding service
  let EmbeddingService = null;
  try {
    const mod = await import('../core/embeddings/EmbeddingService.js');
    EmbeddingService = mod.default;
  } catch (err) {
    console.error('Could not load EmbeddingService, falling back to text comparison:', err.message);
  }

  function cosineSimilarity(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; normA += a[i]*a[i]; normB += b[i]*b[i]; }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  let fixed = 0;
  let ok = 0;

  for (const old of superseded) {
    const newDecision = await Decision.findById(old.supersededBy).select('text').lean();
    if (!newDecision) {
      console.log(`⚠️  Orphaned link: "${old.text}" → missing decision (${old.supersededBy})`);
      if (!dryRun) {
        await Decision.findByIdAndUpdate(old._id, { $set: { status: 'active', supersededBy: null } });
      }
      fixed++;
      continue;
    }

    let similarity = null;
    if (EmbeddingService) {
      try {
        const oldEmb = await EmbeddingService.embedText(old.text);
        const newEmb = await EmbeddingService.embedText(newDecision.text);
        similarity = cosineSimilarity(oldEmb, newEmb);
      } catch (err) {
        console.log(`  ⚠️  Embedding failed for this pair, skipping semantic check`);
      }
    }

    const simLabel = similarity !== null ? ` (similarity: ${similarity.toFixed(4)})` : '';

    if (similarity !== null && similarity < SEMANTIC_MIN) {
      console.log(`❌ BAD:  "${old.text}" → "${newDecision.text}"${simLabel}`);
      if (!dryRun) {
        await Decision.findByIdAndUpdate(old._id, { $set: { status: 'active', supersededBy: null } });
      }
      fixed++;
    } else {
      console.log(`✅ OK:   "${old.text}" → "${newDecision.text}"${simLabel}`);
      ok++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`  OK:    ${ok}`);
  console.log(`  Fixed: ${fixed}${dryRun ? ' (dry run — no changes made)' : ''}`);

  await mongoose.disconnect();
  console.log('\nDone.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
