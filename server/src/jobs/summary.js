// The job that runs every hour: for each user whose local time is 9 PM, write and send the day's summary.
import { User } from '../models/User.js';
import { localNow, validZone } from '../taskService.js';
import { buildDailyStats, generateSummary, saveSummary } from '../summaryService.js';
import { NotConfigured } from '../groq.js';
import { sendToUser, summaryPayload } from '../push.js';
import { broadcast } from '../websocket.js';

export async function runDaySummaries() {
  const now = new Date();
  const users = await User.find({ daily_summary_enabled: true });

  for (const user of users) {
    const hour = Math.floor(localNow(now, validZone(user.timezone || 'UTC')).seconds / 3600);
    if (hour !== 21) continue; // not 9 PM for this user

    try {
      const result = await generateSummary(await buildDailyStats(user._id));
      await saveSummary(user, result);
      await sendToUser(user._id, summaryPayload(result)); // notification on every device
      broadcast(user.id, { event: 'summary_ready', summary: result }); // and straight into open tabs
    } catch (err) {
      if (err instanceof NotConfigured) {
        console.warn('[Job] day summaries skipped: GROQ_API_KEY is not set');
        return; // no key, so it would fail for every user
      }
      console.error(`[Job] summary failed for user ${user.id}:`, err.message);
    }
  }
}
