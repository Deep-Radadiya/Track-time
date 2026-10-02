// The daily summary: count the day's tasks, ask the AI (Groq) to write a short recap, save it.
import { askGroq, parseJsonAnswer } from './groq.js';
import { Task } from './models/Task.js';
import { DailySummary } from './models/DailySummary.js';
import { localDateString } from './activityService.js';

// Numbers about the user's tasks. The AI turns these into a friendly message.
export async function buildDailyStats(userId) {
  const tasks = await Task.find({ user_id: userId });
  const open = tasks.filter((t) => t.status !== 'done');
  return {
    completed_count: tasks.length - open.length,
    still_open_count: open.length,
    still_open_titles: open.slice(0, 10).map((t) => t.title),
    snooze_count: tasks.reduce((sum, t) => sum + t.snoozed_count_today, 0),
    voice_created: tasks.filter((t) => t.source === 'voice').length,
    text_created: tasks.filter((t) => t.source === 'text').length,
  };
}

const PROMPT =
  'You write a short, encouraging end-of-day task summary for a productivity app.\n' +
  'Output ONLY valid JSON, no markdown fences, no commentary, matching exactly:\n' +
  '{"summary": str, "highlight": str, "concern": str, "tomorrow_suggestion": str}\n' +
  'Keep each field to 1-2 sentences, friendly and specific to the data given.';

// Asks the AI for the summary. Always returns exactly the 4 text fields, or throws.
export async function generateSummary(stats) {
  const answer = await askGroq({ system: PROMPT, user: `Today's stats: ${JSON.stringify(stats)}`, maxTokens: 600 });
  const parsed = parseJsonAnswer(answer);

  const result = {};
  for (const field of ['summary', 'highlight', 'concern', 'tomorrow_suggestion']) {
    if (typeof parsed[field] !== 'string') throw new Error(`The AI answer is missing "${field}"`);
    result[field] = parsed[field];
  }
  return result;
}

// Saves today's summary for the user. A second one on the same day replaces the first.
export function saveSummary(user, content) {
  return DailySummary.findOneAndUpdate(
    { user_id: user._id, date: localDateString(user.timezone) },
    { content, created_at: new Date() },
    { upsert: true, returnDocument: 'after' }
  );
}
