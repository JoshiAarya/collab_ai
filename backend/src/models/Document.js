import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
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
  content: {
    type: String,
    required: true
  },
  fileType: {
    type: String,
    enum: ['text', 'pdf'],
    default: 'text'
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  embedding: {
    type: [Number], // vector embedding (can be null for MVP)
    default: null
  },
  chunks: [{
    text: String,
    embedding: [Number]
  }]
}, {
  timestamps: true
});

documentSchema.index({ projectId: 1 });
documentSchema.index({ uploadedBy: 1 });

export default mongoose.model('Document', documentSchema);
