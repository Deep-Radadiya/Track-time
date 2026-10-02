// Routes: POST /summary/trigger (make one now) and GET /summary/history (past ones).
import { Router } from 'express';
import { DailySummary } from '../models/DailySummary.js';
import { requireLogin } from '../auth.js';
import { buildDailyStats, generateSummary, saveSummary } from '../summaryService.js';
import { NotConfigured } from '../groq.js';

const router = Router();
router.use(requireLogin);

// For testing. The real one is made automatically at 9 PM in the user's time zone.
router.post('/trigger', async (req, res) => {
  try {
    const result = await generateSummary(await buildDailyStats(req.user._id));
    await saveSummary(req.user, result);
    res.json(result);
  } catch (err) {
    if (err instanceof NotConfigured) return res.status(503).json({ detail: 'AI summary is not set up (GROQ_API_KEY is missing)' });
    console.error('[Summary] failed:', err.message);
    res.status(502).json({ detail: 'Could not create the summary right now' });
  }
});

router.get('/history', async (req, res) => {
  const limit = req.query.limit === undefined ? 30 : Number(req.query.limit);
  const offset = req.query.offset === undefined ? 0 : Number(req.query.offset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(422).json({ detail: 'limit must be between 1 and 100' });
  if (!Number.isInteger(offset) || offset < 0) return res.status(422).json({ detail: 'offset must be 0 or more' });

  const filter = { user_id: req.user._id };
  const [summaries, total] = await Promise.all([
    DailySummary.find(filter).sort({ date: -1 }).skip(offset).limit(limit),
    DailySummary.countDocuments(filter),
  ]);
  res.json({ summaries, total });
});

export default router;
