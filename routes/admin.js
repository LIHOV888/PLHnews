const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const router = express.Router();

// Import models
const Article = require('../models/Article');
const User = require('../models/User');
const Comment = require('../models/Comment');

// Admin middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).render('error', {
      user: req.user,
      message: 'Access denied. Admin privileges required.',
      error: { status: 403 }
    });
  }
  next();
};

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|avi|mov|wmv/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Rate limiting for admin actions
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each admin to 100 requests per windowMs
  message: 'Too many admin actions, please try again later.'
});

// Apply rate limiting to all admin routes
router.use(adminLimiter);

// Admin dashboard
router.get('/', requireAdmin, async (req, res) => {
  try {
    const stats = {
      totalArticles: await Article.countDocuments(),
      publishedArticles: await Article.countDocuments({ published: true }),
      totalUsers: await User.countDocuments(),
      activeUsers: await User.countDocuments({ isActive: true }),
      totalComments: await Comment.countDocuments(),
      recentArticles: await Article.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('author', 'username'),
      recentUsers: await User.find()
        .sort({ createdAt: -1 })
        .limit(5)
    };

    res.render('admin/dashboard', {
      user: req.user,
      stats,
      title: 'Admin Dashboard'
    });
  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading dashboard',
      error: { status: 500 }
    });
  }
});

// Article management routes
router.get('/articles', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.published = req.query.status === 'published';
    }
    if (req.query.category) {
      filter.category = req.query.category;
    }
    if (req.query.search) {
      filter.$text = { $search: req.query.search };
    }

    const articles = await Article.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username')
      .populate('lastEditedBy', 'username');

    const total = await Article.countDocuments(filter);

    res.render('admin/articles/index', {
      user: req.user,
      articles,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: req.query,
      title: 'Article Management'
    });
  } catch (error) {
    console.error('Articles list error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading articles',
      error: { status: 500 }
    });
  }
});

// Create article form
router.get('/articles/create', requireAdmin, (req, res) => {
  res.render('admin/articles/create', {
    user: req.user,
    title: 'Create Article'
  });
});

// Create article
router.post('/articles', requireAdmin, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), [
  body('title').trim().isLength({ min: 1 }).withMessage('Title is required'),
  body('summary').trim().isLength({ min: 1 }).withMessage('Summary is required'),
  body('content').trim().isLength({ min: 1 }).withMessage('Content is required'),
  body('category').trim().isLength({ min: 1 }).withMessage('Category is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.render('admin/articles/create', {
        user: req.user,
        errors: errors.array(),
        formData: req.body,
        title: 'Create Article'
      });
    }

    const articleData = {
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      category: req.body.category,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      published: req.body.published === 'on',
      featured: req.body.featured === 'on',
      seoTitle: req.body.seoTitle,
      seoDescription: req.body.seoDescription,
      seoKeywords: req.body.seoKeywords ? req.body.seoKeywords.split(',').map(k => k.trim()) : [],
      author: req.user.id,
      lastEditedBy: req.user.id
    };

    if (req.files.image) {
      articleData.image = '/uploads/' + req.files.image[0].filename;
    }

    if (req.files.video) {
      articleData.video = '/uploads/' + req.files.video[0].filename;
    }

    if (req.body.scheduledPublishDate) {
      articleData.scheduledPublishDate = new Date(req.body.scheduledPublishDate);
    }

    const article = new Article(articleData);
    await article.save();

    res.redirect('/admin/articles');
  } catch (error) {
    console.error('Create article error:', error);
    res.render('admin/articles/create', {
      user: req.user,
      errors: [{ msg: 'Error creating article' }],
      formData: req.body,
      title: 'Create Article'
    });
  }
});

// Edit article form
router.get('/articles/:id/edit', requireAdmin, async (req, res) => {
  try {
    const article = await Article.findById(req.params.id).populate('author', 'username');
    if (!article) {
      return res.status(404).render('error', {
        user: req.user,
        message: 'Article not found',
        error: { status: 404 }
      });
    }

    res.render('admin/articles/edit', {
      user: req.user,
      article,
      title: 'Edit Article'
    });
  } catch (error) {
    console.error('Edit article error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading article',
      error: { status: 500 }
    });
  }
});

