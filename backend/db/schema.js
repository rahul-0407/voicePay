const Database = require("better-sqlite3");

const db = new Database("voicepay.db");

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
