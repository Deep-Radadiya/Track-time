// Reads a sentence like "Started frontend" or "Blocked because Docker won't start"
// and works out: what kind of update is it, which task, and any extra detail.
// It only uses simple word matching. No AI, so it is instant and always gives the same answer.

// Checked in this order: the first kind that matches wins.
const KINDS = [
  ['completed', /\b(completed?|finished?|done|wrapped\s+up|delivered|shipped|closed)\b/i],
  ['started', /\b(started?|began|beginning|kicked\s+off|launched|picked\s+up|initiating|initiated)\b/i],
  ['blocked', /\b(blocked?|stuck|can'?t|cannot|issue|problem|won'?t\s+start|doesn'?t\s+work|error|failing|failed)\b/i],
  ['working', /\b(working\s+on|working|currently|debugging|implementing|building|investigating|reviewing|testing|fixing|handling)\b/i],
];

// Small words removed from the start, so the title is clean.
const FILLER = /^(i'?m|i\s+am|i|the|a|an|on|for|with|that|it|this)\s+/i;
const TRIGGER_WORDS = /^(completed?|finished?|done|wrapped\s+up|delivered|shipped|closed|started?|began|beginning|kicked\s+off|launched|picked\s+up|blocked?|stuck|working\s+on|working|currently|debugging|implementing|building|investigating|reviewing|testing|fixing|handling|initiating|initiated)\s*/i;
const BECAUSE = /\b(because|since|as|due\s+to)\b/i;

function cleanTitle(raw) {
  const cleaned = raw.trim().replace(/[.,!?;:]+$/, '').replace(/\s+/g, ' ');
  return cleaned ? cleaned.slice(0, 200) : 'General Update';
}

export function extractIntent(text) {
  const stripped = text.trim();

  for (const [type, pattern] of KINDS) {
    if (!pattern.test(stripped)) continue;

    // Remove the matched word and the filler words, what is left is the title.
    let after = stripped.replace(pattern, '').trim();
    after = after.replace(FILLER, '').trim();
    after = after.replace(TRIGGER_WORDS, '').trim();

    let title, notes = null;
    if (type === 'blocked') {
      // "Docker is stuck because port is busy": the part before "because" is the title,
      // the part after is the reason.
      const m = BECAUSE.exec(after);
      title = cleanTitle(m ? after.slice(0, m.index) : after);
      if (m) notes = after.slice(m.index + m[0].length).trim() || null;
    } else {
      title = cleanTitle(after);
    }
    return { activity_type: type, task_title: title || cleanTitle(stripped), optional_notes: notes };
  }

  // Nothing matched.
  return { activity_type: 'status_update', task_title: cleanTitle(stripped), optional_notes: null };
}
