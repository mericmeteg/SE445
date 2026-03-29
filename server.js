'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { appendLead }             = require('./services/sheetsService');
const { generateAcknowledgment } = require('./services/aiService');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Simple email format validator.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

/**
 * Sanitises a string field — trims whitespace.
 * @param {*} value
 * @returns {string}
 */
function sanitise(value) {
  return String(value ?? '').trim();
}

// ── Routes ─────────────────────────────────────────────────────────────────

/** GET / — serve the demo web form */
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * POST /webhook
 * Accepts { name, email, message }
 * → Validates → AI acknowledgment → Google Sheets → JSON response
 */
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  // 1. Extract & sanitise fields
  const name    = sanitise(req.body.name);
  const email   = sanitise(req.body.email);
  const message = sanitise(req.body.message);

  // 2. Validate presence
  const missing = [];
  if (!name)    missing.push('name');
  if (!email)   missing.push('email');
  if (!message) missing.push('message');

  if (missing.length > 0) {
    return res.status(400).json({
      success: false,
      error:   'Missing required fields',
      missing,
    });
  }

  // 3. Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({
      success: false,
      error:   'Invalid email address',
    });
  }

  console.info(`[webhook] New lead received — Name: "${name}", Email: "${email}"`);

  // 4. Generate AI acknowledgment (non-blocking on failure)
  let aiResponse = '';
  try {
    aiResponse = await generateAcknowledgment({ name, email, message });
  } catch (aiErr) {
    console.error('[webhook] AI service error (non-fatal):', aiErr.message);
    aiResponse = `Hi ${name}, thank you for your message! We'll be in touch shortly.`;
  }

  // 5. Save to Google Sheets (non-blocking on failure)
  let sheetSaved   = false;
  let sheetError   = null;
  try {
    await appendLead({ name, email, message, aiResponse });
    sheetSaved = true;
  } catch (sheetErr) {
    console.error('[webhook] Google Sheets error (non-fatal):', sheetErr.message);
    sheetError = sheetErr.message;
  }

  const elapsed = Date.now() - startTime;
  console.info(`[webhook] Processed in ${elapsed}ms — sheetSaved: ${sheetSaved}`);

  // 6. Respond
  return res.status(200).json({
    success:     true,
    message:     'Lead captured successfully',
    aiResponse,
    meta: {
      sheetSaved,
      ...(sheetError ? { sheetError } : {}),
      processingMs: elapsed,
    },
  });
});

// ── Health check ───────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
  });
});

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   Lead Capture Webhook — Running ✓       ║
╠══════════════════════════════════════════╣
║  Local:   http://localhost:${PORT}          ║
║  Webhook: POST /webhook                  ║
║  Health:  GET  /health                   ║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app; // for testing
