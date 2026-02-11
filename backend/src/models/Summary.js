import mongoose from 'mongoose';

const summarySchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['discussion', 'decision', 'blocker', 'insight'],
    default: 'discussion'
  },
  generatedBy: {
    type: String,
    default: 'server' // which LLM generated this
  },
  messageRange: {
    start: Date,
    end: Date
  },
  embedding: {
    type: [Number],
    default: null
  }
}, {
  timestamps: true
});

summarySchema.index({ projectId: 1, createdAt: -1 });
summarySchema.index({ discussionId: 1 });

export default mongoose.model('Summary', summarySchema);
