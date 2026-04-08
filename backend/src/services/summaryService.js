import Summary from '../models/Summary.js';

class SummaryService {
  // Create summary
  async createSummary(projectId, discussionId, content, type = 'discussion', generatedBy = 'server', messageCountAtSummary = 0) {
    try {
      const summary = new Summary({
        projectId,
        discussionId,
        content,
        type,
        generatedBy,
        messageCountAtSummary,
        messageRange: {
          start: new Date(),
          end: new Date()
        }
      });

      await summary.save();
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
        { content: newContent },
        { new: true }
      ).lean();
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
      throw error;
    }
  }
}

export default new SummaryService();
