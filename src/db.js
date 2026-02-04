const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/visits.db');
const db = new Database(dbPath);

// Créer les tables
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    utm_source TEXT,
    ip TEXT,
    user_agent TEXT,
    referrer TEXT,
    page_path TEXT,
    duration INTEGER DEFAULT 0,
    device_type TEXT,
    session_id TEXT,
    max_scroll INTEGER DEFAULT 0,
    sections_viewed TEXT,
    chat_used INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS chat_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    session_id TEXT,
    role TEXT,
    message TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_visits_timestamp ON visits(timestamp);
  CREATE INDEX IF NOT EXISTS idx_visits_utm ON visits(utm_source);
  CREATE INDEX IF NOT EXISTS idx_visits_session ON visits(session_id);
`);

// Migrations : ajouter les colonnes si elles n'existent pas
try {
  db.exec(`ALTER TABLE visits ADD COLUMN max_scroll INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE visits ADD COLUMN sections_viewed TEXT`);
} catch (e) { /* colonne existe déjà */ }
try {
  db.exec(`ALTER TABLE visits ADD COLUMN chat_used INTEGER DEFAULT 0`);
} catch (e) { /* colonne existe déjà */ }

module.exports = db;
