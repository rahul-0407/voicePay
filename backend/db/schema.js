const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = process.env.DB_PATH || path.join(__dirname, '..', 'voicepay.db');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    phone_hash      TEXT PRIMARY KEY,
    wallet_address  TEXT NOT NULL,
    wallet_index    INTEGER NOT NULL,
    created_at      INTEGER NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    owner_phone_hash  TEXT NOT NULL,
    name              TEXT NOT NULL,
    contact_phone     TEXT NOT NULL,
    PRIMARY KEY (owner_phone_hash, name)
  )
`);

module.exports = db;