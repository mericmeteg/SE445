# Lead Capture Workflow

A Node.js webhook server that captures web form leads, validates them, classifies intent and urgency with **Google Gemini AI**, and saves everything to **Google Sheets**.

---

## Architecture

```
Browser Form  ──POST /webhook──►  Express Server
                                       │
                      ┌────────────────┼───────────────────────┐
                      ▼                ▼                        ▼
               Validate fields   Gemini AI                Google Sheets
               (name/email/msg)  (Intent + Urgency         (8-column row:
               → Valid/Invalid    + Acknowledgment)         data + metadata)
```

---

## HW3 — Logic & Intelligent Processing

The pipeline now adds two layers on top of HW2:

1. **Validation layer** — flags each submission as `Valid` or `Invalid` (missing fields, bad email). Invalid leads are **never deleted** — they are saved to Sheets with the validation reason.
2. **AI classification layer** — Google Gemini classifies every valid lead:
   - **Intent**: `Support` | `Sales` | `Partnership`
   - **Urgency**: `High` | `Medium` | `Low`

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | bundled with Node | — |
| Google Cloud account | — | https://console.cloud.google.com |
| Google AI Studio account | — | https://aistudio.google.com |

---

## Quick Start

### 1. Install dependencies

```bash
cd SE445
npm install
```

### 2. Configure environment variables

Fill in your `.env` file (see sections below).

### 3. Run the server

```bash
npm start
```

Open **http://localhost:3000** to see the form.

---

## Setting Up Google Sheets

### Step 1 — Create a Google Cloud project

1. Go to https://console.cloud.google.com/
2. Click **"New Project"**, give it a name, click **Create**

### Step 2 — Enable the Sheets API

1. In the left menu: **APIs & Services → Library**
2. Search for **"Google Sheets API"** and click **Enable**

### Step 3 — Create a Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **"Create Service Account"**, give it a name, click **Create and Continue**
3. No roles needed — click **Done**

### Step 4 — Download the JSON key

1. Click on your new service account → **Keys** tab
2. Click **Add Key → Create new key → JSON**
3. Save the downloaded file somewhere safe

### Step 5 — Configure `.env`

```ini
GOOGLE_SERVICE_ACCOUNT_EMAIL=my-sa@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

> ⚠️ Keep the quotes and the literal `\n` characters — do **not** add real line breaks.

### Step 6 — Create your Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet
2. Copy the **Spreadsheet ID** from the URL and add to `.env`:

```ini
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEET_NAME=Leads
```

### Step 7 — Share the sheet with the service account

1. In Google Sheets, click **Share**
2. Paste the service account email, set role to **Editor**, click **Send**

---

## Setting Up Gemini AI

1. Go to https://aistudio.google.com
2. Click **"Get API Key" → "Create API key"**
3. Add it to `.env`:

```ini
GEMINI_API_KEY=AIza...
```

> If `GEMINI_API_KEY` is not set, the server uses `Support / Medium` as default classification and a template acknowledgment message — **the app still works without it**.

---

## API Reference

### `POST /webhook`

Accepts JSON body:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "message": "I urgently need pricing for 50 users"
}
```

**Valid lead — `200`:**

```json
{
  "success": true,
  "message": "Lead captured successfully",
  "validationStatus": "Valid",
  "intent": "Sales",
  "urgency": "High",
  "aiResponse": "Hi Jane, thank you for reaching out! ...",
  "meta": { "sheetSaved": true, "processingMs": 834 }
}
```

**Invalid lead — `422` (still saved to Sheets):**

```json
{
  "success": false,
  "message": "Lead saved with validation errors",
  "validationStatus": "Invalid: invalid email format",
  "validationIssues": ["invalid email format"],
  "meta": { "sheetSaved": true, "processingMs": 130 }
}
```

### `GET /health`

Returns server uptime and timestamp.

---

## Testing with curl

```bash
# Valid lead
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@example.com","message":"I urgently need pricing for 50 users, deadline this week"}'

# Invalid lead (bad email — still saved with flag)
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"bademail","message":"Hello"}'
```

---

## Project Structure

```
SE445/
├── server.js                # Webhook — validation, classification, routing
├── services/
│   ├── aiService.js         # Gemini AI — classifyLead() + generateAcknowledgment()
│   └── sheetsService.js     # Google Sheets — 8-column append
├── public/
│   └── index.html           # Web form UI
├── .env                     # Your credentials (never commit real values!)
├── package.json
└── README.md
```

---

## Google Sheet Column Layout

| A | B | C | D | E | F | G | H |
|---|---|---|---|---|---|---|---|
| Timestamp | Name | Email | Message | Validation Status | Intent | Urgency | AI Response |

The header row is written and updated automatically.
