import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import initSqlJs, { Database } from 'sql.js';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// ---------------------------------------------------------------------------
// 1. Database Initialization (SQLite via sql.js)
// ---------------------------------------------------------------------------
let db: Database;
const dbPath = path.join(process.cwd(), 'responses.db');

async function setupDatabase() {
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    const filebuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(filebuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      selected_activity TEXT,
      selected_day TEXT,
      selected_time TEXT,
      raw_payload TEXT
    )
  `);
  saveDatabase();
  console.log('Initialized SQLite database at:', dbPath);
}

function saveDatabase() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ---------------------------------------------------------------------------
// 2. Express Server Setup
// ---------------------------------------------------------------------------
async function startServer() {
  await setupDatabase();

  const app = express();
  app.use(express.json());

  // API Routes
  app.post('/api/sendForm', async (req, res) => {
    try {
      const { selectedActivity, selectedDay, selectedTime } = req.body || {};
      try {
        db.run(
          `INSERT INTO responses (selected_activity, selected_day, selected_time, raw_payload)
           VALUES (?, ?, ?, ?)`,
          [
            selectedActivity || '',
            selectedDay || '',
            selectedTime || '',
            JSON.stringify(req.body),
          ]
        );
        saveDatabase();
      } catch (dbErr) {
        console.error('SQLite insert error:', dbErr);
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Error handling /api/sendForm:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get('/api/responses', (req, res) => {
    try {
      const stmt = db.prepare('SELECT * FROM responses ORDER BY created_at DESC');
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      res.json({ responses: rows });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n==================================================`);
    console.log(`🚀 App running locally at: http://localhost:${PORT}`);
    console.log(`🔗 Local link: http://127.0.0.1:${PORT}`);
    console.log(`==================================================\n`);
  });
}

startServer();
