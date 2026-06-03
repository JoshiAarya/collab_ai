import mongoose from 'mongoose';

/**
 * Blocker — an impediment or open problem raised in conversation.
 * Surfaces on the dashboard when occurrenceCount >= 2 OR severity === 'high'.
 */
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
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  supportingMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  occurrenceCount: { type: Number, default: 1 },
  resolved: { type: Boolean, default: false },
  embedding: {
    type: [Number],
    default: undefined  // sparse — only set when embedded
  },
  raisedAt: { type: Number, default: Date.now },
  lastSeenAt: { type: Number, default: Date.now }
}, { timestamps: true });

blockerSchema.index({ projectId: 1, resolved: 1 });
blockerSchema.index({ projectId: 1, raisedAt: -1 });

export default mongoose.model('Blocker', blockerSchema);
