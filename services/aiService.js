'use strict';

const OpenAI = require('openai');

/**
 * Generates a short, friendly acknowledgment message for a new lead.
 *
 * Uses OpenAI gpt-4o-mini when OPENAI_API_KEY is set.
 * Falls back to a warm template message if no key is configured.
 *
 * @param {{ name: string, email: string, message: string }} lead
 * @returns {Promise<string>} The acknowledgment text
 */
async function generateAcknowledgment(lead) {
  const { name, email, message } = lead;

  // ── Template fallback (no API key required) ───────────────────
  if (!process.env.OPENAI_API_KEY) {
    console.info('[aiService] No OPENAI_API_KEY set — using template response.');
    return buildTemplateResponse(name);
  }

  // ── OpenAI gpt-4o-mini ────────────────────────────────────────
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are a friendly, professional customer success assistant.
When a new lead submits a contact form, you write a short (2–3 sentence) acknowledgment reply.
Be warm, personalize by name, confirm you received their message, and set expectations
that someone will follow up within 1 business day. Do NOT add a subject line or sign-off.`;

    const userPrompt = `New lead details:
- Name: ${name}
- Email: ${email}
- Message: "${message}"

Write the acknowledgment reply now.`;

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt  },
      ],
      max_tokens: 120,
      temperature: 0.7,
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    if (!responseText) throw new Error('Empty response from OpenAI');

    console.info(`[aiService] AI acknowledgment generated for "${name}".`);
    return responseText;

  } catch (err) {
    console.error('[aiService] OpenAI call failed, using template fallback:', err.message);
    return buildTemplateResponse(name);
  }
}

/**
 * Returns a hardcoded warm acknowledgment when AI is unavailable.
 * @param {string} name
 * @returns {string}
 */
function buildTemplateResponse(name) {
  return (
    `Hi ${name}, thank you for reaching out! We've received your message and truly appreciate you taking the time to contact us. ` +
    `A member of our team will get back to you within 1 business day — we look forward to connecting with you soon.`
  );
}

module.exports = { generateAcknowledgment };
