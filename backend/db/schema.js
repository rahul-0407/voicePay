const Databse = require('better-sqlite3')

const db = new Databse('voicepay.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users(
    phone_hash      TEXT PRIMARY KEY,
    wallet_address  TEXT NOT NULL
    wallet_index    INTEGER NOT NULL
    created_at      INTEGER NOT NULL
    )
`)


module.exports = db;