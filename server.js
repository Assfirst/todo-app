const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const { OAuth2Client } = require('google-auth-library');
const app = express();
const port = 3000;

const client = new OAuth2Client("876638950101-dl5ba8ccklu0j6hng80gr9j9a7ddgae8.apps.googleusercontent.com");
const db = new sqlite3.Database('todos.db');

db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task TEXT NOT NULL,
    user_id TEXT NOT NULL,
    completed INTEGER DEFAULT 0,  -- 0 = ไม่เสร็จ, 1 = เสร็จ
    due_date TEXT             -- วันที่ครบกำหนด
)`);

app.use(express.json());
app.use(express.static('public'));

async function verifyToken(req, res, next) {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).send("มึงต้องล็อกอินก่อน!");
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com",
        });
        req.user = ticket.getPayload();
        next();
    } catch (err) {
        res.status(401).send("Token งี่เง่า ล็อกอินใหม่!");
    }
}

app.get('/tasks', verifyToken, (req, res) => {
    db.all("SELECT * FROM tasks WHERE user_id = ?", [req.user.sub], (err, rows) => {
        if (err) return res.status(500).send("มีปัญหาโว้ย!");
        res.json(rows);
    });
});

app.post('/tasks', verifyToken, (req, res) => {
    const { task, due_date } = req.body;
    if (!task) return res.status(400).send("มึงไม่ได้ใส่งานมา!");
    db.run("INSERT INTO tasks (task, user_id, due_date) VALUES (?, ?, ?)", 
        [task, req.user.sub, due_date || null], function(err) {
        if (err) return res.status(500).send("เพิ่มงานไม่ได้!");
        res.json({ id: this.lastID, task, due_date });
    });
});

app.put('/tasks/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    const { task, completed, due_date } = req.body;
    db.run("UPDATE tasks SET task = ?, completed = ?, due_date = ? WHERE id = ? AND user_id = ?", 
        [task, completed, due_date, id, req.user.sub], function(err) {
        if (err || this.changes === 0) return res.status(404).send("งานนี้ไม่มีหรือแก้ไม่ได้!");
        res.send("แก้แล้วโว้ย!");
    });
});

app.delete('/tasks/:id', verifyToken, (req, res) => {
    const { id } = req.params;
    db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [id, req.user.sub], function(err) {
        if (err || this.changes === 0) return res.status(404).send("งานนี้ไม่มีหรือลบไม่ได้!");
        res.send("ลบแล้วโว้ย!");
    });
});

app.listen(port, () => {
    console.log(`เซิร์ฟเวอร์รันอยู่ที่ http://localhost:${port}`);
});