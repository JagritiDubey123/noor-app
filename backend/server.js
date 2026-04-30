// server.js — Noor Mental Health Screening Backend
require('dotenv').config();

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const jwt        = require('jsonwebtoken');
const path       = require('path');
const { initDb, runInsert, queryAll, queryOne, runWrite } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET  = process.env.JWT_SECRET  || 'noor_default_secret';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '8h';
const ADMIN_PIN   = process.env.ADMIN_PIN   || '2104';

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(morgan('dev'));

// Serve frontend
app.use(express.static(path.join(__dirname, 'frontend')));

// Rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});
app.use('/api/', apiLimiter);

// ── Auth Middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });
  const token = authHeader.split(' ')[1];
  try {
    req.admin = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /api/results — Save a completed test result
app.post('/api/results', (req, res) => {
  const { patient, testId, testName, instrument, score, scoreMax, severity, action, answers, datetime } = req.body;

  if (!patient?.name || !testId || score === undefined) {
    return res.status(400).json({ error: 'Missing required fields: patient.name, testId, score' });
  }

  const now = datetime || new Date().toLocaleString('en-IN');

  const patientId = runInsert(
    `INSERT INTO patients (name, age, gender, city, occupation, contact, referral, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patient.name, patient.age || null, patient.gender || null, patient.city || null,
     patient.occupation || null, patient.contact || null, patient.referral || null,
     patient.reason || null, now]
  );

  runInsert(
    `INSERT INTO results (patient_id, test_id, test_name, instrument, score, score_max, severity, action, answers, datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [patientId, testId, testName || testId, instrument || '', score,
     scoreMax || 0, severity || '', action || '', JSON.stringify(answers || []), now]
  );

  res.status(201).json({ success: true, message: 'Result saved successfully.' });
});

// POST /api/admin/login — Verify PIN, return JWT
app.post('/api/admin/login', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN is required' });
  if (pin !== ADMIN_PIN) return res.status(401).json({ error: 'Incorrect PIN' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
  res.json({ success: true, token });
});

// ════════════════════════════════════════════════════════════════════════════
// PROTECTED ADMIN ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /api/admin/stats
app.get('/api/admin/stats', requireAuth, (req, res) => {
  const totalPatients = queryOne('SELECT COUNT(*) as n FROM patients')?.n || 0;
  const totalTests    = queryOne('SELECT COUNT(*) as n FROM results')?.n || 0;

  // "Today" using string comparison (datetime stored as locale string — use date prefix)
  const today = new Date().toLocaleDateString('en-IN');
  const allToday = queryAll('SELECT datetime FROM results');
  const testsToday = allToday.filter(r => r.datetime && r.datetime.startsWith(today)).length;

  const topTest = queryOne(
    `SELECT test_name, COUNT(*) as cnt FROM results GROUP BY test_name ORDER BY cnt DESC LIMIT 1`
  );

  const severityBreakdown = queryAll(
    `SELECT severity, COUNT(*) as cnt FROM results WHERE severity != '' GROUP BY severity ORDER BY cnt DESC`
  );

  const testBreakdown = queryAll(
    `SELECT test_name, COUNT(*) as cnt FROM results GROUP BY test_name ORDER BY cnt DESC`
  );

  res.json({
    totalPatients,
    totalTests,
    testsToday,
    topTest: topTest?.test_name || '—',
    severityBreakdown,
    testBreakdown
  });
});

// GET /api/admin/records — paginated, searchable
app.get('/api/admin/records', requireAuth, (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)      || 1);
  const pageSize = Math.min(100, parseInt(req.query.pageSize) || 15);
  const search   = (req.query.search   || '').toLowerCase();
  const testId   = req.query.testId   || '';
  const severity = (req.query.severity || '').toLowerCase();

  // Fetch all joined records then filter in JS (sql.js doesn't support named params with LIKE easily)
  const all = queryAll(`
    SELECT r.id, r.datetime, r.test_id, r.test_name, r.instrument,
           r.score, r.score_max, r.severity, r.action,
           p.name, p.age, p.gender, p.city, p.occupation, p.contact, p.referral, p.reason
    FROM results r JOIN patients p ON r.patient_id = p.id
    ORDER BY r.id DESC
  `);

  const filtered = all.filter(r => {
    const matchSearch = !search ||
      (r.name  || '').toLowerCase().includes(search) ||
      (r.city  || '').toLowerCase().includes(search) ||
      (r.test_name || '').toLowerCase().includes(search);
    const matchTest = !testId   || r.test_id === testId;
    const matchSev  = !severity || (r.severity || '').toLowerCase().includes(severity);
    return matchSearch && matchTest && matchSev;
  });

  const total  = filtered.length;
  const offset = (page - 1) * pageSize;
  const paged  = filtered.slice(offset, offset + pageSize);

  const records = paged.map(r => ({
    id: r.id,
    datetime: r.datetime,
    testId: r.test_id,
    testName: r.test_name,
    instrument: r.instrument,
    score: r.score,
    scoreMax: r.score_max,
    severity: r.severity,
    action: r.action,
    patient: {
      name: r.name, age: r.age, gender: r.gender, city: r.city,
      occupation: r.occupation, contact: r.contact,
      referral: r.referral, reason: r.reason
    }
  }));

  res.json({ total, page, pageSize, records });
});

// DELETE /api/admin/records — clear all data
app.delete('/api/admin/records', requireAuth, (req, res) => {
  runWrite('DELETE FROM results');
  runWrite('DELETE FROM patients');
  res.json({ success: true, message: 'All records deleted.' });
});

// GET /api/admin/export — all records as JSON for Excel
app.get('/api/admin/export', requireAuth, (req, res) => {
  const rows = queryAll(`
    SELECT r.datetime, r.test_name, r.instrument, r.score, r.score_max, r.severity, r.action,
           p.name, p.age, p.gender, p.city, p.occupation, p.contact, p.referral, p.reason
    FROM results r JOIN patients p ON r.patient_id = p.id
    ORDER BY r.id DESC
  `);

  const data = rows.map((r, i) => ({
    'S.No': i + 1,
    'Date & Time': r.datetime,
    'Patient Name': r.name,
    'Age': r.age,
    'Gender': r.gender,
    'City': r.city,
    'Occupation': r.occupation,
    'Contact': r.contact,
    'Referred By': r.referral,
    'Reason for Test': r.reason,
    'Test Name': r.test_name,
    'Instrument': r.instrument,
    'Score': r.score,
    'Max Score': r.score_max,
    'Severity Level': r.severity,
    'Recommended Action': r.action
  }));

  res.json(data);
});

// Fallback — serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// ── Start server after DB is ready ───────────────────────────────────────────
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✅  Noor backend running at http://localhost:${PORT}`);
    console.log(`   Admin PIN : ${ADMIN_PIN}`);
    console.log(`   Database  : ${path.join(__dirname, 'noor.db')}\n`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
