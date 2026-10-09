// The alarm clock. It lives inside the server, so there is nothing else to run.
import { checkDueReminders } from './jobs/reminders.js';

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

export function startScheduler() {
  // Every minute: send reminders that are due.
  setInterval(safely(checkDueReminders), 60 * 1000);

  console.log('[Scheduler] started: reminders every minute');
}
