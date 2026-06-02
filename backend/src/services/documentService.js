import Document from '../models/Document.js';
import DocumentChunk from '../models/DocumentChunk.js';
import EmbeddingService from '../core/embeddings/EmbeddingService.js';
import { chunkText } from '../utils/chunking.js';
import logger from '../utils/logger.js';

class DocumentService {
  // Upload document with embedding generation
  async uploadDocument(projectId, title, content, fileType, uploadedBy) {
    try {
      // Save document first
      const document = new Document({
        projectId,
        title: title.trim(),
        content,
        fileType,
        uploadedBy
      });

      await document.save();
      
      logger.info('Document uploaded', {
        documentId: document._id,
        projectId,
        title,
        contentLength: content.length
      });

      // Generate embeddings asynchronously (don't block upload)
      this.generateEmbeddingsForDocument(document).catch(error => {
        logger.error('Failed to generate embeddings for document', {
          documentId: document._id,
          error: error.message
        });
      });
      
      return document;
    } catch (error) {
      logger.error('Error uploading document', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate embeddings for a document (PHASE 2)
   */
  async generateEmbeddingsForDocument(document) {
    try {
      logger.ai('Starting embedding generation for document', {
        documentId: document._id,
        title: document.title,
        contentLength: document.content.length
      });

      // Chunk the document
      const chunks = chunkText(document.content, 900, 100);

      if (chunks.length === 0) {
        logger.warn('No chunks generated for document', {
          documentId: document._id
        });
        return;
      }

      logger.ai('Document chunked', {
        documentId: document._id,
        chunkCount: chunks.length
      });

      // Generate embeddings for each chunk
      const embeddings = await EmbeddingService.embedBatch(chunks);

      // Save chunks with embeddings
      const chunkDocuments = chunks.map((content, index) => ({
        projectId: document.projectId,
        documentId: document._id,
        chunkIndex: index,
        content,
        embedding: embeddings[index],
        metadata: {
          title: document.title,
          documentTitle: document.title
        }
      }));

      await DocumentChunk.insertMany(chunkDocuments);

      logger.ai('Embeddings stored', {
        documentId: document._id,
        chunkCount: chunks.length,
        embeddingDimensions: embeddings[0]?.length
      });

    } catch (error) {
      logger.error('Error generating embeddings for document', {
        documentId: document._id,
        error: error.message,
        stack: error.stack
      });
      // Don't throw - embedding generation is non-critical
    }
  }

  // Get project documents
  async getProjectDocuments(projectId) {
    try {
      const documents = await Document.find({ projectId })
        .populate('uploadedBy', 'username')
        .sort({ createdAt: -1 })
        .lean();

      // Add chunk count for each document
      const documentsWithChunks = await Promise.all(
        documents.map(async (doc) => {
          const chunkCount = await DocumentChunk.countDocuments({ documentId: doc._id });
          return {
            ...doc,
            chunks: Array(chunkCount).fill(null) // Just for count, not actual data
          };
        })
      );

      return documentsWithChunks;
    } catch (error) {
      logger.error('Error getting documents', { error: error.message });
      return [];
    }
  }

  // Get document by ID
  async getDocumentById(documentId) {
    try {
      const document = await Document.findById(documentId)
        .populate('uploadedBy', 'username email')
        .lean();
      return document;
    } catch (error) {
      logger.error('Error getting document', { error: error.message });
      return null;
    }
  }

  // Get document chunks with embeddings
  async getDocumentChunks(documentId) {
    try {
      const chunks = await DocumentChunk.find({ documentId })
        .sort({ chunkIndex: 1 })
        .lean();
      
      // Return chunks with embedding info (truncate embeddings for display)
      return chunks.map(chunk => ({
        _id: chunk._id,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
        embeddingDimensions: chunk.embedding?.length || 0,
        embeddingPreview: chunk.embedding?.slice(0, 5) || [], // First 5 values
        metadata: chunk.metadata,
        createdAt: chunk.createdAt
      }));
    } catch (error) {
      logger.error('Error getting document chunks', { error: error.message });
      return [];
    }
  }

  // Delete document and its chunks
  async deleteDocument(documentId) {
    try {
      // Delete document
      await Document.findByIdAndDelete(documentId);
      
      // Delete associated chunks
      await DocumentChunk.deleteMany({ documentId });
      
      logger.info('Document and chunks deleted', { documentId });
      return true;
    } catch (error) {
      logger.error('Error deleting document', { error: error.message });
      return false;
    }
  }

  // Search documents (simple text search for MVP)
  async searchDocuments(projectId, query) {
    try {
      const documents = await Document.find({
        projectId,
        $or: [
          { title: { $regex: query, $options: 'i' } },
          { content: { $regex: query, $options: 'i' } }
        ]
      })
      .populate('uploadedBy', 'username')
      .limit(10)
      .lean();

      return documents;
    } catch (error) {
      logger.error('Error searching documents', { error: error.message });
      return [];
    }
  }

  /**
   * Get chunk count for a document
   */
  async getDocumentChunkCount(documentId) {
    try {
      return await DocumentChunk.countDocuments({ documentId });
    } catch (error) {
      logger.error('Error getting chunk count', { error: error.message });
      return 0;
    }
  }

  /**
   * Get all chunks for a project
   */
  async getProjectChunks(projectId) {
    try {
      return await DocumentChunk.find({ projectId }).lean();
    } catch (error) {
      logger.error('Error getting project chunks', { error: error.message });
      return [];
    }
  }
}

export default new DocumentService();
