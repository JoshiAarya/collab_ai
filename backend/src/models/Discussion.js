import mongoose from 'mongoose';

const discussionSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    index: true
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
    default: false
  },
  // Graph structure
  parentDiscussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    default: null,
    index: true
  },
  branchDepth: {
    type: Number,
    default: 0
  },
  // Participants
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Metadata
  lastActivity: {
    type: Date,
    default: Date.now
  },
  messageCount: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['active', 'archived'],
    default: 'active'
  }
}, {
  timestamps: true
});

discussionSchema.index({ projectId: 1, status: 1 });
discussionSchema.index({ parentDiscussionId: 1 });
discussionSchema.index({ lastActivity: -1 });

// Methods for graph traversal
discussionSchema.methods.getLineage = async function() {
  const lineage = [this._id];
  let current = this;
  
  while (current.parentDiscussionId) {
    current = await this.model('Discussion').findById(current.parentDiscussionId);
    if (!current) break;
    lineage.unshift(current._id);
  }
  
  return lineage;
};

discussionSchema.methods.getChildren = async function() {
  return await this.model('Discussion').find({ 
    parentDiscussionId: this._id,
    $or: [
      { status: 'active' },
      { status: { $exists: false } }
    ]
  });
};

export default mongoose.model('Discussion', discussionSchema);
