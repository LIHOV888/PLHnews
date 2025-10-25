require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const socketIo = require('socket.io');
const bcrypt = require('bcryptjs');

const { body, validationResult } = require('express-validator');

// Import models
const Article = require('./models/Article');
const User = require('./models/User');
const Comment = require('./models/Comment');
const Rating = require('./models/Rating');

// Import routes
const authRoutes = require('./routes/auth');
const { router: apiRoutes, setDBStatus: setApiDBStatus } = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Set DB status in auth routes
authRoutes.setDBStatus = (status) => {
  authRoutes.isDBConnected = status;
};

const app = express();
const PORT = process.env.PORT || 3000;

// Flag to track if database is connected
let isDBConnected = false;

// User tracking (simplified for serverless)
let onlineUsers = new Set();
let totalVisitors = 0;
let todayVisitors = 0;
let lastUpdate = new Date().toLocaleTimeString();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com", "https://pagead2.googlesyndication.com"],
      imgSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://fonts.gstatic.com"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Auth rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 5 auth attempts per windowMs
  message: 'Too many authentication attempts, please try again later.'
});

// Compression middleware
app.use(compression());

// Middleware
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session middleware
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'your-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false } // Set to true in production with HTTPS
};

const mongoURI = process.env.MONGO_URI || 'mongodb+srv://henglihov88_db_user:kKpWEw7RnFdnNJIo@hnewsdb.ikfukva.mongodb.net/?appName=HnewsDB';
// sessionConfig.store = MongoStore.create({
//   mongoUrl: mongoURI,
//   collectionName: 'sessions'
// }); // Use memory store for session to work regardless of DB connection

app.use(session(sessionConfig));

// Simple session middleware (no JWT)
app.use((req, res, next) => {
  req.user = req.session.user || null;
  next();
});

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(expressLayouts);
app.set('layout', 'layout');

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Function to generate random views based on article age
function generateViews(articleDate) {
  const now = new Date();
  const articleDateObj = new Date(articleDate);
  const diffTime = Math.abs(now - articleDateObj);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) {
    return Math.floor(Math.random() * 500) + 1; // 1-500
  } else if (diffDays >= 2) {
    return Math.floor(Math.random() * (1000000 - 1000 + 1)) + 1000; // 1000-1000000
  } else {
    return 0; // For future dates or same day
  }
}

