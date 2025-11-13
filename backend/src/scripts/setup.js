import connectDB from '../config/database.js';
import messageService from '../services/messageService.js';
import roomService from '../services/roomService.js';
import userService from '../services/userService.js';
import dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  try {
    console.log('🚀 Setting up database...');
    
    // Connect to MongoDB
    await connectDB();
    
    // Initialize default rooms
    await roomService.initializeDefaultRooms();
    
    // Test database connection
    const count = await messageService.getMessageCount();
    console.log(`📊 Current messages in database: ${count}`);
    
    const rooms = await roomService.getAllRooms();
    console.log(`🏠 Available rooms: ${rooms.map(r => r.name).join(', ')}`);
    
    const users = await userService.getAllUsersWithStats();
    console.log(`👥 Total users: ${users.length}`);
    
    console.log('✅ Database setup complete!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setupDatabase();