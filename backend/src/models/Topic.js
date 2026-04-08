import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  name: { type: String, required: true, trim: true },
  normalizedName: { type: String, required: true },
  embedding: {
    type: [Number],
    default: null,
    validate: {
      validator: v => v === null || (Array.isArray(v) && v.length === 384),
      message: 'Embedding must be 384-dim or null'
    }
  },
  count: { type: Number, default: 1 },
  // candidate = seen < 3 times, stable = seen >= 3 times (shown on dashboard)
  status: {
    type: String,
    enum: ['candidate', 'stable', 'resolved', 'parked'],
    default: 'candidate'
  },
  firstSeenAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now },
  sourceDiscussionIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion'
  }]
}, { timestamps: true });

topicSchema.index({ projectId: 1, normalizedName: 1 }, { unique: true });
topicSchema.index({ projectId: 1, status: 1, count: -1 });

export default mongoose.model('Topic', topicSchema);
