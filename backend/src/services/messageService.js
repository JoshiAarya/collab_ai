import Message from '../models/Message.js';

class MessageService {
  // Get all messages for a room (with optional limit and pagination)
  async getAllMessages(roomId = 'general', limit = 100, skip = 0) {
    try {
      const messages = await Message
        .find({ roomId })
        .sort({ timestamp: 1 }) // Oldest first for chat display
        .skip(skip)
        .limit(limit)
        .lean(); // Returns plain JS objects for better performance

      return messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  // Create a new message
  async createMessage(user, text, roomId = 'general', timestamp = Date.now()) {
    try {
      const message = new Message({
        user: user.trim(),
        text,
        roomId,
        timestamp
      });

      const savedMessage = await message.save();
      return savedMessage.toObject(); // Convert to plain object
    } catch (error) {
      console.error('Error creating message:', error);
      throw error;
    }
  }

  // Get recent messages for a room (for new connections)
  async getRecentMessages(roomId = 'general', limit = 50) {
    try {
      const messages = await Message
        .find({ roomId })
        .sort({ timestamp: -1 }) // Newest first
        .limit(limit)
        .lean();

      return messages.reverse(); // Reverse to show oldest first in chat
    } catch (error) {
      console.error('Error fetching recent messages:', error);
      throw error;
    }
  }

  // Get message count (for stats)
  async getMessageCount(roomId = null) {
    try {
      const filter = roomId ? { roomId } : {};
      return await Message.countDocuments(filter);
    } catch (error) {
      console.error('Error counting messages:', error);
      return 0;
    }
  }

  // Get all rooms with message counts
  async getRoomsWithStats() {
    try {
      const rooms = await Message.aggregate([
        {
          $group: {
            _id: '$roomId',
            messageCount: { $sum: 1 },
            lastMessage: { $max: '$timestamp' }
          }
        },
        {
          $sort: { lastMessage: -1 }
        }
      ]);

      return rooms.map(room => ({
        roomId: room._id,
        messageCount: room.messageCount,
        lastActivity: new Date(room.lastMessage)
      }));
    } catch (error) {
      console.error('Error fetching room stats:', error);
      return [];
    }
  }

  // Delete old messages (cleanup utility)
  async deleteOldMessages(daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      const result = await Message.deleteMany({
        createdAt: { $lt: cutoffDate }
      });

      console.log(`🧹 Deleted ${result.deletedCount} old messages`);
      return result.deletedCount;
    } catch (error) {
      console.error('Error deleting old messages:', error);
      throw error;
    }
  }
}

export default new MessageService();