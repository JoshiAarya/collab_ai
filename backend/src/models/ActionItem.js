import mongoose from 'mongoose';

const actionItemSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'in-progress', 'completed'],
    default: 'open'
  },
  assignee: { type: String, default: null },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  blockerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blocker',
    default: null
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    default: null
  },
  supportingMessageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  occurrenceCount: { type: Number, default: 1 },
  completedAt: { type: Date, default: null },
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: null }
  }
}, { timestamps: true });

actionItemSchema.index({ projectId: 1, status: 1 });
actionItemSchema.index({ projectId: 1, topicId: 1 });
actionItemSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model('ActionItem', actionItemSchema);
