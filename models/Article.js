const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  summary: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  image: {
    type: String,
    required: true
  },
  video: {
    type: String,
    required: false
  },
  category: {
    type: String,
    required: true,
    trim: true
  },
  views: {
    type: Number,
    default: 0
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  published: {
    type: Boolean,
    default: true
  },
  scheduledPublishDate: {
    type: Date
  },
  featured: {
    type: Boolean,
    default: false
  },
  seoTitle: {
    type: String,
    trim: true
  },
  seoDescription: {
    type: String,
    trim: true
  },
  seoKeywords: [String],
  lastEditedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  editHistory: [{
    editedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    editedAt: {
      type: Date,
      default: Date.now
    },
    changes: String
  }]
}, {
  timestamps: true
});

// Create text index for search
articleSchema.index({ title: 'text', summary: 'text', content: 'text' });

module.exports = mongoose.model('Article', articleSchema);
