import mongoose from 'mongoose';

/**
 * ProjectState — a single rollup document per project, recomputed after every
 * knowledge-aggregation pass. Provides the dashboard header and the
 * `pinnedContext` string injected into every AI system prompt.
 */
const projectStateSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  stage: {
    type: String,
    enum: ['ideation', 'discussion', 'blocked'],
    default: 'ideation'
  },
  momentum: {
    type: String,
    enum: ['rising', 'stable', 'falling'],
    default: 'stable'
  },
  openBlockerCount: { type: Number, default: 0 },
  unresolvedActionCount: { type: Number, default: 0 },
  activeTopicCount: { type: Number, default: 0 },
  decisionCount: { type: Number, default: 0 },
  pinnedContext: { type: String, default: '' },
  lastUpdated: { type: Number, default: Date.now }
}, { timestamps: true });

export default mongoose.model('ProjectState', projectStateSchema);
