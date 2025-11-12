import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  user: {
    type: String,
    required: true,
    trim: true
  },
  text: {
    type: String,
    required: true
  },
  roomId: {
    type: String,
    required: true,
    default: 'general'
  },
  timestamp: {
    type: Number,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for better query performance
messageSchema.index({ roomId: 1, timestamp: -1 });
messageSchema.index({ roomId: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);