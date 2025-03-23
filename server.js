const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const { OAuth2Client } = require('google-auth-library');

const app = express();

// Google Client ID
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '876638950101-dl5ba8ccklu0j6hng80gr9j9a7ddgae8.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// PostgreSQL Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://todo_db_r5av_user:icEffEOeiNbwut964abrgYWapiRftguv@dpg-cvftbulsvqrc73d4d810-a/todo_db_r5av',
  ssl: { rejectUnauthorized: false } // Render ต้องการ SSL
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// สร้างตาราง todos ถ้ายังไม่มี
pool.query(`
  CREATE TABLE IF NOT EXISTS todos (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    task TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    due_date TEXT
  )
`).then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Error connecting to PostgreSQL:', err));

// Root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Google Sign-In endpoint
app.post('/auth/google', async (req, res) => {
  const { token } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const userId = payload['sub']; // Google user ID
    res.json({ success: true, userId });
  } catch (error) {
    console.error('Error verifying Google token:', error);
    res.status(401).json({ success: false, error: 'Invalid token' });
  }
});

// API ดึง todos เฉพาะ user
app.get('/todos', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }
  try {
    const result = await pool.query('SELECT * FROM todos WHERE user_id = $1', [userId]);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching todos:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API เพิ่ม todo
app.post('/todos', async (req, res) => {
  const { userId, task, dueDate } = req.body;
  if (!userId || !task) {
    return res.status(400).json({ error: 'User ID and task required' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO todos (user_id, task, due_date) VALUES ($1, $2, $3) RETURNING *',
      [userId, task, dueDate || null]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error adding todo:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API อัพเดท todo
app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  try {
    await pool.query(
      'UPDATE todos SET completed = $1 WHERE id = $2',
      [completed, id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error updating todo:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// API ลบ todo
app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting todo:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`เซิร์ฟเวอร์รันอยู่ที่พอร์ต ${PORT}`);
});