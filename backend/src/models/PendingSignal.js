import mongoose from 'mongoose';

const pendingSignalSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
  discussionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Discussion' },
  type: { type: String, enum: ['decision', 'blocker', 'action', 'noise'] },
  tier: { type: Number, enum: [1, 2, 3] },
  confidence: { type: Number, default: 0 },
  isUncertain: { type: Boolean, default: false },
  rawText: { type: String },
  messageId: { type: mongoose.Schema.Types.ObjectId, ref: 'Message' },
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: { type: String }
  },
  timestamp: { type: Number },
  status: { type: String, enum: ['pending', 'confirmed', 'dismissed', 'auto_captured', 'low_confidence'], default: 'pending' },
  normalizedText: { type: String },
  entityType: { type: String }
});

const PendingSignal = mongoose.models.PendingSignal || mongoose.model('PendingSignal', pendingSignalSchema);
export default PendingSignal;
