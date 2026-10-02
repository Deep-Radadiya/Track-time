// Voice to reminder: the AI turns a sentence like "remind me to call the dentist tomorrow at 3pm"
// into a draft reminder. Nothing is saved here. The user checks the draft first.
import { askGroq, parseJsonAnswer } from './groq.js';

const PROMPT = `You convert spoken task transcripts into structured JSON.
Output ONLY valid JSON, no markdown fences, no commentary, matching exactly this shape:

{"tasks": [{"title": str, "due_date": str|null, "due_time": str|null, "recurrence": "none"|"interval"|"daily"|"weekly", "interval_minutes": int|null, "notes": [{"text": str}], "ambiguous_fields": [str]}]}

Rules:
- due_date: ISO format YYYY-MM-DD if a specific date is stated or can be resolved from "today"/"tomorrow" relative to the given current date. If genuinely ambiguous (e.g. "tomorrow morning" with no exact time), still give the date but list "due_time" as null and add "due_time" to ambiguous_fields.
- due_time: 24-hour "HH:MM" if stated or inferable (e.g. "morning" is ambiguous -> null). For relative times like "in 20 minutes", compute the absolute due_date/due_time from the given current datetime.
- recurrence: "interval" for "every N minutes/hours", "daily" for once-a-day repeats, "weekly" for once-a-week, "none" for one-off.
- interval_minutes: only set when recurrence == "interval".
- Default start time for recurrence: If the transcript specifies an interval or recurrence but NO explicit start time (e.g., "drink water every two minutes"), you MUST extract the due_date and due_time directly from the provided current datetime. Do not leave them null.
- Multiple tasks in one transcript -> multiple entries in "tasks".
- ambiguous_fields: list any field names you could not confidently resolve.
- Never include any text outside the JSON object.`;

const RECURRENCES = ['none', 'interval', 'daily', 'weekly'];
const textOrNull = (v) => (typeof v === 'string' ? v : null);

// Checks the AI's answer and fixes small gaps (missing lists, missing recurrence).
// Anything really wrong throws, so the app never trusts raw AI text.
function validate(data) {
  if (!data || !Array.isArray(data.tasks)) throw new Error('The AI answer has no "tasks" list');

  return {
    tasks: data.tasks.map((t) => {
      if (!t || typeof t.title !== 'string' || !t.title.trim()) throw new Error('A task from the AI has no title');
      const recurrence = t.recurrence ?? 'none';
      if (!RECURRENCES.includes(recurrence)) throw new Error(`recurrence must be one of ${RECURRENCES.join(', ')}`);
      return {
        title: t.title,
        due_date: textOrNull(t.due_date),
        due_time: textOrNull(t.due_time),
        recurrence,
        interval_minutes: Number.isInteger(t.interval_minutes) ? t.interval_minutes : null,
        notes: (Array.isArray(t.notes) ? t.notes : []).filter((n) => typeof n?.text === 'string').map((n) => ({ text: n.text })),
        ambiguous_fields: (Array.isArray(t.ambiguous_fields) ? t.ambiguous_fields : []).filter((f) => typeof f === 'string'),
      };
    }),
  };
}

// currentIso is "now" in the user's time zone, so the AI can work out "tomorrow" and "in 20 minutes".
export async function parseVoiceTranscript(transcript, currentIso) {
  const answer = await askGroq({
    system: PROMPT,
    user: `Current datetime (ISO, use for resolving relative times): ${currentIso}\n\nTranscript:\n${transcript}`,
    maxTokens: 2000,
    temperature: 0.1,
  });
  return validate(parseJsonAnswer(answer));
}
