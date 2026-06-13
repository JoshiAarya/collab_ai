import mongoose from 'mongoose';

/**
 * ActionItem — a task or next step that emerged from discussion.
 */
const actionItemSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  status: {
    type: String,
    enum: ['open', 'done'],
    default: 'open'
  },
  topicId: { type: mongoose.Schema.Types.ObjectId, ref: 'Topic' },
  supportingMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  occurrenceCount: { type: Number, default: 1 },
  embedding: {
    type: [Number],
    default: undefined  // sparse — only set when embedded
  },
  raisedAt: { type: Number, default: Date.now },
  lastSeenAt: { type: Number, default: Date.now }
}, { timestamps: true });

actionItemSchema.index({ projectId: 1, status: 1 });
actionItemSchema.index({ projectId: 1, raisedAt: -1 });

export default mongoose.model('ActionItem', actionItemSchema);
