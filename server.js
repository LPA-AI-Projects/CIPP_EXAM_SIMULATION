/**
 * CIPP Exam Simulation — server
 *
 * Serves the static frontend and backs its window.storage shim with a
 * tiny key/value API. Uses PostgreSQL when DATABASE_URL is set (Railway),
 * otherwise falls back to data.json for local development.
 *
 * Participant data is stored under keys like:
 *   cipp:session-state
 *   cipp:progress:<learnerId>
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const DATA_FILE = path.join(__dirname, 'data.json');
const DATABASE_URL = process.env.DATABASE_URL;

let pool = null;
let fileStore = {};
let writeQueued = false;

function useDatabase() {
  return Boolean(pool);
}

async function initStorage() {
  if (!DATABASE_URL) {
    try {
      fileStore = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    } catch (e) {
      fileStore = {};
    }
    console.log('No DATABASE_URL — using data.json for local storage');
    return;
  }

  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') || DATABASE_URL.includes('127.0.0.1')
      ? false
      : { rejectUnauthorized: false },
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log('Using PostgreSQL for participant data');
}

function persistFile() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    fs.writeFile(DATA_FILE, JSON.stringify(fileStore), (err) => {
      if (err) console.error('Failed to persist data.json:', err.message);
    });
  }, 150);
}

async function listKeys(prefix) {
  if (useDatabase()) {
    const result = await pool.query(
      'SELECT key FROM kv_store WHERE key LIKE $1',
      [prefix + '%']
    );
    return result.rows.map((row) => row.key);
  }
  return Object.keys(fileStore).filter((k) => k.startsWith(prefix));
}

async function getValue(key) {
  if (useDatabase()) {
    const result = await pool.query('SELECT value FROM kv_store WHERE key = $1', [key]);
    return result.rows[0] ? result.rows[0].value : null;
  }
  return Object.prototype.hasOwnProperty.call(fileStore, key) ? fileStore[key] : null;
}

async function setValue(key, value) {
  if (useDatabase()) {
    await pool.query(
      `INSERT INTO kv_store (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = NOW()`,
      [key, value]
    );
    return;
  }
  fileStore[key] = value;
  persistFile();
}

async function deleteValue(key) {
  if (useDatabase()) {
    await pool.query('DELETE FROM kv_store WHERE key = $1', [key]);
    return;
  }
  delete fileStore[key];
  persistFile();
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---- storage API -----------------------------------------------------

app.get('/api/kv', async (req, res) => {
  try {
    const prefix = req.query.prefix || '';
    const keys = await listKeys(prefix);
    res.json({ keys });
  } catch (err) {
    console.error('KV list failed:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

app.get('/api/kv/:key', async (req, res) => {
  try {
    const value = await getValue(req.params.key);
    if (value === null) return res.status(404).json({ error: 'not found' });
    res.json({ value });
  } catch (err) {
    console.error('KV get failed:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

app.put('/api/kv/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const value = req.body && req.body.value;
    if (typeof value !== 'string') {
      return res.status(400).json({ error: 'value must be a string' });
    }
    await setValue(key, value);
    res.json({ value });
  } catch (err) {
    console.error('KV set failed:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

app.delete('/api/kv/:key', async (req, res) => {
  try {
    await deleteValue(req.params.key);
    res.json({ deleted: true });
  } catch (err) {
    console.error('KV delete failed:', err.message);
    res.status(500).json({ error: 'storage error' });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    if (useDatabase()) await pool.query('SELECT 1');
    res.json({ ok: true, storage: useDatabase() ? 'postgres' : 'file' });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
});

// ---- static frontend ---------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;

initStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log('CIPP Exam Simulation listening on port ' + PORT);
    });
  })
  .catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
