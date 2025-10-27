const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  article: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Article',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  }
}, {
  timestamps: true
});

// Ensure one rating per user per article
ratingSchema.index({ article: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
