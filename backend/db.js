// db.js — SQLite database using sql.js (pure JavaScript, no compiler needed)
const path = require('path');
const fs   = require('fs');

const DB_PATH = path.join(__dirname, 'noor.db');

let db    = null;
let sqlJs = null;

// ── Initialize (async because sql.js loads a WASM binary) ─────────────────
async function initDb() {
  if (db) return db;

  const initSqlJs = require('sql.js');
  sqlJs = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new sqlJs.Database(fileBuffer);
  } else {
    db = new sqlJs.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS patients (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT    NOT NULL,
      age        INTEGER,
      gender     TEXT,
      city       TEXT,
      occupation TEXT,
      contact    TEXT,
      referral   TEXT,
      reason     TEXT,
      created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS results (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL,
      test_id    TEXT    NOT NULL,
      test_name  TEXT    NOT NULL,
      instrument TEXT,
      score      INTEGER NOT NULL,
      score_max  INTEGER NOT NULL,
      severity   TEXT,
      action     TEXT,
      answers    TEXT,
      datetime   TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_results_patient ON results(patient_id);
    CREATE INDEX IF NOT EXISTS idx_results_test    ON results(test_id);
    CREATE INDEX IF NOT EXISTS idx_results_date    ON results(datetime);
  `);

  persist();
  return db;
}

function persist() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function runInsert(sql, params) {
  db.run(sql, params);
  const row = db.exec('SELECT last_insert_rowid() as id')[0];
  const id  = row ? row.values[0][0] : null;
  persist();
  return id;
}

function queryAll(sql, params) {
  const result = db.exec(sql, params || []);
  if (!result.length) return [];
  const { columns, values } = result[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function queryOne(sql, params) {
  return queryAll(sql, params)[0] || null;
}

function runWrite(sql, params) {
  db.run(sql, params || []);
  persist();
}

module.exports = { initDb, runInsert, queryAll, queryOne, runWrite };
