import Room from '../models/Room.js';

class RoomService {
  // Get all rooms
  async getAllRooms() {
    try {
      const rooms = await Room
        .find()
        .sort({ lastActivity: -1 })
        .lean();

      return rooms;
    } catch (error) {
      console.error('Error fetching rooms:', error);
      throw error;
    }
  }

  // Create a new room
  async createRoom(name, description = '', createdBy = 'System', isPrivate = false) {
    try {
      // Check if room already exists
      const existingRoom = await Room.findOne({ name: name.trim() });
      if (existingRoom) {
        throw new Error('Room already exists');
      }

      const room = new Room({
        name: name.trim(),
        description,
        createdBy,
        isPrivate,
        lastActivity: new Date()
      });

      const savedRoom = await room.save();
      return savedRoom.toObject();
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }

  // Get room by name
  async getRoomByName(name) {
    try {
      const room = await Room.findOne({ name }).lean();
      return room;
    } catch (error) {
      console.error('Error fetching room:', error);
      throw error;
    }
  }

  // Update room activity
  async updateRoomActivity(roomId) {
    try {
      await Room.findOneAndUpdate(
        { name: roomId },
        { lastActivity: new Date() }
      );
    } catch (error) {
      console.error('Error updating room activity:', error);
    }
  }

  // Delete room
  async deleteRoom(name, deletedBy) {
    try {
      const result = await Room.deleteOne({ name });
      return result.deletedCount > 0;
    } catch (error) {
      console.error('Error deleting room:', error);
      throw error;
    }
  }

  // Initialize default rooms
  async initializeDefaultRooms() {
    try {
      const defaultRooms = [
        { name: 'general', description: 'General discussion', createdBy: 'System' },
        { name: 'random', description: 'Random conversations', createdBy: 'System' },
        { name: 'help', description: 'Ask for help here', createdBy: 'System' }
      ];

      for (const roomData of defaultRooms) {
        const existing = await this.getRoomByName(roomData.name);
        if (!existing) {
          await this.createRoom(roomData.name, roomData.description, roomData.createdBy);
          console.log(`✅ Created default room: ${roomData.name}`);
        }
      }
    } catch (error) {
      console.error('Error initializing default rooms:', error);
    }
  }
}

export default new RoomService();