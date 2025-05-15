const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');
const fs = require('fs');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'your-secret-key';

const allowedOrigins = [
  'https://web-blog-afow.vercel.app',
  'https://web-blog-wheat.vercel.app'
];

// CORS Middleware
app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy: Origin not allowed'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Preflight OPTIONS
app.options('*', cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS policy: Origin not allowed'), false);
    }
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(bodyParser.json({ limit: '100mb' }));

// File Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.NODE_ENV === 'production' 
      ? '/tmp/uploads' 
      : path.join(__dirname, 'public/uploads');
    if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

app.get('/uploads/:filename', (req, res) => {
  const { filename } = req.params;
  const filePath = process.env.NODE_ENV === 'production' 
    ? `/tmp/uploads/${filename}` 
    : path.join(__dirname, 'public/uploads', filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('Error serving file:', err);
      res.status(404).json({ message: 'File not found' });
    }
  });
});

// Database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false, sslmode: 'require' }
});

// Create tables
const initializeDatabase = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blogs (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        category VARCHAR(255),
        author_id INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        views INTEGER DEFAULT 0,
        FOREIGN KEY (author_id) REFERENCES users(id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS likes (
        id SERIAL PRIMARY KEY,
        blog_id INTEGER,
        user_id INTEGER,
        FOREIGN KEY (blog_id) REFERENCES blogs(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS comments (
        id SERIAL PRIMARY KEY,
        blog_id INTEGER,
        user_id INTEGER,
        content TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        parent_id INTEGER,
        FOREIGN KEY (blog_id) REFERENCES blogs(id),
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
      )
    `);
    console.log('Database tables created successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
};
initializeDatabase();

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ message: 'No token provided' });

  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token malformed' });

  jwt.verify(token, SECRET_KEY, (err, user) => {
    if (err) return res.status(403).json({ message: 'Invalid token' });
    req.user = user;
    next();
  });
};

// Routes

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8);

  try {
    await pool.query(
      `INSERT INTO users (username, password) VALUES ($1, $2)`,
      [username, hashedPassword]
    );
    res.status(201).json({ message: 'User created' });
  } catch (err) {
    console.error('Error during signup:', err);
    res.status(400).json({ message: 'Username already exists' });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
    const user = result.rows[0];
    if (!user) return res.status(400).json({ message: 'User not found' });

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) return res.status(400).json({ message: 'Invalid password' });

    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Error during login:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

app.post('/api/upload-image', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

app.post('/api/blogs', authenticateToken, async (req, res) => {
  const { title, content, category } = req.body;
  const author_id = req.user.id;
  const created_at = new Date();

  try {
    const result = await pool.query(
      `INSERT INTO blogs (title, content, category, author_id, created_at, views) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, content, category, author_id, created_at, 0]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error inserting blog:', err);
    res.status(500).json({ message: `Error creating blog: ${err.message}` });
  }
});

app.get('/api/blogs', async (req, res) => {
  const category = req.query.category;
  let query = `
    SELECT blogs.*, users.username, 
    (SELECT COUNT(*) FROM likes WHERE likes.blog_id = blogs.id) as likes,
    (SELECT COUNT(*) FROM comments WHERE comments.blog_id = blogs.id) as comment_count
    FROM blogs JOIN users ON blogs.author_id = users.id
  `;
  let params = [];

  if (category) {
    query += ` WHERE blogs.category = $1`;
    params.push(category);
  }

  query += ` ORDER BY blogs.created_at DESC`;

  try {
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching blogs:', err);
    res.status(500).json({ message: 'Error fetching blogs' });
  }
});

app.get('/api/blogs/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await pool.query(`UPDATE blogs SET views = views + 1 WHERE id = $1`, [id]);

    const blogResult = await pool.query(
      `SELECT blogs.*, users.username 
       FROM blogs JOIN users ON blogs.author_id = users.id 
       WHERE blogs.id = $1`,
      [id]
    );
    const blog = blogResult.rows[0];
    if (!blog) return res.status(404).json({ message: 'Blog not found' });

    const likeResult = await pool.query(`SELECT COUNT(*) as likes FROM likes WHERE blog_id = $1`, [id]);

    const commentsResult = await pool.query(
      `SELECT comments.*, users.username 
       FROM comments 
       JOIN users ON comments.user_id = users.id 
       WHERE comments.blog_id = $1 
       ORDER BY comments.created_at DESC`,
      [id]
    );
    const allComments = commentsResult.rows;
    const commentsMap = {};
    const topLevelComments = [];

    allComments.forEach(comment => {
      comment.replies = [];
      commentsMap[comment.id] = comment;
    });

    allComments.forEach(comment => {
      if (comment.parent_id) {
        if (commentsMap[comment.parent_id]) {
          commentsMap[comment.parent_id].replies.push(comment);
        }
      } else {
        topLevelComments.push(comment);
      }
    });

    res.json({
      ...blog,
      likes: parseInt(likeResult.rows[0].likes),
      comments: topLevelComments
    });
  } catch (err) {
    console.error('Error fetching blog by ID:', err);
    res.status(500).json({ message: 'Error fetching blog' });
  }
});

app.post('/api/blogs/:id/like', authenticateToken, async (req, res) => {
  const blog_id = req.params.id;
  const user_id = req.user.id;

  try {
    const exists = await pool.query(
      `SELECT * FROM likes WHERE blog_id = $1 AND user_id = $2`,
      [blog_id, user_id]
    );
    if (exists.rows.length > 0) {
      return res.status(400).json({ message: 'You have already liked this blog' });
    }

    await pool.query(
      `INSERT INTO likes (blog_id, user_id) VALUES ($1, $2)`,
      [blog_id, user_id]
    );
    res.json({ message: 'Blog liked' });
  } catch (err) {
    console.error('Error liking blog:', err);
    res.status(500).json({ message: 'Error liking blog' });
  }
});

app.post('/api/blogs/:id/comments', authenticateToken, async (req, res) => {
  const blog_id = req.params.id;
  const user_id = req.user.id;
  const { content, parent_id } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO comments (blog_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [blog_id, user_id, content, parent_id || null]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error adding comment:', err);
    res.status(500).json({ message: 'Error adding comment' });
  }
});

// ✅ NEW ROUTE: Reply to comment
app.post('/api/blogs/:id/comments/reply', authenticateToken, async (req, res) => {
  const blog_id = req.params.id;
  const user_id = req.user.id;
  const { content, parent_id } = req.body;

  if (!parent_id) {
    return res.status(400).json({ message: 'Missing parent comment ID for reply' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO comments (blog_id, user_id, content, parent_id) VALUES ($1, $2, $3, $4) RETURNING id`,
      [blog_id, user_id, content, parent_id]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err) {
    console.error('Error adding reply:', err);
    res.status(500).json({ message: 'Error adding reply' });
  }
});

app.delete('/api/blogs/:id', authenticateToken, async (req, res) => {
  const blog_id = req.params.id;
  const user_id = req.user.id;

  try {
    const result = await pool.query(`SELECT * FROM blogs WHERE id = $1 AND author_id = $2`, [blog_id, user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Blog not found or unauthorized' });
    }

    await pool.query(`DELETE FROM blogs WHERE id = $1`, [blog_id]);
    res.json({ message: 'Blog deleted successfully' });
  } catch (err) {
    console.error('Error deleting blog:', err);
    res.status(500).json({ message: 'Error deleting blog' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
