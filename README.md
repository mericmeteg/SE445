# 🪝 Lead Capture Workflow

A Node.js webhook server that captures web form leads, saves them to **Google Sheets**, and generates an **AI-powered acknowledgment** via OpenAI.

---

## Architecture

```
Browser Form  ──POST /webhook──►  Express Server
                                       │
                      ┌────────────────┼──────────────────┐
                      ▼                ▼                   ▼
               Validate fields   AI Acknowledgment   Google Sheets
               (name/email/msg)  (OpenAI gpt-4o-mini)  (Sheets API)
                                       │                   │
                                  JSON response       New row appended
```

---

## Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | bundled with Node | — |
| Google Cloud account | — | https://console.cloud.google.com |
| OpenAI account *(optional)* | — | https://platform.openai.com |

---

## Quick Start

### 1. Install Node.js

Download and install Node.js from **https://nodejs.org** (LTS version recommended).

### 2. Install dependencies

```bash
cd SE445
npm install
```

### 3. Configure environment variables

```bash
# Copy the template
copy .env.example .env
```

Then open `.env` and fill in your credentials (see sections below).

### 4. Run the server

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
2. Click **"Create Service Account"**
3. Give it a name (e.g. `lead-capture-bot`), click **Create and Continue**
4. No roles needed — click **Done**

### Step 4 — Download the JSON key

1. Click on your new service account
2. Go to the **"Keys"** tab
3. Click **Add Key → Create new key → JSON**
4. Save the downloaded file somewhere safe

### Step 5 — Configure `.env`

Open the JSON key file. Copy these values into your `.env`:

```ini
GOOGLE_SERVICE_ACCOUNT_EMAIL=my-sa@my-project.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
```

> ⚠️ Keep the quotes and the literal `\n` characters — do **not** add real line breaks.

### Step 6 — Create your Google Sheet

1. Go to https://sheets.google.com and create a new spreadsheet
2. Copy the **Spreadsheet ID** from the URL:
   `https://docs.google.com/spreadsheets/d/`**`SPREADSHEET_ID`**`/edit`
3. Add it to `.env`:

```ini
GOOGLE_SPREADSHEET_ID=your_spreadsheet_id_here
GOOGLE_SHEET_NAME=Leads
```

### Step 7 — Share the sheet with the service account

1. In Google Sheets, click **Share**
2. Paste the service account email (from Step 4 above)
3. Set role to **Editor** and click **Send**

---

## Setting Up OpenAI *(optional)*

1. Go to https://platform.openai.com/api-keys
2. Create a new secret key
3. Add it to `.env`:

```ini
OPENAI_API_KEY=sk-...
```

> If `OPENAI_API_KEY` is not set, the server uses a warm template message instead — **the app works without it**.

---

## API Reference

### `POST /webhook`

Accepts JSON body:

```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "message": "Hi, I'd love to work together!"
}
```

**Success response `200`:**

```json
{
  "success": true,
  "message": "Lead captured successfully",
  "aiResponse": "Hi Jane, thank you for reaching out! ...",
  "meta": {
    "sheetSaved": true,
    "processingMs": 834
  }
}
```

**Validation error `400`:**

```json
{
  "success": false,
  "error": "Missing required fields",
  "missing": ["email"]
}
```

### `GET /health`

Returns server uptime and timestamp.

---

## Testing with curl

```bash
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Smith","email":"jane@example.com","message":"Hello, I need help!"}'
```

---

## Project Structure

```
SE445/
├── server.js                # Express app — webhook & static serving
├── services/
│   ├── aiService.js         # OpenAI acknowledgment (+ template fallback)
│   └── sheetsService.js     # Google Sheets append via Service Account
├── public/
│   └── index.html           # Dark-mode web form UI
├── .env.example             # Credentials template
├── .env                     # Your credentials (never commit this!)
├── package.json
└── README.md
```

---

## Google Sheet Column Layout

| A | B | C | D | E |
|---|---|---|---|---|
| Timestamp | Name | Email | Message | AI Response |
| 2025-01-15T12:00:00.000Z | Jane Smith | jane@example.com | Hello! | Hi Jane, … |

The header row is written automatically on first use.
