import Discussion from '../models/Discussion.js';
import Message from '../models/Message.js';
import '../models/User.js'; // ensure User schema is registered for populate('participants')

class DiscussionService {
  // Get project discussions
  async getProjectDiscussions(projectId) {
    try {
      const discussions = await Discussion.find({ 
        projectId,
        $or: [
          { status: 'active' },
          { status: { $exists: false } } // Support old discussions without status field
        ]
      })
        .populate('participants', 'username email')
        .sort({ isMain: -1, lastActivity: -1 })
        .lean();

      return discussions;
    } catch (error) {
      console.error('Error getting discussions:', error);
      throw error;
    }
  }

  // Create parallel discussion
  async createDiscussion(projectId, title, description, creatorId, ownerId, parentDiscussionId = null) {
    try {
      const participants = [creatorId];
      if (ownerId && ownerId.toString() !== creatorId.toString()) {
        participants.push(ownerId);
      }

      // Calculate branch depth
      let branchDepth = 0;
      if (parentDiscussionId) {
        const parent = await Discussion.findById(parentDiscussionId);
        if (parent) {
          branchDepth = parent.branchDepth + 1;
        }
      }

      const discussion = new Discussion({
        projectId,
        title: title.trim(),
        description,
        isMain: false,
        participants,
        creatorId,
        parentDiscussionId,
        branchDepth
      });

      await discussion.save();
      return discussion;
    } catch (error) {
      console.error('Error creating discussion:', error);
      throw error;
    }
  }

  // Get discussion graph
  async getDiscussionGraph(projectId) {
    try {
      const discussions = await Discussion.find({ 
        projectId,
        $or: [
          { status: 'active' },
          { status: { $exists: false } }
        ]
      })
        .select('_id title parentDiscussionId branchDepth messageCount lastActivity')
        .lean();

      return discussions;
    } catch (error) {
      console.error('Error getting discussion graph:', error);
      throw error;
    }
  }

  // Get discussion by ID
  async getDiscussionById(discussionId) {
    try {
      const discussion = await Discussion.findById(discussionId)
        .populate('participants', 'username email')
        .lean();
      return discussion;
    } catch (error) {
      console.error('Error getting discussion:', error);
      return null;
    }
  }

  // Get discussion messages
  async getDiscussionMessages(discussionId, limit = 100) {
    try {
      const messages = await Message.find({ discussionId })
        .sort({ timestamp: -1 })  // Sort descending (newest first)
        .limit(limit)
        .lean();

      // Reverse to get chronological order (oldest to newest)
      return messages.reverse();
    } catch (error) {
      console.error('Error getting discussion messages:', error);
      return [];
    }
  }

  // Add message to discussion
  async addMessage(discussionId, projectId, userId, username, text, isAI = false) {
    try {
      const message = new Message({
        discussionId,
        projectId,
        userId,
        user: username,
        text,
        timestamp: Date.now(),
        isAI
      });

      await message.save();

      // Update discussion activity
      await Discussion.findByIdAndUpdate(discussionId, {
        lastActivity: new Date(),
        $inc: { messageCount: 1 }
      });

      return message;
    } catch (error) {
      console.error('Error adding message:', error);
      throw error;
    }
  }

  // Join discussion
  async joinDiscussion(discussionId, userId) {
    try {
      await Discussion.findByIdAndUpdate(discussionId, {
        $addToSet: { participants: userId }
      });
    } catch (error) {
      console.error('Error joining discussion:', error);
    }
  }
}

export default new DiscussionService();
