'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = 'gemini-3.1-flash-lite-preview';

// Low temperature = more deterministic, consistent outputs
const CLASSIFY_CONFIG = { temperature: 0.1, maxOutputTokens: 32 };
const ACK_CONFIG      = { temperature: 0.4, maxOutputTokens: 150 };

function getModel(generationConfig) {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    .getGenerativeModel({ model: MODEL, generationConfig });
}

/**
 * Classifies a lead's intent and urgency using Gemini.
 * @param {{ name: string, message: string }} lead
 * @returns {Promise<{ intent: string, urgency: string }>}
 */
async function classifyLead(lead) {
  if (!process.env.GEMINI_API_KEY) {
    return { intent: 'Support', urgency: 'Medium' };
  }

  const { name, message } = lead;

  const prompt = `Classify this contact form message. Reply with ONLY a JSON object, nothing else.

INTENT rules (pick exactly one):
- "Sales"       → asks about price, cost, plan, subscription, demo, trial, buy, purchase
- "Partnership" → mentions collaboration, integration, partner, joint, affiliate, reseller
- "Support"     → everything else (help, issue, bug, question, account, login, problem)

URGENCY rules (pick exactly one):
- "High"   → contains words like urgent, asap, immediately, critical, emergency, deadline, broken, down
- "Low"    → general curiosity, no action needed soon, just browsing or exploring
- "Medium" → everything else

Examples:
Message: "I need pricing for 50 users ASAP"         → {"intent":"Sales","urgency":"High"}
Message: "What are your enterprise plans?"           → {"intent":"Sales","urgency":"Medium"}
Message: "We'd love to explore a partnership"        → {"intent":"Partnership","urgency":"Low"}
Message: "My account is locked, urgent!"             → {"intent":"Support","urgency":"High"}
Message: "I can't log in to my account"              → {"intent":"Support","urgency":"Medium"}
Message: "Just curious about your product"           → {"intent":"Support","urgency":"Low"}
Message: "luglglj"                                   → {"intent":"Support","urgency":"Low"}

Now classify:
Name: ${name}
Message: "${message}"

Reply with ONLY JSON, no explanation:`;

  try {
    const result = await getModel(CLASSIFY_CONFIG).generateContent(prompt);
    const raw = result.response.text().trim().replace(/```json|```/g, '').trim();

    // extract first {...} block in case model adds extra text
    const match = raw.match(/\{[^}]+\}/);
    if (!match) throw new Error('No JSON found in response');

    const parsed = JSON.parse(match[0]);

    const validIntents   = ['Support', 'Sales', 'Partnership'];
    const validUrgencies = ['High', 'Medium', 'Low'];

    const intent  = validIntents.includes(parsed.intent)    ? parsed.intent  : 'Support';
    const urgency = validUrgencies.includes(parsed.urgency) ? parsed.urgency : 'Medium';

    console.info(`[aiService] Classification → intent: ${intent}, urgency: ${urgency}`);
    return { intent, urgency };

  } catch (err) {
    console.error('[aiService] Classification failed, using defaults:', err.message);
    return { intent: 'Support', urgency: 'Medium' };
  }
}

/**
 * Generates a short acknowledgment message for a valid lead.
 * @param {{ name: string, email: string, message: string }} lead
 * @returns {Promise<string>}
 */
async function generateAcknowledgment(lead) {
  if (!process.env.GEMINI_API_KEY) {
    return buildTemplateResponse(lead.name);
  }

  const { name, message } = lead;

  const prompt = `Write a short acknowledgment email reply (2-3 sentences, max 60 words).

Rules:
- Start with "Hi ${name},"
- Confirm their message was received
- Say someone will follow up within 1 business day
- Be warm and professional
- Do NOT include subject line, signature, or any extra formatting
- Do NOT use markdown

Their message: "${message}"`;

  try {
    const result = await getModel(ACK_CONFIG).generateContent(prompt);
    const text = result.response.text().trim();

    if (!text) throw new Error('Empty response');

    console.info(`[aiService] Acknowledgment generated for "${name}".`);
    return text;

  } catch (err) {
    console.error('[aiService] Acknowledgment failed, using template:', err.message);
    return buildTemplateResponse(name);
  }
}

function buildTemplateResponse(name) {
  return `Hi ${name}, thank you for reaching out! We've received your message and a member of our team will get back to you within 1 business day.`;
}

module.exports = { generateAcknowledgment, classifyLead };
