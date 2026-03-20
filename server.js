const express = require('express');
const session = require('express-session');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const PIN = process.env.PIN || '1234';

// Database setup
const db = new Database(path.join(__dirname, 'diepvries.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Overig',
    quantity INTEGER NOT NULL DEFAULT 1,
    unit TEXT NOT NULL DEFAULT 'stuks',
    date_added TEXT NOT NULL DEFAULT (date('now')),
    expiry_date TEXT,
    notes TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'diepvries-geheim-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
}));

// Auth middleware
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  res.status(401).json({ error: 'Niet ingelogd' });
}

// Auth routes
app.post('/api/login', (req, res) => {
  const { pin } = req.body;
  if (pin === PIN) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Onjuiste pincode' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/auth-check', (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// API routes
app.get('/api/items', requireAuth, (req, res) => {
  const { search, category, sort } = req.query;
  let sql = 'SELECT * FROM items';
  const conditions = [];
  const params = [];

  if (search) {
    conditions.push('(name LIKE ? OR notes LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category && category !== 'Alle') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  switch (sort) {
    case 'name': sql += ' ORDER BY name COLLATE NOCASE ASC'; break;
    case 'date': sql += ' ORDER BY date_added DESC'; break;
    case 'expiry': sql += ' ORDER BY expiry_date ASC NULLS LAST'; break;
    case 'category': sql += ' ORDER BY category COLLATE NOCASE ASC, name COLLATE NOCASE ASC'; break;
    default: sql += ' ORDER BY updated_at DESC';
  }

  const items = db.prepare(sql).all(...params);
  res.json(items);
});

app.get('/api/categories', requireAuth, (req, res) => {
  const categories = db.prepare('SELECT DISTINCT category FROM items ORDER BY category COLLATE NOCASE ASC').all();
  res.json(categories.map(c => c.category));
});

app.get('/api/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM items').get();
  const totalQty = db.prepare('SELECT COALESCE(SUM(quantity), 0) as total FROM items').get();
  const categories = db.prepare('SELECT COUNT(DISTINCT category) as count FROM items').get();
  const expiringSoon = db.prepare(
    "SELECT COUNT(*) as count FROM items WHERE expiry_date IS NOT NULL AND expiry_date <= date('now', '+7 days') AND expiry_date >= date('now')"
  ).get();
  const expired = db.prepare(
    "SELECT COUNT(*) as count FROM items WHERE expiry_date IS NOT NULL AND expiry_date < date('now')"
  ).get();

  res.json({
    totalItems: total.count,
    totalQuantity: totalQty.total,
    totalCategories: categories.count,
    expiringSoon: expiringSoon.count,
    expired: expired.count
  });
});

app.post('/api/items', requireAuth, (req, res) => {
  const { name, category, quantity, unit, expiry_date, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Naam is verplicht' });
  }

  const stmt = db.prepare(
    `INSERT INTO items (name, category, quantity, unit, expiry_date, notes)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const result = stmt.run(
    name.trim(),
    (category || 'Overig').trim(),
    quantity || 1,
    unit || 'stuks',
    expiry_date || null,
    notes ? notes.trim() : null
  );

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(item);
});

app.put('/api/items/:id', requireAuth, (req, res) => {
  const { name, category, quantity, unit, expiry_date, notes } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Naam is verplicht' });
  }

  const stmt = db.prepare(
    `UPDATE items SET name = ?, category = ?, quantity = ?, unit = ?, expiry_date = ?, notes = ?, updated_at = datetime('now')
     WHERE id = ?`
  );
  stmt.run(
    name.trim(),
    (category || 'Overig').trim(),
    quantity || 1,
    unit || 'stuks',
    expiry_date || null,
    notes ? notes.trim() : null,
    req.params.id
  );

  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item niet gevonden' });
  res.json(item);
});

app.delete('/api/items/:id', requireAuth, (req, res) => {
  const result = db.prepare('DELETE FROM items WHERE id = ?').run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Item niet gevonden' });
  res.json({ success: true });
});

// Serve the SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🧊 Diepvries Voorraad draait op http://localhost:${PORT}`);
  console.log(`📌 Pincode: ${PIN}`);
});