// Mock news data
const newsArticles = [
  {
    id: 1,
    title: 'Breaking News: Major Event in Technology',
    summary: 'A significant development in the tech world has been announced today.',
    content: 'Full article content here...',
    date: new Date('2025-01-15'),
    image: 'https://picsum.photos/800/400?random=1',
    video: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
    category: 'Technology',
    views: generateViews('2025-01-15')
  },
  {
    id: 2,
    title: 'Sports Update: Championship Results',
    summary: 'The latest results from the championship games.',
    content: 'Full article content here...',
    date: new Date('2025-01-16'),
    image: 'https://picsum.photos/800/400?random=2',
    category: 'Sports',
    views: generateViews('2025-01-16')
  },
  {
    id: 3,
    title: 'Economy Boosts with New Green Initiatives',
    summary: 'Governments worldwide are investing in sustainable energy projects to combat climate change.',
    content: 'In a bold move to address environmental challenges, several countries have unveiled comprehensive plans for green energy transitions. These initiatives include massive investments in solar and wind power, aiming to reduce carbon emissions by 50% over the next decade. Experts predict this will create millions of jobs in the renewable sector while stabilizing global economies.',
    date: new Date('2025-01-17'),
    image: 'https://picsum.photos/800/400?random=3',
    category: 'Environment',
    views: generateViews('2025-01-17')
  },
  {
    id: 4,
    title: 'Health Breakthrough in Vaccine Research',
    summary: 'Scientists announce a new vaccine that could prevent multiple diseases.',
    content: 'A team of researchers has developed a universal vaccine platform capable of protecting against a wide range of viral infections. This innovative approach uses mRNA technology to train the immune system against common viral structures, potentially eliminating the need for seasonal flu shots and offering protection against emerging pandemics.',
    date: new Date('2025-01-18'),
    image: 'https://picsum.photos/800/400?random=4',
    category: 'Health',
    views: generateViews('2025-01-18')
  },
  {
    id: 5,
    title: 'Space Exploration Milestone Achieved',
    summary: 'Private company lands first commercial mission on Mars.',
    content: 'In a historic achievement, a private aerospace company has successfully landed a crewed mission on Mars. The mission, which lasted six months, collected valuable data on the planet\'s geology and potential for future colonization. This marks the beginning of a new era in space exploration, with plans for permanent settlements in the coming years.',
    date: new Date('2025-01-19'),
    image: 'https://picsum.photos/800/400?random=5',
    category: 'Science',
    views: generateViews('2025-01-19')
  },
  {
    id: 6,
    title: 'Education Reform Sparks Debate',
    summary: 'New curriculum changes aim to incorporate more technology in classrooms.',
    content: 'Educational institutions are adopting digital learning tools to enhance student engagement. The reform includes interactive AI tutors, virtual reality field trips, and personalized learning paths. While supporters praise the modernization, critics argue it may widen the digital divide for students without access to technology.',
    date: new Date('2025-01-20'),
    image: 'https://picsum.photos/800/400?random=6',
    category: 'Education',
    views: generateViews('2025-01-20')
  },
  {
    id: 7,
    title: 'Wildlife Conservation Success Story',
    summary: 'Endangered species population rebounds thanks to community efforts.',
    content: 'Through coordinated conservation efforts, the population of a critically endangered species has increased by 300% in the last five years. Local communities, NGOs, and governments worked together to protect habitats, combat poaching, and implement breeding programs. This success serves as a model for other conservation initiatives worldwide.',
    date: new Date('2025-01-21'),
    image: 'https://picsum.photos/800/400?random=7',
    category: 'Environment',
    views: generateViews('2025-01-21')
  },
  {
    id: 8,
    title: 'Artificial Intelligence in Daily Life',
    summary: 'AI assistants become more integrated into everyday tasks.',
    content: 'From smart homes to personalized shopping experiences, artificial intelligence is becoming an integral part of daily life. New AI systems can now predict user needs, manage schedules, and even provide emotional support. While convenience increases, experts warn about the importance of maintaining human oversight in AI decision-making.',
    date: new Date('2025-01-22'),
    image: 'https://picsum.photos/800/400?random=8',
    category: 'Technology',
    views: generateViews('2025-01-22')
  },
  {
    id: 9,
    title: 'Global Climate Summit Reaches Historic Agreement',
    summary: 'World leaders commit to ambitious carbon reduction targets.',
    content: 'At the annual Global Climate Summit, representatives from 195 countries signed a landmark agreement to cut greenhouse gas emissions by 70% by 2035. The pact includes funding for developing nations and technology transfers to accelerate the transition to renewable energy sources.',
    date: new Date('2025-01-23'),
    image: 'https://picsum.photos/800/400?random=9',
    category: 'Environment',
    views: generateViews('2025-01-23')
  },
  {
    id: 10,
    title: 'Revolutionary Quantum Computer Unveiled',
    summary: 'New quantum processor promises to solve complex problems instantly.',
    content: 'A leading tech company has unveiled a quantum computer capable of performing calculations that would take traditional supercomputers thousands of years. This breakthrough could revolutionize fields like drug discovery, financial modeling, and climate prediction.',
    date: new Date('2025-01-24'),
    image: 'https://picsum.photos/800/400?random=10',
    category: 'Technology',
    views: generateViews('2025-01-24')
  },
  {
    id: 11,
    title: 'Olympic Games Return to Original Format',
    summary: '2028 Olympics to feature all traditional sports after pandemic hiatus.',
    content: 'The International Olympic Committee announced that the 2028 Summer Olympics in Los Angeles will return to the full traditional format, including all sports that were canceled or modified during the global health crisis. This decision marks a full recovery for international sports.',
    date: new Date('2025-01-25'),
    image: 'https://picsum.photos/800/400?random=11',
    category: 'Sports',
    views: generateViews('2025-01-25')
  },
  {
    id: 12,
    title: 'Medical AI Diagnoses Diseases with 99% Accuracy',
    summary: 'New AI system outperforms human doctors in early disease detection.',
    content: 'A groundbreaking artificial intelligence system has achieved 99% accuracy in diagnosing various diseases from medical imaging and patient data. The AI, trained on millions of cases, can detect conditions months before traditional methods, potentially saving countless lives.',
    date: new Date('2025-01-26'),
    image: 'https://picsum.photos/800/400?random=12',
    category: 'Health',
    views: generateViews('2025-01-26')
  },
  {
    id: 13,
    title: 'World\'s First Floating City Completed',
    summary: 'Innovative urban development addresses rising sea levels.',
    content: 'The first floating city, designed to withstand rising sea levels and extreme weather, has been completed off the coast of the Netherlands. This pioneering project features sustainable energy, advanced water management, and can house up to 10,000 residents.',
    date: new Date('2025-01-27'),
    image: 'https://picsum.photos/800/400?random=13',
    category: 'Science',
    views: generateViews('2025-01-27')
  },
  {
    id: 14,
    title: 'Breakthrough in Fusion Energy Research',
    summary: 'Scientists achieve net energy gain in fusion reaction.',
    content: 'For the first time, scientists have achieved net energy gain in a fusion reaction, producing more energy than was consumed. This milestone brings commercial fusion power plants closer to reality, offering a clean, abundant energy source for the future.',
    date: new Date('2025-01-28'),
    image: 'https://picsum.photos/800/400?random=14',
    category: 'Science',
    views: generateViews('2025-01-28')
  },
  {
    id: 15,
    title: 'Global Internet Access Becomes Universal Right',
    summary: 'United Nations declares internet access a fundamental human right.',
    content: 'In a historic resolution, the United Nations has declared reliable internet access a fundamental human right. This decision aims to bridge the digital divide and ensure that all people worldwide have access to information, education, and economic opportunities.',
    date: new Date('2025-01-29'),
    image: 'https://picsum.photos/800/400?random=15',
    category: 'Technology',
    views: generateViews('2025-01-29')
  },
  {
    id: 16,
    title: 'U.S. Investigations Reveal New Details',
    summary: 'Ongoing probes uncover critical information on recent scandals.',
    content: 'Federal investigations into high-profile cases have yielded new evidence, shedding light on previously undisclosed activities. Authorities are pursuing multiple leads, with potential implications for national security and public trust.',
    date: new Date('2025-01-30'),
    image: 'https://picsum.photos/800/400?random=16',
    category: 'Politics',
    views: generateViews('2025-01-30')
  }
];

