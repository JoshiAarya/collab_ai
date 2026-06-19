import Summary from '../models/Summary.js';
import Message from '../models/Message.js';
import EmbeddingService from '../core/embeddings/EmbeddingService.js';

class SummaryService {
  // Create summary
  async createSummary(projectId, discussionId, content, type = 'discussion', generatedBy = 'server', messageCountAtSummary = 0) {
    try {
      let start = new Date();
      let end = new Date();

      const firstMsg = await Message.findOne({ discussionId }).sort({ timestamp: 1 }).select('timestamp').lean();
      const lastMsg = await Message.findOne({ discussionId }).sort({ timestamp: -1 }).select('timestamp').lean();
      if (firstMsg && lastMsg) {
        start = firstMsg.timestamp;
        end = lastMsg.timestamp;
      }

      const summary = new Summary({
        projectId,
        discussionId,
        content,
        type,
        generatedBy,
        messageCountAtSummary,
        messageRange: { start, end }
      });

      await summary.save();

      // Trigger embedding asynchronously
      this._embedSummaryAsync(summary).catch(err => 
        console.error('Failed to trigger background embedding for summary:', err)
      );

      return summary;
    } catch (error) {
      console.error('Error creating summary:', error);
      throw error;
    }
  }

  // Get project summaries
  async getProjectSummaries(projectId, limit = 10) {
    try {
      const summaries = await Summary.find({ projectId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

      return summaries;
    } catch (error) {
      console.error('Error getting summaries:', error);
      return [];
    }
  }

  // Get discussion summaries
  async getDiscussionSummaries(discussionId, limit = null) {
    try {
      let query = Summary.find({ discussionId })
        .sort({ createdAt: -1 });
      
      if (limit) {
        query = query.limit(limit);
      }

      const summaries = await query.lean();
      return summaries;
    } catch (error) {
      console.error('Error getting discussion summaries:', error);
      return [];
    }
  }

  // Get summaries by type
  async getSummariesByType(projectId, type) {
    try {
      const summaries = await Summary.find({ projectId, type })
        .sort({ createdAt: -1 })
        .lean();

      return summaries;
    } catch (error) {
      console.error('Error getting summaries by type:', error);
      return [];
    }
  }

  // Get summary by ID
  async getSummaryById(summaryId) {
    try {
      const summary = await Summary.findById(summaryId).lean();
      return summary;
    } catch (error) {
      console.error('Error getting summary by ID:', error);
      return null;
    }
  }

  // Update summary
  async updateSummary(summaryId, newContent) {
    try {
      const summary = await Summary.findByIdAndUpdate(
        summaryId,
        { content: newContent, embeddingStatus: 'pending' },
        { new: true }
      ).lean();

      if (summary) {
        this._embedSummaryAsync(summary).catch(err => 
          console.error('Failed to trigger background embedding for updated summary:', err)
        );
      }

      return summary;
    } catch (error) {
      console.error('Error updating summary:', error);
      throw error;
    }
  }

  // Delete summary
  async deleteSummary(summaryId) {
    try {
      await Summary.findByIdAndDelete(summaryId);
      return true;
    } catch (error) {
      console.error('Error deleting summary:', error);
      return false;
    }
  }

  // Internal helper to embed a summary asynchronously
  async _embedSummaryAsync(summary) {
    try {
      const embedding = await EmbeddingService.embedText(summary.content);
      if (embedding) {
        await Summary.findByIdAndUpdate(summary._id, {
          embedding,
          embeddingStatus: 'done'
        });
      } else {
        await Summary.findByIdAndUpdate(summary._id, {
          embeddingStatus: 'failed'
        });
      }
    } catch (error) {
      console.error(`Error embedding summary ${summary._id}:`, error);
      await Summary.findByIdAndUpdate(summary._id, {
        embeddingStatus: 'failed'
      });
    }
  }
}

export default new SummaryService();
