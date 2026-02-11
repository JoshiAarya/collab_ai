import mongoose from 'mongoose';

const discussionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isMain: {
    type: Boolean,
    default: false // main discussion vs parallel
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

discussionSchema.index({ projectId: 1, isMain: -1 });
discussionSchema.index({ lastActivity: -1 });

export default mongoose.model('Discussion', discussionSchema);
