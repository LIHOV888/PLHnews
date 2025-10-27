const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();

// Import models
const Article = require('../models/Article');
const Comment = require('../models/Comment');
const Rating = require('../models/Rating');
const User = require('../models/User');

// Mock data for fallback when DB not connected
const mockArticles = [
  {
    _id: '1',
    id: 1,
    title: 'Breaking News: Major Event in Technology',
    summary: 'A significant development in the tech world has been announced today.',
    content: 'Full article content here...',
    date: new Date('2025-01-15'),
    image: 'https://picsum.photos/800/400?random=1',
    video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    category: 'Technology',
    views: 1500,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '2',
    id: 2,
    title: 'Sports Update: Championship Results',
    summary: 'The latest results from the championship games.',
    content: 'Full article content here...',
    date: new Date('2025-01-16'),
    image: 'https://picsum.photos/800/400?random=2',
    video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
    category: 'Sports',
    views: 1200,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '3',
    id: 3,
    title: 'Economy Boosts with New Green Initiatives',
    summary: 'Governments worldwide are investing in sustainable energy projects to combat climate change.',
    content: 'In a bold move to address environmental challenges, several countries have unveiled comprehensive plans for green energy transitions. These initiatives include massive investments in solar and wind power, aiming to reduce carbon emissions by 50% over the next decade. Experts predict this will create millions of jobs in the renewable sector while stabilizing global economies.',
    date: new Date('2025-01-17'),
    image: 'https://picsum.photos/800/400?random=3',
    category: 'Environment',
    views: 2000,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '4',
    id: 4,
    title: 'Health Breakthrough in Vaccine Research',
    summary: 'Scientists announce a new vaccine that could prevent multiple diseases.',
    content: 'A team of researchers has developed a universal vaccine platform capable of protecting against a wide range of viral infections. This innovative approach uses mRNA technology to train the immune system against common viral structures, potentially eliminating the need for seasonal flu shots and offering protection against emerging pandemics.',
    date: new Date('2025-01-18'),
    image: 'https://picsum.photos/800/400?random=4',
    category: 'Health',
    views: 1800,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '5',
    id: 5,
    title: 'Space Exploration Milestone Achieved',
    summary: 'Private company lands first commercial mission on Mars.',
    content: 'In a historic achievement, a private aerospace company has successfully landed a crewed mission on Mars. The mission, which lasted six months, collected valuable data on the planet\'s geology and potential for future colonization. This marks the beginning of a new era in space exploration, with plans for permanent settlements in the coming years.',
    date: new Date('2025-01-19'),
    image: 'https://picsum.photos/800/400?random=5',
    category: 'Science',
    views: 2200,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '6',
    id: 6,
    title: 'Education Reform Sparks Debate',
    summary: 'New curriculum changes aim to incorporate more technology in classrooms.',
    content: 'Educational institutions are adopting digital learning tools to enhance student engagement. The reform includes interactive AI tutors, virtual reality field trips, and personalized learning paths. While supporters praise the modernization, critics argue it may widen the digital divide for students without access to technology.',
    date: new Date('2025-01-20'),
    image: 'https://picsum.photos/800/400?random=6',
    category: 'Education',
    views: 1600,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '7',
    id: 7,
    title: 'Wildlife Conservation Success Story',
    summary: 'Endangered species population rebounds thanks to community efforts.',
    content: 'Through coordinated conservation efforts, the population of a critically endangered species has increased by 300% in the last five years. Local communities, NGOs, and governments worked together to protect habitats, combat poaching, and implement breeding programs. This success serves as a model for other conservation initiatives worldwide.',
    date: new Date('2025-01-21'),
    image: 'https://picsum.photos/800/400?random=7',
    category: 'Environment',
    views: 1900,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '8',
    id: 8,
    title: 'Artificial Intelligence in Daily Life',
    summary: 'AI assistants become more integrated into everyday tasks.',
    content: 'From smart homes to personalized shopping experiences, artificial intelligence is becoming an integral part of daily life. New AI systems can now predict user needs, manage schedules, and even provide emotional support. While convenience increases, experts warn about the importance of maintaining human oversight in AI decision-making.',
    date: new Date('2025-01-22'),
    image: 'https://picsum.photos/800/400?random=8',
    category: 'Technology',
    views: 2100,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '9',
    id: 9,
    title: 'Global Climate Summit Reaches Historic Agreement',
    summary: 'World leaders commit to ambitious carbon reduction targets.',
    content: 'At the annual Global Climate Summit, representatives from 195 countries signed a landmark agreement to cut greenhouse gas emissions by 70% by 2035. The pact includes funding for developing nations and technology transfers to accelerate the transition to renewable energy sources.',
    date: new Date('2025-01-23'),
    image: 'https://picsum.photos/800/400?random=9',
    category: 'Environment',
    views: 2400,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '10',
    id: 10,
    title: 'Revolutionary Quantum Computer Unveiled',
    summary: 'New quantum processor promises to solve complex problems instantly.',
    content: 'A leading tech company has unveiled a quantum computer capable of performing calculations that would take traditional supercomputers thousands of years. This breakthrough could revolutionize fields like drug discovery, financial modeling, and climate prediction.',
    date: new Date('2025-01-24'),
    image: 'https://picsum.photos/800/400?random=10',
    category: 'Technology',
    views: 2300,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '11',
    id: 11,
    title: 'Olympic Games Return to Original Format',
    summary: '2028 Olympics to feature all traditional sports after pandemic hiatus.',
    content: 'The International Olympic Committee announced that the 2028 Summer Olympics in Los Angeles will return to the full traditional format, including all sports that were canceled or modified during the global health crisis. This decision marks a full recovery for international sports.',
    date: new Date('2025-01-25'),
    image: 'https://picsum.photos/800/400?random=11',
    category: 'Sports',
    views: 1700,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '12',
    id: 12,
    title: 'Medical AI Diagnoses Diseases with 99% Accuracy',
    summary: 'New AI system outperforms human doctors in early disease detection.',
    content: 'A groundbreaking artificial intelligence system has achieved 99% accuracy in diagnosing various diseases from medical imaging and patient data. The AI, trained on millions of cases, can detect conditions months before traditional methods, potentially saving countless lives.',
    date: new Date('2025-01-26'),
    image: 'https://picsum.photos/800/400?random=12',
    category: 'Health',
    views: 2500,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '13',
    id: 13,
    title: 'World\'s First Floating City Completed',
    summary: 'Innovative urban development addresses rising sea levels.',
    content: 'The first floating city, designed to withstand rising sea levels and extreme weather, has been completed off the coast of the Netherlands. This pioneering project features sustainable energy, advanced water management, and can house up to 10,000 residents.',
    date: new Date('2025-01-27'),
    image: 'https://picsum.photos/800/400?random=13',
    category: 'Science',
    views: 2000,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '14',
    id: 14,
    title: 'Breakthrough in Fusion Energy Research',
    summary: 'Scientists achieve net energy gain in fusion reaction.',
    content: 'For the first time, scientists have achieved net energy gain in a fusion reaction, producing more energy than was consumed. This milestone brings commercial fusion power plants closer to reality, offering a clean, abundant energy source for the future.',
    date: new Date('2025-01-28'),
    image: 'https://picsum.photos/800/400?random=14',
    category: 'Science',
    views: 2600,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '15',
    id: 15,
    title: 'Global Internet Access Becomes Universal Right',
    summary: 'United Nations declares internet access a fundamental human right.',
    content: 'In a historic resolution, the United Nations has declared reliable internet access a fundamental human right. This decision aims to bridge the digital divide and ensure that all people worldwide have access to information, education, and economic opportunities.',
    date: new Date('2025-01-29'),
    image: 'https://picsum.photos/800/400?random=15',
    category: 'Technology',
    views: 2700,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  },
  {
    _id: '16',
    id: 16,
    title: 'U.S. Investigations Reveal New Details',
    summary: 'Ongoing probes uncover critical information on recent scandals.',
    content: 'Federal investigations into high-profile cases have yielded new evidence, shedding light on previously undisclosed activities. Authorities are pursuing multiple leads, with potential implications for national security and public trust.',
    date: new Date('2025-01-30'),
    image: 'https://picsum.photos/800/400?random=16',
    category: 'Politics',
    views: 1800,
    published: true,
    author: { _id: '507f1f77bcf86cd799439012', username: 'admin' }
  }
];

