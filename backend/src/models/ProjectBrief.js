import mongoose from 'mongoose';

const projectBriefSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
    unique: true
  },
  content: {
    type: String,
    required: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export default mongoose.model('ProjectBrief', projectBriefSchema);
