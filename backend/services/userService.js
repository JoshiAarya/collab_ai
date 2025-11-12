import User from '../models/User.js';

class UserService {
  // Get or create user
  async getOrCreateUser(username) {
    try {
      let user = await User.findOne({ username: username.trim() });
      
      if (!user) {
        user = new User({
          username: username.trim(),
          lastSeen: new Date(),
          isOnline: true
        });
        await user.save();
        console.log(`👤 New user created: ${username}`);
      } else {
        // Update last seen and online status
        user.lastSeen = new Date();
        user.isOnline = true;
        await user.save();
      }
      
      return user.toObject();
    } catch (error) {
      console.error('Error getting/creating user:', error);
      throw error;
    }
  }

  // Update user online status
  async setUserOnline(username, isOnline = true) {
    try {
      await User.findOneAndUpdate(
        { username },
        { 
          isOnline,
          lastSeen: new Date()
        }
      );
    } catch (error) {
      console.error('Error updating user online status:', error);
    }
  }

  // Increment user message count
  async incrementMessageCount(username) {
    try {
      await User.findOneAndUpdate(
        { username },
        { 
          $inc: { messageCount: 1 },
          lastSeen: new Date()
        }
      );
    } catch (error) {
      console.error('Error incrementing message count:', error);
    }
  }

  // Get online users
  async getOnlineUsers() {
    try {
      const users = await User
        .find({ isOnline: true })
        .select('username lastSeen')
        .sort({ lastSeen: -1 })
        .lean();

      return users;
    } catch (error) {
      console.error('Error fetching online users:', error);
      return [];
    }
  }

  // Get user statistics
  async getUserStats(username) {
    try {
      const user = await User.findOne({ username }).lean();
      return user || null;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      return null;
    }
  }

  // Get all users with stats
  async getAllUsersWithStats() {
    try {
      const users = await User
        .find()
        .select('username messageCount lastSeen isOnline createdAt')
        .sort({ messageCount: -1 })
        .lean();

      return users;
    } catch (error) {
      console.error('Error fetching users with stats:', error);
      return [];
    }
  }

  // Clean up offline users (mark users as offline if not seen for X minutes)
  async cleanupOfflineUsers(minutesThreshold = 5) {
    try {
      const cutoffTime = new Date(Date.now() - minutesThreshold * 60 * 1000);
      
      const result = await User.updateMany(
        { 
          isOnline: true,
          lastSeen: { $lt: cutoffTime }
        },
        { isOnline: false }
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Marked ${result.modifiedCount} users as offline`);
      }
      
      return result.modifiedCount;
    } catch (error) {
      console.error('Error cleaning up offline users:', error);
      return 0;
    }
  }
}

export default new UserService();