// Mock comments
const mockComments = [
  {
    _id: '507f1f77bcf86cd799439015',
    content: 'Great article!',
    article: '1',
    author: { _id: '507f1f77bcf86cd799439016', username: 'user1' },
    createdAt: new Date('2025-01-15T10:00:00Z'),
    isDeleted: false
  }
];

// Mock ratings
const mockRatings = [
  {
    _id: '507f1f77bcf86cd799439017',
    article: '1',
    user: '507f1f77bcf86cd799439016',
    rating: 5
  }
];

// Helper function to check if DB is connected
let isDBConnected = false;
function setDBStatus(status) {
  isDBConnected = status;
}

// API rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests, please try again later.'
});

router.use(apiLimiter);

// Get articles with pagination
router.get('/articles', async (req, res) => {
  try {
    if (isDBConnected) {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;

      const articles = await Article.find({ published: true })
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .populate('author', 'username');

      const total = await Article.countDocuments({ published: true });

      res.json({
        articles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } else {
      // Fallback to mock data
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      const total = mockArticles.length;
      const articles = mockArticles.slice(skip, skip + limit);

      res.json({
        articles,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single article
router.get('/articles/:id', async (req, res) => {
  try {
    if (isDBConnected) {
      const article = await Article.findById(req.params.id).populate('author', 'username');
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      res.json(article);
    } else {
      // Fallback to mock data
      const article = mockArticles.find(a => a._id === req.params.id);
      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }
      res.json(article);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create article (admin only)
router.post('/articles', [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('summary').trim().isLength({ min: 1 }).withMessage('Summary is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('category').trim().isLength({ min: 1 }).withMessage('Category is required'),
  body('image').trim().isLength({ min: 1 }).withMessage('Image URL is required'),
  body('video').optional().trim().isURL().withMessage('Video must be a valid URL')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const article = new Article({
      ...req.body,
      author: req.user.id
    });

    await article.save();
    res.status(201).json(article);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update article (admin only)
router.put('/articles/:id', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const article = await Article.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json(article);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete article (admin only)
router.delete('/articles/:id', async (req, res) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const article = await Article.findByIdAndDelete(req.params.id);
    if (!article) {
      return res.status(404).json({ error: 'Article not found' });
    }
    res.json({ message: 'Article deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get comments for article
router.get('/comments/:articleId', async (req, res) => {
  try {
    if (isDBConnected) {
      const comments = await Comment.find({ article: req.params.articleId, isDeleted: false })
        .populate('author', 'username')
        .sort({ createdAt: -1 });
      res.json(comments);
    } else {
      // Fallback to mock data
      const comments = mockComments.filter(c => c.article === req.params.articleId && !c.isDeleted);
      res.json(comments);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create comment
router.post('/comments', [
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Comment must be 1-1000 characters'),
  body('articleId').trim().isLength({ min: 1 }).withMessage('Article ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isDBConnected) {
      const comment = new Comment({
        content: req.body.content,
        article: req.body.articleId,
        author: req.user.id
      });

      await comment.save();
      await comment.populate('author', 'username');
      res.status(201).json(comment);
    } else {
      // Fallback for mock mode - simulate comment creation
      const newComment = {
        _id: 'mock_' + Date.now(),
        content: req.body.content,
        article: req.body.articleId,
        author: { _id: req.user.id, username: req.user.username },
        createdAt: new Date(),
        isDeleted: false
      };
      // Store the comment in mock data for persistence
      mockComments.push(newComment);
      res.status(201).json(newComment);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete comment
router.delete('/comments/:id', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isDBConnected) {
      const comment = await Comment.findById(req.params.id);
      if (!comment) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      // Check if user is the author or admin
      if (comment.author.toString() !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }

      await Comment.findByIdAndDelete(req.params.id);
      res.json({ message: 'Comment deleted' });
    } else {
      // Fallback for mock mode
      const commentIndex = mockComments.findIndex(c => c._id === req.params.id);
      if (commentIndex === -1) {
        return res.status(404).json({ error: 'Comment not found' });
      }

      const comment = mockComments[commentIndex];
      // Check if user is the author or admin
      if (comment.author._id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this comment' });
      }

      mockComments.splice(commentIndex, 1);
      res.json({ message: 'Comment deleted' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get ratings for article
router.get('/ratings/:articleId', async (req, res) => {
  try {
    if (isDBConnected) {
      const ratings = await Rating.find({ article: req.params.articleId });
      const average = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
      res.json({ ratings, average, count: ratings.length });
    } else {
      // Fallback to mock data
      const ratings = mockRatings.filter(r => r.article === req.params.articleId);
      const average = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
      res.json({ ratings, average, count: ratings.length });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create/update rating
router.post('/ratings', [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('articleId').trim().isLength({ min: 1 }).withMessage('Article ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (isDBConnected) {
      const existingRating = await Rating.findOne({ article: req.body.articleId, user: req.user.id });

      if (existingRating) {
        existingRating.rating = req.body.rating;
        await existingRating.save();
        res.json(existingRating);
      } else {
        const rating = new Rating({
          article: req.body.articleId,
          user: req.user.id,
          rating: req.body.rating
        });
        await rating.save();
        res.status(201).json(rating);
      }
    } else {
      // Fallback for mock mode - simulate rating creation
      const newRating = {
        _id: 'mock_' + Date.now(),
        article: req.body.articleId,
        user: req.user.id,
        rating: req.body.rating
      };
      // In a real app, you'd store this in memory or local storage
      res.status(201).json(newRating);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search articles
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    if (isDBConnected) {
      const articles = await Article.find(
        { $text: { $search: query }, published: true },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

      res.json(articles);
    } else {
      // Fallback to mock data - simple text search
      const articles = mockArticles.filter(article =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.summary.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20);

      res.json(articles);
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = { router, setDBStatus };
