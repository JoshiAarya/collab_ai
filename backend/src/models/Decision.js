import mongoose from 'mongoose';

const decisionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  rationale: { type: String, default: '' },
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    username: String
  },
  sourceMessageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  },
  embedding: {
    type: [Number],
    default: undefined  // sparse — only set when embedded
  },
  embeddingStatus: {
    type: String,
    enum: ['pending', 'done', 'failed'],
    default: 'pending'
  },
  timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

decisionSchema.index({ projectId: 1, timestamp: -1 });
decisionSchema.index({ projectId: 1, embeddingStatus: 1 });

export default mongoose.model('Decision', decisionSchema);