// Update article
router.post('/articles/:id', requireAdmin, upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).render('error', {
        user: req.user,
        message: 'Article not found',
        error: { status: 404 }
      });
    }

    const updateData = {
      title: req.body.title,
      summary: req.body.summary,
      content: req.body.content,
      category: req.body.category,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      published: req.body.published === 'on',
      featured: req.body.featured === 'on',
      seoTitle: req.body.seoTitle,
      seoDescription: req.body.seoDescription,
      seoKeywords: req.body.seoKeywords ? req.body.seoKeywords.split(',').map(k => k.trim()) : [],
      lastEditedBy: req.user.id
    };

    if (req.files.image) {
      updateData.image = '/uploads/' + req.files.image[0].filename;
    }

    if (req.files.video) {
      updateData.video = '/uploads/' + req.files.video[0].filename;
    }

    if (req.body.scheduledPublishDate) {
      updateData.scheduledPublishDate = new Date(req.body.scheduledPublishDate);
    }

    // Track changes
    const changes = [];
    Object.keys(updateData).forEach(key => {
      if (article[key] !== updateData[key]) {
        changes.push(`${key}: ${article[key]} → ${updateData[key]}`);
      }
    });

    if (changes.length > 0) {
      updateData.editHistory = article.editHistory || [];
      updateData.editHistory.push({
        editedBy: req.user.id,
        changes: changes.join('; ')
      });
    }

    await Article.findByIdAndUpdate(req.params.id, updateData);

    res.redirect('/admin/articles');
  } catch (error) {
    console.error('Update article error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error updating article',
      error: { status: 500 }
    });
  }
});

// Delete article
router.post('/articles/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Article.findByIdAndDelete(req.params.id);
    res.redirect('/admin/articles');
  } catch (error) {
    console.error('Delete article error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error deleting article',
      error: { status: 500 }
    });
  }
});

// Bulk operations
router.post('/articles/bulk', requireAdmin, async (req, res) => {
  try {
    const { action, articleIds } = req.body;

    if (!articleIds || !Array.isArray(articleIds)) {
      return res.status(400).json({ error: 'Invalid article IDs' });
    }

    switch (action) {
      case 'publish':
        await Article.updateMany(
          { _id: { $in: articleIds } },
          { published: true, lastEditedBy: req.user.id }
        );
        break;
      case 'unpublish':
        await Article.updateMany(
          { _id: { $in: articleIds } },
          { published: false, lastEditedBy: req.user.id }
        );
        break;
      case 'feature':
        await Article.updateMany(
          { _id: { $in: articleIds } },
          { featured: true, lastEditedBy: req.user.id }
        );
        break;
      case 'unfeature':
        await Article.updateMany(
          { _id: { $in: articleIds } },
          { featured: false, lastEditedBy: req.user.id }
        );
        break;
      case 'delete':
        await Article.deleteMany({ _id: { $in: articleIds } });
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Bulk operation error:', error);
    res.status(500).json({ error: 'Bulk operation failed' });
  }
});

// User management routes
router.get('/users', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) {
      filter.role = req.query.role;
    }
    if (req.query.status) {
      if (req.query.status === 'active') filter.isActive = true;
      if (req.query.status === 'banned') filter.isBanned = true;
    }

    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select('-password');

    const total = await User.countDocuments(filter);

    res.render('admin/users/index', {
      user: req.user,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      filters: req.query,
      title: 'User Management'
    });
  } catch (error) {
    console.error('Users list error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading users',
      error: { status: 500 }
    });
  }
});

// Update user role
router.post('/users/:id/role', requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    await User.findByIdAndUpdate(req.params.id, { role });
    res.json({ success: true });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Ban/unban user
router.post('/users/:id/ban', requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.isBanned = !user.isBanned;
    await user.save();

    res.json({ success: true, banned: user.isBanned });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: 'Failed to ban/unban user' });
  }
});

// Comment moderation
router.get('/comments', requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('author', 'username')
      .populate('article', 'title');

    const total = await Comment.countDocuments({ isDeleted: false });

    res.render('admin/comments/index', {
      user: req.user,
      comments,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      },
      title: 'Comment Moderation'
    });
  } catch (error) {
    console.error('Comments list error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading comments',
      error: { status: 500 }
    });
  }
});

// Delete comment
router.post('/comments/:id/delete', requireAdmin, async (req, res) => {
  try {
    await Comment.findByIdAndUpdate(req.params.id, { isDeleted: true });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
});

// Analytics
router.get('/analytics', requireAdmin, async (req, res) => {
  try {
    const analytics = {
      totalViews: await Article.aggregate([
        { $group: { _id: null, total: { $sum: '$views' } } }
      ]),
      topArticles: await Article.find({ published: true })
        .sort({ views: -1 })
        .limit(10)
        .select('title views category'),
      categoryStats: await Article.aggregate([
        { $match: { published: true } },
        { $group: { _id: '$category', count: { $sum: 1 }, totalViews: { $sum: '$views' } } },
        { $sort: { count: -1 } }
      ]),
      userActivity: await User.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { '_id': -1 } },
        { $limit: 30 }
      ])
    };

    res.render('admin/analytics', {
      user: req.user,
      analytics,
      title: 'Analytics'
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).render('error', {
      user: req.user,
      message: 'Error loading analytics',
      error: { status: 500 }
    });
  }
});

module.exports = router;
