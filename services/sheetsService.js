'use strict';

const { google } = require('googleapis');

// Column order written to the sheet
const COLUMNS = ['Timestamp', 'Name', 'Email', 'Message', 'AI Response'];

/**
 * Returns an authenticated Google Sheets client using a Service Account.
 * Credentials are read from environment variables so no JSON file is needed.
 */
function getSheetsClient() {
  const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL: client_email,
    GOOGLE_PRIVATE_KEY: private_key,
  } = process.env;

  if (!client_email || !private_key) {
    throw new Error(
      'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email,
      // The private key in .env uses literal \n — convert them to real newlines
      private_key: private_key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

/**
 * Ensures the header row exists in the target sheet.
 * Writes headers only if the first row is currently empty.
 *
 * @param {object} sheets  Authenticated Sheets client
 * @param {string} spreadsheetId
 * @param {string} sheetName
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1:E1`,
    });

    const firstRow = res.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: 'RAW',
        requestBody: { values: [COLUMNS] },
      });
      console.info('[sheetsService] Header row written.');
    }
  } catch (err) {
    // Non-fatal — proceed even if header check fails
    console.warn('[sheetsService] Could not verify/write headers:', err.message);
  }
}

/**
 * Appends a lead row to the Google Sheet.
 *
 * @param {{ name: string, email: string, message: string, aiResponse: string }} lead
 * @returns {Promise<{ updatedRange: string }>}
 */
async function appendLead(lead) {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  const sheetName     = process.env.GOOGLE_SHEET_NAME || 'Leads';

  if (!spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_ID is not set in .env');
  }

  const sheets = getSheetsClient();

  await ensureHeaders(sheets, spreadsheetId, sheetName);

  const timestamp = new Date().toISOString();
  const row = [
    timestamp,
    lead.name,
    lead.email,
    lead.message,
    lead.aiResponse,
  ];

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:E`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [row] },
  });

  const updatedRange = response.data.updates?.updatedRange ?? `${sheetName}!A?:E?`;
  console.info(`[sheetsService] Lead appended → ${updatedRange}`);

  return { updatedRange };
}

module.exports = { appendLead };
