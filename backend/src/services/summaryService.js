import Summary from '../models/Summary.js';

class SummaryService {
  // Create summary
  async createSummary(projectId, discussionId, content, type = 'discussion', generatedBy = 'server') {
    try {
      const summary = new Summary({
        projectId,
        discussionId,
        content,
        type,
        generatedBy,
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
  async getDiscussionSummaries(discussionId) {
    try {
      const summaries = await Summary.find({ discussionId })
        .sort({ createdAt: -1 })
        .lean();

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
}

export default new SummaryService();
