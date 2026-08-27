/**
 * CIPP Exam Simulation — server
 *
 * Serves the static frontend and backs its window.storage shim with a
 * tiny key/value API, persisted to a JSON file on disk. This mirrors
 * Anthropic's artifact storage contract (get/set/delete/list, string
 * values, prefix listing) closely enough that the frontend needed zero
 * changes beyond the shim in public/index.html.
 *
 * Persistence note: data.json lives next to this file. Railway's
 * filesystem survives restarts but is wiped on a fresh deploy unless you
 * attach a Volume mounted at this directory. For a training simulation
 * that's normally fine — a trainer just clicks "Reset Simulation" (or
 * redeploys) to start a clean session. Attach a Volume if you want
 * scores to outlive a redeploy.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

let store = {};
try {
  store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch (e) {
  store = {};
}

let writeQueued = false;
function persist() {
  if (writeQueued) return;
  writeQueued = true;
  setTimeout(() => {
    writeQueued = false;
    fs.writeFile(DATA_FILE, JSON.stringify(store), (err) => {
      if (err) console.error('Failed to persist data.json:', err.message);
    });
  }, 150); // small debounce so a burst of writes doesn't hammer disk
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// ---- storage API -----------------------------------------------------

app.get('/api/kv', (req, res) => {
  const prefix = req.query.prefix || '';
  const keys = Object.keys(store).filter((k) => k.startsWith(prefix));
  res.json({ keys });
});

app.get('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  if (!Object.prototype.hasOwnProperty.call(store, key)) {
    return res.status(404).json({ error: 'not found' });
  }
  res.json({ value: store[key] });
});

app.put('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  const value = req.body && req.body.value;
  if (typeof value !== 'string') {
    return res.status(400).json({ error: 'value must be a string' });
  }
  store[key] = value;
  persist();
  res.json({ value });
});

app.delete('/api/kv/:key', (req, res) => {
  const key = req.params.key;
  delete store[key];
  persist();
  res.json({ deleted: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- static frontend ---------------------------------------------------

app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback (the app is hash-routed, so this only matters for direct
// hits to unknown paths)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('CIPP Exam Simulation listening on port ' + PORT);
});
