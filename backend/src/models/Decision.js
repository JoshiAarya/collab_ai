import mongoose from 'mongoose';

const decisionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  text: { type: String, required: true },
  rationale: { type: String, default: '' },
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
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  resolvedBlockerIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blocker'
  }],
  documentIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  }],
  supportingMessageIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }],
  occurrenceCount: { type: Number, default: 1 },
  status: {
    type: String,
    enum: ['active', 'superseded', 'reverted'],
    default: 'active'
  },
  supersededBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Decision',
    default: null
  },
  needsHumanValidation: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now },
  proposedBy: {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    username: { type: String, default: null }
  }
}, { timestamps: true });

decisionSchema.index({ projectId: 1, timestamp: -1 });
decisionSchema.index({ projectId: 1, topicId: 1 });
decisionSchema.index({ projectId: 1, status: 1 });
decisionSchema.index({ projectId: 1, status: 1, needsHumanValidation: 1 });

export default mongoose.model('Decision', decisionSchema);
