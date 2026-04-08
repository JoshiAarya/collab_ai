import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  problemStatement: {
    type: String,
    required: true
  },
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    role: {
      type: String,
      enum: ['owner', 'member'],
      default: 'member'
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeLLM: {
    provider: {
      type: String,
      enum: ['groq', 'gemini', 'openai', 'claude', 'deepseek', 'anthropic', 'google', 'server'],
      default: 'server'
    },
    model: {
      type: String,
      default: 'llama-3.1-8b-instant'
    },
    apiKey: String // encrypted in production
  },
  apiKeys: {
    type: Map,
    of: String,
    default: {}
  },
  stage: {
    type: String,
    enum: ['ideation', 'design', 'discussion', 'blocked', 'completed'],
    default: 'ideation'
  },
  inviteCode: {
    type: String
  }
}, {
  timestamps: true
});

projectSchema.index({ ownerId: 1 });
projectSchema.index({ 'members.userId': 1 });
projectSchema.index({ inviteCode: 1 }, { unique: true, sparse: true });

export default mongoose.model('Project', projectSchema);
