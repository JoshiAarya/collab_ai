import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Project from '../models/Project.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/collab-ai';

async function migrateToGroq() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Update all projects to use Groq/Llama
    const result = await Project.updateMany(
      {},
      {
        $set: {
          'activeLLM.provider': 'server',
          'activeLLM.model': 'llama-3.1-8b-instant'
        }
      }
    );

    console.log(`✅ Updated ${result.modifiedCount} projects to use Groq (Llama 3.1)`);
    console.log('All projects now use the free Groq API!');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error migrating projects:', error);
    process.exit(1);
  }
}

migrateToGroq();
