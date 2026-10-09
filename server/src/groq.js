// The one place that talks to the AI (Groq). Voice parsing and the chat both use it.
import { config } from './config.js';

export class NotConfigured extends Error {}

// Sends a question to the AI and returns its text answer. Throws if the key is missing or Groq fails.
export async function askGroq({ system, user, messages, maxTokens = 600, temperature }) {
  if (!config.groqApiKey) throw new NotConfigured('GROQ_API_KEY is not set');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.groqApiKey}` },
    body: JSON.stringify({
      model: config.groqModel,
      max_tokens: maxTokens,
      ...(temperature !== undefined && { temperature }),
      // Give either `messages` (a full chat) or a simple `system` + `user` pair.
      messages: messages ?? [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!response.ok) throw new Error(`Groq returned HTTP ${response.status}`);

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// The AI sometimes wraps JSON in ```json fences. Remove them and read the JSON. Throws if it is not valid JSON.
export function parseJsonAnswer(text) {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error('The AI did not return valid JSON');
  }
}
