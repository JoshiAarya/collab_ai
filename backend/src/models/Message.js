import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    trim: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // optional for backward compatibility
  },
  text: {
    type: String,
    required: true
  },
  roomId: {
    type: String,
    required: false, // legacy support
    default: 'general'
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: false // new structure
  },
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: false // new structure
  },
  timestamp: {
    type: Number,
    required: true,
    default: Date.now
  },
  isAI: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for better query performance
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, createdAt: -1 });
messageSchema.index({ discussionId: 1, timestamp: 1 });
messageSchema.index({ discussionId: 1, _id: -1 }); // pagination (?before=<id>)
messageSchema.index({ projectId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);