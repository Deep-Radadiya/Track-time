// Start here: connect to the database, then start listening for requests.
import mongoose from 'mongoose';
import app from './app.js';
import { config } from './config.js';
import { startScheduler } from './scheduler.js';
import { attachWebSocket } from './websocket.js';

// The timers must keep running, so one unexpected error is logged instead of stopping the whole server.
process.on('unhandledRejection', (err) => console.error('[Server] unhandled error:', err));
process.on('uncaughtException', (err) => console.error('[Server] uncaught error:', err));

await mongoose.connect(config.mongoUri);
console.log('Connected to MongoDB');

const server = app.listen(config.port, () => console.log(`Server running on http://localhost:${config.port}`));
attachWebSocket(server);

// DISABLE_SCHEDULER=1 turns the timer off (useful for tests).
if (process.env.DISABLE_SCHEDULER !== '1') startScheduler();
