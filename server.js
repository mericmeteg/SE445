'use strict';

require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { appendLead }                          = require('./services/sheetsService');
const { generateAcknowledgment, classifyLead } = require('./services/aiService');

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
 * → Validates (flags invalid, never rejects) → AI classification → AI acknowledgment → Google Sheets → JSON response
 */
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();

  // 1. Extract & sanitise fields
  const name    = sanitise(req.body.name);
  const email   = sanitise(req.body.email);
  const message = sanitise(req.body.message);

  // 2. Validate — collect issues but DO NOT reject; save with flag instead
  const validationIssues = [];
  if (!name)              validationIssues.push('missing name');
  if (!email)             validationIssues.push('missing email');
  else if (!isValidEmail(email)) validationIssues.push('invalid email format');
  if (!message)           validationIssues.push('missing message');

  const isValid        = validationIssues.length === 0;
  const validationStatus = isValid
    ? 'Valid'
    : `Invalid: ${validationIssues.join(', ')}`;

  console.info(`[webhook] Lead received — Name: "${name}", Email: "${email}", Status: ${validationStatus}`);

  // 3. AI classification — intent & urgency (run for all leads)
  let intent  = 'N/A';
  let urgency = 'N/A';
  if (isValid) {
    try {
      ({ intent, urgency } = await classifyLead({ name, email, message }));
    } catch (classErr) {
      console.error('[webhook] Classification error (non-fatal):', classErr.message);
      intent  = 'Support';
      urgency = 'Medium';
    }
  }

  // 4. Generate AI acknowledgment for valid leads only
  let aiResponse = '';
  if (isValid) {
    try {
      aiResponse = await generateAcknowledgment({ name, email, message });
    } catch (aiErr) {
      console.error('[webhook] AI acknowledgment error (non-fatal):', aiErr.message);
      aiResponse = `Hi ${name}, thank you for your message! We'll be in touch shortly.`;
    }
  }

  // 5. Save ALL leads to Google Sheets (valid and invalid alike)
  let sheetSaved = false;
  let sheetError = null;
  try {
    await appendLead({ name, email, message, validationStatus, intent, urgency, aiResponse });
    sheetSaved = true;
  } catch (sheetErr) {
    console.error('[webhook] Google Sheets error (non-fatal):', sheetErr.message);
    sheetError = sheetErr.message;
  }

  const elapsed = Date.now() - startTime;
  console.info(`[webhook] Processed in ${elapsed}ms — sheetSaved: ${sheetSaved}`);

  // 6. Respond — 200 for valid leads, 422 for invalid (but they were still saved)
  const statusCode = isValid ? 200 : 422;
  return res.status(statusCode).json({
    success:          isValid,
    message:          isValid ? 'Lead captured successfully' : 'Lead saved with validation errors',
    validationStatus,
    ...(isValid ? { intent, urgency, aiResponse } : { validationIssues }),
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
