/**
 * ProjectInsights Model - PHASE 3
 * Persistent aggregated intelligence extracted from AI responses
 * Incrementally updated, never reprocessed
 */

import mongoose from 'mongoose';

const projectInsightsSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true
  },
  topics: [{
    name: {
      type: String,
      required: true
    },
    count: {
      type: Number,
      default: 1
    }
  }],
  decisions: [{
    text: {
      type: String,
      required: true
    },
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  blockers: [{
    text: {
      type: String,
      required: true
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },
    resolved: {
      type: Boolean,
      default: false
    },
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  actionItems: [{
    text: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['open', 'in-progress', 'completed'],
      default: 'open'
    },
    discussionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Discussion'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient querying
projectInsightsSchema.index({ projectId: 1 }, { unique: true });
projectInsightsSchema.index({ lastUpdated: -1 });

export default mongoose.model('ProjectInsights', projectInsightsSchema);
