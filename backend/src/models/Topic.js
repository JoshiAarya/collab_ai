import mongoose from 'mongoose';

/**
 * Topic — a recurring theme in a project's conversation.
 * Lifecycle: candidate → stable (seen >= 3) → parked (no activity for 30 days).
 */
const topicSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: { type: String, required: true },
  normalizedName: { type: String, required: true },
  embedding: {
    type: [Number],
    default: undefined  // sparse — only set when embedded
  },
  occurrenceCount: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['candidate', 'stable', 'parked'],
    default: 'candidate'
  },
  supportingMessageIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Message' }],
  firstSeenAt: { type: Number, default: Date.now },
  lastSeenAt: { type: Number, default: Date.now }
}, { timestamps: true });

topicSchema.index({ projectId: 1, status: 1 });
topicSchema.index({ projectId: 1, normalizedName: 1 });

export default mongoose.model('Topic', topicSchema);
