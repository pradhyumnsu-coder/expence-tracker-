const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const backendRoot = path.resolve(__dirname, '..', '..');
const isVercel = Boolean(process.env.VERCEL);
const dbFullPath = isVercel
  ? '/tmp/expense-tracker.db'
  : path.resolve(backendRoot, process.env.DB_PATH || 'database/expense-tracker.db');

// Ensure the directory for the database file exists
fs.mkdirSync(path.dirname(dbFullPath), { recursive: true });

let db;

try {
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbFullPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  // Handle Windows Smart App Control / WDAC blocking unsigned prebuilt .node binaries
  if (err.code === 'ERR_DLOPEN_FAILED' || err.message.includes('Application Control')) {
    console.warn(
      '[database] Notice: better-sqlite3 native binary was blocked by Windows Application Control policy.'
    );
    console.warn('[database] Seamlessly falling back to Node.js built-in synchronous SQLite engine.');
    const { DatabaseSync } = require('node:sqlite');

    class DatabaseAdapter {
      constructor(filePath) {
        this._db = new DatabaseSync(filePath);
      }
      pragma(pragmaStr) {
        return this._db.exec(`PRAGMA ${pragmaStr}`);
      }
      exec(sql) {
        return this._db.exec(sql);
      }
      prepare(sql) {
        return this._db.prepare(sql);
      }
      close() {
        return this._db.close();
      }
    }

    db = new DatabaseAdapter(dbFullPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  } else {
    throw err;
  }
}

// Automatically create tables and indexes on start using schema.sql if they do not exist
const schemaPath = path.resolve(backendRoot, 'database', 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);
}

module.exports = db;