// Middleware to track visitors (simplified for serverless)
app.use((req, res, next) => {
  // Note: In serverless, this will reset on each cold start
  totalVisitors += 1;
  todayVisitors += 1;
  onlineUsers.add(req.ip || 'unknown');
  next();
});

// Routes
app.get('/', async (req, res) => {
  try {
    if (isDBConnected) {
      const articles = await Article.find({ published: true }).sort({ date: -1 });
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.render('home', { user: req.user, news: articles, onlineUsers: onlineUsers.size, todayVisitors, totalVisitors, lastUpdate });
    } else {
      // Fallback to mock data when no database
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.render('home', { user: req.user, news: newsArticles, onlineUsers: onlineUsers.size, todayVisitors, totalVisitors, lastUpdate });
    }
  } catch (error) {
    console.error('Error fetching articles:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/article/:id', async (req, res) => {
  try {
    if (isDBConnected) {
      const article = await Article.findById(req.params.id);
      if (article) {
        article.views += 1;
        await article.save();
        const userJson = JSON.stringify(req.user || null).replace(/<\/script/g, '<\\/script');
        res.render('article', { user: req.user, article: article, userJson: userJson });
      } else {
        res.status(404).send('Article not found');
      }
    } else {
      // Fallback to mock data
      const article = newsArticles.find(a => a.id == req.params.id);
      if (article) {
        // Ensure _id is set for consistency with DB mode
        article._id = article.id.toString();
        const userJson = JSON.stringify(req.user || null).replace(/<\/script/g, '<\\/script');
        res.render('article', { user: req.user, article: article, userJson: userJson });
      } else {
        res.status(404).send('Article not found');
      }
    }
  } catch (error) {
    console.error('Error fetching article:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/category/:category', async (req, res) => {
  try {
    const category = req.params.category;
    if (isDBConnected) {
      const filteredArticles = await Article.find({ category: new RegExp(category, 'i'), published: true }).sort({ date: -1 });
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.render('home', { user: req.user, news: filteredArticles, currentCategory: category });
    } else {
      // Fallback to mock data
      const filteredArticles = newsArticles.filter(article => article.category.toLowerCase() === category.toLowerCase());
      res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.render('home', { user: req.user, news: filteredArticles, currentCategory: category });
    }
  } catch (error) {
    console.error('Error fetching articles by category:', error);
    res.status(500).send('Internal server error');
  }
});

// Search route
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.render('search', { user: req.user, results: [], query: '' });
    }

    if (isDBConnected) {
      const results = await Article.find(
        { $text: { $search: query }, published: true },
        { score: { $meta: 'textScore' } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

      res.render('search', { user: req.user, results, query });
    } else {
      // Fallback to mock data search
      const results = newsArticles.filter(article =>
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.summary.toLowerCase().includes(query.toLowerCase()) ||
        article.content.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 20);

      res.render('search', { user: req.user, results, query });
    }
  } catch (error) {
    console.error('Error searching articles:', error);
    res.status(500).send('Internal server error');
  }
});

app.get('/about', (req, res) => {
  res.render('about', { user: req.user });
});

app.get('/contact', (req, res) => {
  res.render('contact', { user: req.user });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', { user: req.user });
});

app.get('/terms', (req, res) => {
  res.render('terms', { user: req.user });
});

app.get('/login', (req, res) => {
  res.render('login', { message: null });
});

app.get('/signup', (req, res) => {
  res.render('signup', { message: null });
});

// Use auth routes
app.use('/auth', authRoutes);

// Use API routes
app.use('/api', apiRoutes);

// Use admin routes
app.use('/admin', adminRoutes);

// Dashboard route - redirect admins to admin panel
app.get('/dashboard', (req, res) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'moderator')) {
    return res.redirect('/admin');
  }
  res.render('dashboard', { user: req.user });
});

// Fallback route for serverless
app.get('*', (req, res) => {
  res.status(404).send('Page not found');
});



// Connect to MongoDB and seed data
async function connectDB() {
  try {
    const mongoURI = process.env.MONGO_URI || 'mongodb+srv://henglihov88_db_user:kKpWEw7RnFdnNJIo@hnewsdb.ikfukva.mongodb.net/?appName=HnewsDB';

    // Add SSL options for Atlas connection
    const options = {
      tls: true,
      tlsAllowInvalidCertificates: false,
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    await mongoose.connect(mongoURI, options);
    isDBConnected = true;
    console.log('MongoDB connected to live server');

    // Set DB status in auth routes
    if (authRoutes.setDBStatus) {
      authRoutes.setDBStatus(true);
    }

    // Set DB status in api routes
    if (setApiDBStatus) {
      setApiDBStatus(true);
    }

    // Seed initial data if collection is empty
    const articleCount = await Article.countDocuments();
    if (articleCount === 0) {
      console.log('Seeding initial articles...');
      for (const article of newsArticles) {
        const newArticle = new Article({
          title: article.title,
          summary: article.summary,
          content: article.content,
          date: new Date(article.date),
          image: article.image,
          category: article.category,
          views: article.views
        });
        await newArticle.save();
      }
      console.log('Articles seeded successfully');
    }
  } catch (error) {
    console.error('MongoDB connection error:', error);
    // Set DB status to false in auth routes on error
    if (authRoutes.setDBStatus) {
      authRoutes.setDBStatus(false);
    }

    // Set DB status to false in api routes on error
    if (setApiDBStatus) {
      setApiDBStatus(false);
    }
  }
}

// Initialize DB connection for both local and deployment
(async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('DB initialization error:', error);
  }

  // For local development
  if (require.main === module) {
    const server = http.createServer(app);
    const io = socketIo(server);

    // Socket.io setup
    io.on('connection', (socket) => {
      console.log('A user connected');

      socket.on('disconnect', () => {
        console.log('A user disconnected');
      });

      // Handle new article event
      socket.on('new article', (data) => {
        io.emit('article update', data);
      });

      // Handle new comment event
      socket.on('new comment', (data) => {
        io.emit('comment update', data);
      });
    });

    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('Shutting down gracefully...');
      await mongoose.connection.close();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  }
})();

// Export the app for Vercel serverless deployment
module.exports = app;
