/**
 * Vector Store - PHASE 2 ACTIVATED
 * Performs semantic search using embeddings stored in MongoDB
 */

import DocumentChunk from '../../models/DocumentChunk.js';
import logger from '../../utils/logger.js';

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

      // Fetch all chunks for the project
      const chunks = await DocumentChunk.find({ projectId }).lean();

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
