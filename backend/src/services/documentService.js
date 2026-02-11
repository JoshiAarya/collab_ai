import Document from '../models/Document.js';

class DocumentService {
  // Upload document
  async uploadDocument(projectId, title, content, fileType, uploadedBy) {
    try {
      const document = new Document({
        projectId,
        title: title.trim(),
        content,
        fileType,
        uploadedBy
      });

      // For MVP: skip embeddings or use simple mock
      // In production: generate embeddings here

      await document.save();
      return document;
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  // Get project documents
  async getProjectDocuments(projectId) {
    try {
      const documents = await Document.find({ projectId })
        .populate('uploadedBy', 'username')
        .sort({ createdAt: -1 })
        .lean();

      return documents;
    } catch (error) {
      console.error('Error getting documents:', error);
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
      console.error('Error getting document:', error);
      return null;
    }
  }

  // Delete document
  async deleteDocument(documentId) {
    try {
      await Document.findByIdAndDelete(documentId);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
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
      console.error('Error searching documents:', error);
      return [];
    }
  }
}

export default new DocumentService();
