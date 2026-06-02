import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 20
  },
  email: {
    type: String,
    required: false, // optional for legacy users
    sparse: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: false // optional for OAuth users
  },
  authProvider: {
    type: String,
    enum: ['local', 'google'],
    default: 'local'
  },
  googleId: {
    type: String,
    sparse: true
  },
  // Profile fields
  bio: {
    type: String,
    maxlength: 200,
    default: ''
  },
  theme: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  joinedRooms: [{
    type: String,
    default: []
  }],
  messageCount: {
    type: Number,
    default: 0
  },
  projects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }]
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });
userSchema.index({ lastSeen: -1 });
userSchema.index({ isOnline: -1 });

export default mongoose.model('User', userSchema);