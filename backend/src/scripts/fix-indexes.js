import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-ai';

async function fixIndexes() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;

    // Drop duplicate indexes on users collection
    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('username_1');
      console.log('✅ Dropped old username index');
    } catch (error) {
      console.log('ℹ️ Username index already correct or not found');
    }

    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('email_1');
      console.log('✅ Dropped old email index');
    } catch (error) {
      console.log('ℹ️ Email index already correct or not found');
    }

    try {
      const usersCollection = db.collection('users');
      await usersCollection.dropIndex('googleId_1');
      console.log('✅ Dropped old googleId index');
    } catch (error) {
      console.log('ℹ️ GoogleId index already correct or not found');
    }

    // Drop duplicate indexes on projects collection
    try {
      const projectsCollection = db.collection('projects');
      await projectsCollection.dropIndex('inviteCode_1');
      console.log('✅ Dropped old inviteCode index');
    } catch (error) {
      console.log('ℹ️ InviteCode index already correct or not found');
    }

    console.log('\n✅ Index cleanup complete!');
    console.log('Please restart the server for changes to take effect.');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes();
