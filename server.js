const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { OAuth2Client } = require('google-auth-library');

const app = express();

// Google Client ID จาก Google Cloud Console (ใส่ของมึงเอง หรือใช้ env variable)
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '876638950101-dl5ba8ccklu0j6hng80gr9j9a7ddgae8.apps.googleusercontent.com';
const client = new OAuth2Client(CLIENT_ID);

// Middleware
app.use(express.json()); // Parse JSON bodies
app.use(express.static(path.join(__dirname, 'public'))); // เสิร์ฟไฟล์ static จาก public

// SQLite Database (ใช้ in-memory เพราะ Render ไม่เก็บไฟล์ถาวร)
const db = new sqlite3.Database(':memory:', (err) => {
  if (err) {
    console.error('Error connecting to SQLite:', err.message);
  } else {
    console.log('Connected to in-memory SQLite database');
  }
});

// สร้างตาราง todos ถ้ายังไม่มี
db.run(`
  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    task TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    due_date TEXT
  )
`);

// Root route - เสิร์ฟ index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API เพื่อ verify Google token และ login
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

// API ดึง todos ของผู้ใช้
app.get('/todos', (req, res) => {
  const userId = req.query.userId; // ส่ง userId มาจาก client
  if (!userId) {
    return res.status(400).json({ error: 'User ID required' });
  }
  db.all('SELECT * FROM todos WHERE user_id = ?', [userId], (err, rows) => {
    if (err) {
      console.error('Error fetching todos:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// API เพิ่ม todo
app.post('/todos', (req, res) => {
  const { userId, task, dueDate } = req.body;
  if (!userId || !task) {
    return res.status(400).json({ error: 'User ID and task required' });
  }
  db.run(
    'INSERT INTO todos (user_id, task, due_date) VALUES (?, ?, ?)',
    [userId, task, dueDate || null],
    function (err) {
      if (err) {
        console.error('Error adding todo:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ id: this.lastID, userId, task, dueDate, completed: 0 });
    }
  );
});

// API อัพเดท todo (mark completed)
app.put('/todos/:id', (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  db.run(
    'UPDATE todos SET completed = ? WHERE id = ?',
    [completed ? 1 : 0, id],
    function (err) {
      if (err) {
        console.error('Error updating todo:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true });
    }
  );
});

// API ลบ todo
app.delete('/todos/:id', (req, res) => {
  const { id } = req.params;
  db.run('DELETE FROM todos WHERE id = ?', [id], function (err) {
    if (err) {
      console.error('Error deleting todo:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`เซิร์ฟเวอร์รันอยู่ที่พอร์ต ${PORT}`);
});