const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const router = express.Router();

// Import User model
const User = require('../models/User');

// Mock users for fallback when DB not connected
const mockUsers = [
  {
    id: 1,
    username: 'admin',
    email: 'admin@example.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: password
  },
  {
    id: 2,
    username: 'user',
    email: 'user@example.com',
    password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi' // password: password
  }
];

// Helper function to check if DB is connected
let isDBConnected = false;
function setDBStatus(status) {
  isDBConnected = status;
}

// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.',
  handler: (req, res) => {
    res.render('rate-limit', { user: req.user });
  }
});

// Login route
router.post('/login', authLimiter, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('login', { message: errors.array()[0].msg });
  }

  const { username, password } = req.body;

  try {
    // First try DB
    const user = await User.findOne({ username });

    if (!user) {
      return res.render('login', { message: 'User not found' });
    }

    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.render('login', { message: 'Invalid password' });
    }

    // Set user session
    req.session.user = { id: user._id, username: user.username, email: user.email, role: user.role };
    res.redirect('/');
  } catch (error) {
    // Fallback to mock users if DB fails
    const user = mockUsers.find(u => u.username === username);

    if (!user) {
      return res.render('login', { message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.render('login', { message: 'Invalid password' });
    }

    // Set user session
    req.session.user = { id: user.id, username: user.username, email: user.email };
    res.redirect('/');
  }
});

// Signup route
router.post('/signup', authLimiter, [
  body('username').trim().isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('signup', { message: errors.array()[0].msg });
  }

  const { username, email, password } = req.body;

  try {
    // First try DB
    const existingUsername = await User.findOne({ username });
    if (existingUsername) {
      return res.render('signup', { message: 'Username already exists' });
    }

    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.render('signup', { message: 'Email already exists' });
    }

    const newUser = new User({
      username,
      email,
      password
    });
    await newUser.save();

    // Set user session
    req.session.user = { id: newUser._id, username: newUser.username, email: newUser.email };
    res.redirect('/');
  } catch (error) {
    // Fallback to mock users if DB fails
    const existingUsername = mockUsers.find(u => u.username === username);
    if (existingUsername) {
      return res.render('signup', { message: 'Username already exists' });
    }

    const existingEmail = mockUsers.find(u => u.email === email);
    if (existingEmail) {
      return res.render('signup', { message: 'Email already exists' });
    }

    // For demo purposes, just simulate successful signup with mock user
    const newUserId = mockUsers.length + 1;
    const newUser = {
      id: newUserId,
      username,
      email,
      password: await bcrypt.hash(password, 10)
    };
    mockUsers.push(newUser);

    // Set user session
    req.session.user = { id: newUser.id, username: newUser.username, email: newUser.email };
    res.redirect('/');
  }
});

// Change password route
router.post('/change-password', authLimiter, [
  body('currentPassword').isLength({ min: 6 }).withMessage('Current password must be at least 6 characters'),
  body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.newPassword) {
      throw new Error('Password confirmation does not match new password');
    }
    return true;
  })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.render('dashboard', { user: req.user, message: errors.array()[0].msg });
  }

  const { currentPassword, newPassword } = req.body;

  try {
    // Always try DB first, even if isDBConnected is false (it might be connected now)
    const user = await User.findById(req.user.id);

    if (user) {
      // DB user found
      const isValidPassword = await user.comparePassword(currentPassword);
      if (!isValidPassword) {
        return res.render('dashboard', { user: req.user, message: 'Current password is incorrect' });
      }

      user.password = newPassword;
      await user.save();
    } else {
      // Fallback to mock users if DB user not found
      const userIndex = mockUsers.findIndex(u => u.id == req.user.id);
      if (userIndex === -1) {
        return res.render('dashboard', { user: req.user, message: 'User not found' });
      }

      const isValidPassword = await bcrypt.compare(currentPassword, mockUsers[userIndex].password);
      if (!isValidPassword) {
        return res.render('dashboard', { user: req.user, message: 'Current password is incorrect' });
      }

      mockUsers[userIndex].password = await bcrypt.hash(newPassword, 10);
    }
  } catch (error) {
    // If DB query fails, fallback to mock users
    const userIndex = mockUsers.findIndex(u => u.id == req.user.id);
    if (userIndex === -1) {
      return res.render('dashboard', { user: req.user, message: 'User not found' });
    }

    const isValidPassword = await bcrypt.compare(currentPassword, mockUsers[userIndex].password);
    if (!isValidPassword) {
      return res.render('dashboard', { user: req.user, message: 'Current password is incorrect' });
    }

    mockUsers[userIndex].password = await bcrypt.hash(newPassword, 10);
  }

  res.render('dashboard', { user: req.user, message: 'Password changed successfully!', success: true });
});

// Logout route
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;
