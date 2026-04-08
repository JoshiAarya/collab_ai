import mongoose from 'mongoose';

const blockerSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  resolved: { type: Boolean, default: false },
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Decision',
    default: null
  },
  topicId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Topic',
    default: null
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    default: null
  },
  raisedAt: { type: Date, default: Date.now },
  resolvedAt: { type: Date, default: null },
  occurrenceCount: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now },
  supportingMessageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: null }
  }
}, { timestamps: true });

blockerSchema.index({ projectId: 1, resolved: 1 });
blockerSchema.index({ projectId: 1, severity: -1 });
blockerSchema.index({ projectId: 1, raisedAt: 1 });

export default mongoose.model('Blocker', blockerSchema);
