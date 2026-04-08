import mongoose from 'mongoose';

const projectStateSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  stage: {
    type: String,
    enum: ['ideation', 'design', 'discussion', 'blocked', 'completed'],
    default: 'ideation'
  },
  stageReason: { type: String, default: '' },
  summary: { type: String, default: '' },
  pinnedContext: { type: String, default: '' }, // FIX 5: pre-built context string
  momentum: {
    recentMessageCount: { type: Number, default: 0 },
    previousMessageCount: { type: Number, default: 0 },
    trend: {
      type: String,
      enum: ['rising', 'stable', 'falling'],
      default: 'stable'
    }
  },
  openBlockerCount: { type: Number, default: 0 },
  unresolvedActionCount: { type: Number, default: 0 },
  activeTopicCount: { type: Number, default: 0 },
  lastDecisionAt: { type: Date, default: null },
  lastUpdated: { type: Date, default: Date.now }
}, { timestamps: true });

// FIX 9: single unique index — no duplicate
projectStateSchema.index({ projectId: 1 }, { unique: true });

export default mongoose.model('ProjectState', projectStateSchema);
