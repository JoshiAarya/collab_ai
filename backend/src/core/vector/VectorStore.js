/**
 * Vector Store - PHASE 2 ACTIVATED
 * Performs semantic search using embeddings stored in MongoDB
 */

import DocumentChunk from '../../models/DocumentChunk.js';
import MessageEmbedding from '../../models/MessageEmbedding.js';
import Decision from '../../models/Decision.js';
import logger from '../../utils/logger.js';

// Similarity is computed in-process, so candidate sets must be bounded —
// otherwise memory and latency grow linearly with project history.
const MAX_MESSAGE_CANDIDATES = 2000;  // most recent messages
const MAX_CHUNK_CANDIDATES = 2000;    // document chunks
const MAX_DECISION_CANDIDATES = 500;  // most recent decisions

class VectorStore {
  constructor() {
    this.dimension = 384; // all-MiniLM-L6-v2 dimensions
  }

  /**
   * Search for semantically similar document chunks
   */
  async search(projectId, queryEmbedding, topK = 5) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      const chunks = await DocumentChunk.find({ projectId })
        .limit(MAX_CHUNK_CANDIDATES)
        .lean();

      if (chunks.length === 0) {
        logger.debug('No document chunks found for project', { projectId });
        return [];
      }

      logger.debug('Computing similarities', {
        projectId,
        chunkCount: chunks.length,
        topK
      });

      // Compute cosine similarity for each chunk
      const results = chunks.map(chunk => {
        const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
        return {
          id: chunk._id,
          documentId: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          content: chunk.content,
          similarity,
          metadata: chunk.metadata
        };
      });

      // Sort by similarity (descending) and return top K
      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;

      logger.ai('Vector search completed', {
        projectId,
        totalChunks: chunks.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;

    } catch (error) {
      logger.error('Vector search failed', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search for semantically similar messages
   */
  async searchMessages(projectId, queryEmbedding, topK = 5) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      // Most recent N — bounded so per-request cost doesn't grow with history
      const messages = await MessageEmbedding.find({ projectId })
        .sort({ timestamp: -1 })
        .limit(MAX_MESSAGE_CANDIDATES)
        .lean();

      if (messages.length === 0) {
        logger.debug('No message embeddings found for project', { projectId });
        return [];
      }

      logger.debug('Computing message similarities', {
        projectId,
        messageCount: messages.length,
        topK
      });

      const results = messages.map(msg => {
        const similarity = this.cosineSimilarity(queryEmbedding, msg.embedding);
        return {
          id: msg._id,
          messageId: msg.messageId,
          discussionId: msg.discussionId,
          content: msg.content,
          userId: msg.userId,
          username: msg.username,
          timestamp: msg.timestamp,
          similarity
        };
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;

      logger.ai('Vector message search completed', {
        projectId,
        totalMessages: messages.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;

    } catch (error) {
      logger.error('Vector message search failed', {
        projectId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Search for semantically similar decisions
   */
  async searchDecisions(projectId, queryEmbedding, topK = 8) {
    const startTime = Date.now();

    try {
      if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
        throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}, got ${queryEmbedding?.length}`);
      }

      // Fetch only decisions that have embeddings (most recent N)
      const decisions = await Decision.find({
        projectId,
        embeddingStatus: 'done',
        embedding: { $exists: true, $ne: [] }
      })
        .sort({ timestamp: -1 })
        .limit(MAX_DECISION_CANDIDATES)
        .lean();

      if (decisions.length === 0) {
        logger.debug('No embedded decisions found for project', { projectId });
        return [];
      }

      const results = decisions.map(dec => {
        const similarity = this.cosineSimilarity(queryEmbedding, dec.embedding);
        return {
          id: dec._id,
          text: dec.text,
          rationale: dec.rationale,
          proposedBy: dec.proposedBy,
          timestamp: dec.timestamp,
          similarity
        };
      });

      results.sort((a, b) => b.similarity - a.similarity);
      const topResults = results.slice(0, topK);

      const duration = Date.now() - startTime;
      logger.ai('Vector decision search completed', {
        projectId,
        totalDecisions: decisions.length,
        topK,
        resultsFound: topResults.length,
        topSimilarity: topResults[0]?.similarity.toFixed(4),
        duration: `${duration}ms`
      });

      return topResults;
    } catch (error) {
      logger.error('Vector decision search failed', { projectId, error: error.message });
      return []; // fail-safe — fall back to empty
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  /**
   * Get chunk count for a project
   */
  async count(projectId) {
    try {
      return await DocumentChunk.countDocuments({ projectId });
    } catch (error) {
      logger.error('Error counting chunks', { projectId, error: error.message });
      return 0;
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteByDocument(documentId) {
    try {
      const result = await DocumentChunk.deleteMany({ documentId });
      logger.info('Chunks deleted for document', {
        documentId,
        deletedCount: result.deletedCount
      });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error deleting chunks', { documentId, error: error.message });
      return 0;
    }
  }

  /**
   * Clear all chunks for a project (use with caution)
   */
  async clear(projectId) {
    try {
      const result = await DocumentChunk.deleteMany({ projectId });
      logger.warn('All chunks cleared for project', {
        projectId,
        deletedCount: result.deletedCount
      });
      return result.deletedCount;
    } catch (error) {
      logger.error('Error clearing chunks', { projectId, error: error.message });
      return 0;
    }
  }
}

export default new VectorStore();
