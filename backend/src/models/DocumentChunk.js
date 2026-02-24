/**
 * DocumentChunk Model - PHASE 2
 * Stores document chunks with embeddings for semantic search
 */

import mongoose from 'mongoose';

const documentChunkSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  chunkIndex: {
    type: Number,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  embedding: {
    type: [Number],
    required: true,
    validate: {
      validator: function(v) {
        return Array.isArray(v) && v.length === 384; // all-MiniLM-L6-v2 dimensions
      },
      message: 'Embedding must be an array of 384 numbers'
    }
  },
  metadata: {
    title: String,
    documentTitle: String
  }
}, {
  timestamps: true
});

// Compound index for efficient querying
documentChunkSchema.index({ projectId: 1, documentId: 1 });
documentChunkSchema.index({ projectId: 1, chunkIndex: 1 });

export default mongoose.model('DocumentChunk', documentChunkSchema);
