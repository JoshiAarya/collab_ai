import mongoose from 'mongoose';

const messageEmbeddingSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  discussionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Discussion',
    required: true
  },
  messageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    required: true,
    unique: true
  },
  content: { type: String, required: true },
  embedding: {
    type: [Number],
    required: true,
    validate: [
      val => val.length === 384,
      'Embedding must be exactly 384 dimensions'
    ]
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  username: String,
  timestamp: { type: Number, default: Date.now }
}, { timestamps: true });

messageEmbeddingSchema.index({ projectId: 1 });
messageEmbeddingSchema.index({ projectId: 1, timestamp: -1 }); // bounded recent-N retrieval

export default mongoose.model('MessageEmbedding', messageEmbeddingSchema);
