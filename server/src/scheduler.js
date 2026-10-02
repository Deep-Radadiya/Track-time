// The alarm clock. It lives inside the server, so there is nothing else to run.
import { checkDueReminders } from './jobs/reminders.js';
import { runDaySummaries } from './jobs/summary.js';
import { runHourlyCheckins } from './jobs/checkins.js';

// Wraps a job so that: a run is skipped if the last one is still going,
// and an error in one run is logged and does not stop the timer.
function safely(job) {
  let running = false;
  return async () => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (err) {
      console.error(`[Scheduler] ${job.name} failed:`, err);
    } finally {
      running = false;
    }
  };
}

const HOUR = 60 * 60 * 1000;

export function startScheduler() {
  // Every minute: send reminders that are due.
  setInterval(safely(checkDueReminders), 60 * 1000);

  // Every minute: ask "what are you working on?" when a check-in is due.
  setInterval(safely(runHourlyCheckins), 60 * 1000);

  // Every hour, exactly on the hour: write the 9 PM summaries.
  const summaries = safely(runDaySummaries);
  setTimeout(() => {
    summaries();
    setInterval(summaries, HOUR);
  }, HOUR - (Date.now() % HOUR));

  console.log('[Scheduler] started: reminders and check-ins every minute, summaries every hour');
}
