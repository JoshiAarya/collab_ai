/**
 * Embedding Service - PHASE 2 (Updated for Local Embeddings)
 * Generates text embeddings using local Hugging Face models
 * Model: sentence-transformers/all-MiniLM-L6-v2 (384 dimensions)
 * No API key required - runs locally using @xenova/transformers
 */

import { pipeline } from '@xenova/transformers';
import logger from '../../utils/logger.js';

class EmbeddingService {
  constructor() {
    this.model = process.env.HF_EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
    this.dimensions = 384;
    this.extractor = null;
    this.initPromise = null;
  }

  /**
   * Initialize the embedding pipeline (lazy loading)
   */
  async initialize() {
    if (this.extractor) {
      return this.extractor;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        logger.info('Initializing local embedding model', { model: this.model });
        
        // Create feature extraction pipeline
        this.extractor = await pipeline('feature-extraction', this.model);
        
        logger.info('Embedding model initialized successfully', { 
          model: this.model,
          dimensions: this.dimensions
        });
        
        return this.extractor;
      } catch (error) {
        logger.error('Failed to initialize embedding model', {
          model: this.model,
          error: error.message
        });
        this.initPromise = null;
        throw error;
      }
    })();

    return this.initPromise;
  }

  /**
   * Embed a single text string
   */
  async embedText(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new Error('Invalid text input for embedding');
    }

    const startTime = Date.now();

    try {
      // Initialize model if needed
      const extractor = await this.initialize();

      // Generate embedding
      const output = await extractor(text.trim(), { pooling: 'mean', normalize: true });
      
      // Convert to regular array
      const embedding = Array.from(output.data);
      const duration = Date.now() - startTime;

      // Validate embedding
      if (!Array.isArray(embedding) || embedding.length !== this.dimensions) {
        throw new Error(`Invalid embedding dimensions: expected ${this.dimensions}, got ${embedding?.length}`);
      }

      logger.ai('Embedding generated', {
        model: this.model,
        textLength: text.length,
        vectorLength: embedding.length,
        duration: `${duration}ms`
      });

      return embedding;

    } catch (error) {
      logger.error('Embedding generation failed', {
        model: this.model,
        error: error.message,
        textLength: text?.length
      });
      throw error;
    }
  }

  /**
   * Embed multiple text strings in batch
   */
  async embedBatch(textArray) {
    if (!Array.isArray(textArray) || textArray.length === 0) {
      throw new Error('Invalid text array for batch embedding');
    }

    logger.ai('Batch embedding started', {
      model: this.model,
      batchSize: textArray.length
    });

    const startTime = Date.now();
    const embeddings = [];

    try {
      // Initialize model once
      await this.initialize();

      // Process each text
      for (let i = 0; i < textArray.length; i++) {
        const embedding = await this.embedText(textArray[i]);
        embeddings.push(embedding);
      }

      const duration = Date.now() - startTime;

      logger.ai('Batch embedding completed', {
        model: this.model,
        batchSize: textArray.length,
        totalDuration: `${duration}ms`,
        avgDuration: `${Math.round(duration / textArray.length)}ms`
      });

      return embeddings;

    } catch (error) {
      logger.error('Batch embedding failed', {
        model: this.model,
        batchSize: textArray.length,
        processedCount: embeddings.length,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get embedding dimensions
   */
  getDimensions() {
    return this.dimensions;
  }

  /**
   * Get model name
   */
  getModel() {
    return this.model;
  }
}

export default new EmbeddingService();
