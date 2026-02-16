/**
 * Vector Store Abstraction Layer
 * Handles embeddings and similarity search
 */

class VectorStore {
  constructor() {
    this.vectors = new Map(); // documentId -> { embedding, metadata }
    this.dimension = 384; // Default embedding dimension
  }

  /**
   * Store a vector embedding
   */
  async store(id, embedding, metadata = {}) {
    if (!Array.isArray(embedding) || embedding.length !== this.dimension) {
      throw new Error(`Invalid embedding dimension. Expected ${this.dimension}`);
    }

    this.vectors.set(id, {
      embedding: embedding,
      metadata: {
        ...metadata,
        timestamp: Date.now()
      }
    });

    return id;
  }

  /**
   * Search for similar vectors using cosine similarity
   */
  async search(queryEmbedding, topK = 5, filter = {}) {
    if (!Array.isArray(queryEmbedding) || queryEmbedding.length !== this.dimension) {
      throw new Error(`Invalid query embedding dimension. Expected ${this.dimension}`);
    }

    const results = [];

    for (const [id, data] of this.vectors.entries()) {
      // Apply filters
      if (filter.projectId && data.metadata.projectId !== filter.projectId) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, data.embedding);
      results.push({
        id,
        similarity,
        metadata: data.metadata
      });
    }

    // Sort by similarity (descending) and return top K
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, topK);
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
   * Delete a vector
   */
  async delete(id) {
    return this.vectors.delete(id);
  }

  /**
   * Clear all vectors (for testing)
   */
  async clear() {
    this.vectors.clear();
  }

  /**
   * Get vector count
   */
  async count(filter = {}) {
    if (!filter.projectId) {
      return this.vectors.size;
    }

    let count = 0;
    for (const [, data] of this.vectors.entries()) {
      if (data.metadata.projectId === filter.projectId) {
        count++;
      }
    }
    return count;
  }
}

export default new VectorStore();
