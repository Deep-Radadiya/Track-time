// Route: POST /tasks/parse-voice. Turns a spoken or typed sentence into a DRAFT reminder.
import { Router } from 'express';
import { requireLogin } from '../auth.js';
import { NotConfigured } from '../groq.js';
import { parseVoiceTranscript } from '../voiceService.js';
import { recordActivity } from '../activityService.js';
import { localIso } from '../taskService.js';

const router = Router();

// It never saves a reminder. The app shows the draft, and the user confirms with POST /tasks.
router.post('/parse-voice', requireLogin, async (req, res) => {
  const { transcript } = req.body;
  if (typeof transcript !== 'string' || !transcript.trim()) return res.status(422).json({ detail: 'transcript is required' });

  let result;
  try {
    result = await parseVoiceTranscript(transcript, localIso(new Date(), req.user.timezone));
  } catch (err) {
    if (err instanceof NotConfigured) return res.status(503).json({ detail: 'Voice parsing is not set up (GROQ_API_KEY is missing)' });
    return res.status(502).json({ detail: `Voice parsing failed: ${err.message}` });
  }

  await recordActivity({
    userId: req.user._id,
    type: 'voice_update',
    source: 'voice',
    taskTitle: 'Voice input',
    notes: transcript.slice(0, 1000),
    metadata: { event: 'voice_parse', parsed_task_count: result.tasks.length },
  });
  res.json(result);
});

export default router;
