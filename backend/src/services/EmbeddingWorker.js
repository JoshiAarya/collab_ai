/**
 * EmbeddingWorker — Background reliability layer for embeddings
 * 
 * Problems solved:
 * 1. Messages that failed to embed (model loading, transient errors) are retried
 * 2. Decisions without embeddings get backfilled
 * 3. On startup, any orphaned messages/decisions are caught up
 * 
 * Runs on a simple setInterval — no Redis/Bull needed
 */

import logger from '../utils/logger.js';
import { isAIMention } from '../utils/aiMention.js';

class EmbeddingWorker {
  constructor() {
    this.interval = null;
    this.isRunning = false;
    this.stats = {
      messagesBackfilled: 0,
      decisionsBackfilled: 0,
      failures: 0,
      lastRunAt: null
    };
  }

  /**
   * Start the worker — runs every 60 seconds
   */
  start(intervalMs = 60000) {
    if (this.interval) return;

    logger.info('[EmbeddingWorker] Starting background embedding worker', {
      intervalMs
    });

    // Run once immediately after a short delay (let the model warm up)
    setTimeout(() => this.run(), 10000);

    // Then run on interval
    this.interval = setInterval(() => this.run(), intervalMs);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      logger.info('[EmbeddingWorker] Stopped');
    }
  }

  async run() {
    if (this.isRunning) return; // skip if previous run is still going
    this.isRunning = true;

    try {
      await this.backfillMessages();
      await this.backfillDecisions();
      this.stats.lastRunAt = new Date();
    } catch (err) {
      logger.error('[EmbeddingWorker] Run failed', { error: err.message });
      this.stats.failures++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Find messages that were saved but never embedded
   * (i.e., exist in Message but not in MessageEmbedding)
   */
  async backfillMessages() {
    try {
      const [
        { default: Message },
        { default: MessageEmbedding },
        { default: EmbeddingService }
      ] = await Promise.all([
        import('../models/Message.js'),
        import('../models/MessageEmbedding.js'),
        import('../core/embeddings/EmbeddingService.js')
      ]);

      // Find recent messages that should be embedded, then check embedding
      // existence only for that bounded candidate set — never scan the whole
      // MessageEmbedding collection.
      const candidates = await Message.find({
        isAI: { $ne: true },
        text: { $exists: true }
      })
        .sort({ timestamp: -1 })
        .limit(100) // process max 100 per run to avoid overload
        .lean();

      const candidateIds = candidates.map(m => m._id);
      const embedded = await MessageEmbedding.find({ messageId: { $in: candidateIds } })
        .select('messageId')
        .lean();
      const embeddedIdSet = new Set(embedded.map(e => e.messageId.toString()));

      const unembedded = candidates.filter(m => {
        if (!m.text || m.text.length < 20) return false;
        if (isAIMention(m.text)) return false;
        if (embeddedIdSet.has(m._id.toString())) return false;
        return true;
      });

      if (unembedded.length === 0) return;

      logger.info('[EmbeddingWorker] Backfilling messages', {
        found: unembedded.length
      });

      let count = 0;
      for (const msg of unembedded) {
        try {
          const embedding = await EmbeddingService.embedText(msg.text);
          if (!embedding) continue;

          await MessageEmbedding.create({
            projectId: msg.projectId,
            discussionId: msg.discussionId,
            messageId: msg._id,
            content: msg.text,
            embedding,
            userId: msg.userId,
            username: msg.user || 'Unknown',
            timestamp: msg.timestamp || Date.now()
          });
          count++;
        } catch (err) {
          // Skip duplicate key errors (race condition with live embedding)
          if (err.code === 11000) continue;
          logger.warn('[EmbeddingWorker] Failed to embed message', {
            messageId: msg._id,
            error: err.message
          });
        }
      }

      if (count > 0) {
        this.stats.messagesBackfilled += count;
        logger.info('[EmbeddingWorker] Messages backfilled', { count });
      }
    } catch (err) {
      logger.error('[EmbeddingWorker] Message backfill failed', { error: err.message });
    }
  }

  /**
   * Find decisions that don't have embeddings yet (pending or failed)
   */
  async backfillDecisions() {
    try {
      const [
        { default: Decision },
        { default: EmbeddingService }
      ] = await Promise.all([
        import('../models/Decision.js'),
        import('../core/embeddings/EmbeddingService.js')
      ]);

      const unembedded = await Decision.find({
        embeddingStatus: { $in: ['pending', 'failed'] }
      })
        .sort({ timestamp: -1 })
        .limit(50)
        .lean();

      if (unembedded.length === 0) return;

      logger.info('[EmbeddingWorker] Backfilling decisions', {
        found: unembedded.length
      });

      let count = 0;
      for (const dec of unembedded) {
        try {
          const textToEmbed = dec.text + (dec.rationale ? '. ' + dec.rationale : '');
          const embedding = await EmbeddingService.embedText(textToEmbed);
          if (!embedding) continue;

          await Decision.findByIdAndUpdate(dec._id, {
            embedding,
            embeddingStatus: 'done'
          });
          count++;
        } catch (err) {
          logger.warn('[EmbeddingWorker] Failed to embed decision', {
            decisionId: dec._id,
            error: err.message
          });
          // Don't flip to 'failed' again — leave it for next retry
        }
      }

      if (count > 0) {
        this.stats.decisionsBackfilled += count;
        logger.info('[EmbeddingWorker] Decisions backfilled', { count });
      }
    } catch (err) {
      logger.error('[EmbeddingWorker] Decision backfill failed', { error: err.message });
    }
  }

  /**
   * Get worker health stats
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning
    };
  }
}

export default new EmbeddingWorker();
