// Step 5 of the chat: read the AI's answer safely. It NEVER throws.
// Whatever the AI sends, we get back a clean object with a default for every field.

export const KNOWN_ACTIONS = [
  'chat_only', 'set_current_task', 'complete_task', 'create_task', 'update_task',
  'block_task', 'resume_task', 'list_tasks', 'log_productivity', 'unknown',
];
const PRODUCTIVITY_STATUSES = ['focused', 'distracted', 'break', 'idle'];

const asText = (v) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
};
const asInt = (v) => {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null;
  return /^[+-]?\d+$/.test(String(v).trim()) ? parseInt(v, 10) : null; // "12" yes, "12.5" no
};
const asConfidence = (v, fallback) => {
  if (v === null || v === undefined || String(v).trim() === '') return fallback;
  const n = Number(v);
  return Number.isNaN(n) ? fallback : Math.max(0, Math.min(1, n)); // always between 0 and 1
};

// The AI sometimes wraps its answer in ```json fences even though we told it not to.
function stripFences(text) {
  let t = text.trim();
  if (t.startsWith('```')) {
    let inner = t.split('```')[1] ?? '';
    if (inner.startsWith('json')) inner = inner.slice(4);
    t = inner.trim();
  }
  return t.replace(/^`+|`+$/g, '').trim();
}

export function parseIntent(rawText) {
  let data;
  try {
    data = JSON.parse(stripFences(String(rawText ?? '')));
  } catch {
    return {
      action: 'unknown',
      reply: "I had a little hiccup processing that — could you try again? I'm here to help!",
      task_name: null, task_id: null, confidence: 0, productivity_status: null, duration_minutes: null, note: null,
    };
  }

  // The AI must answer with a JSON object. Anything else gets the default "please rephrase".
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return {
      action: 'unknown', reply: "I'm here to help! Could you rephrase that?",
      task_name: null, task_id: null, confidence: 0, productivity_status: null, duration_minutes: null, note: null,
    };
  }

  let action = asText(data.action) ?? 'unknown';
  if (!KNOWN_ACTIONS.includes(action)) action = 'chat_only'; // an action we do not know: just chat

  let status = asText(data.productivity_status);
  if (status && !PRODUCTIVITY_STATUSES.includes(status)) status = null;

  return {
    action,
    reply: asText(data.reply) ?? "I'm here to help! Let me know what you need.",
    task_name: asText(data.task_name),
    task_id: asText(data.task_id),
    confidence: asConfidence(data.confidence, 0.5),
    productivity_status: status,
    duration_minutes: asInt(data.duration_minutes),
    note: asText(data.note),
  };
}
