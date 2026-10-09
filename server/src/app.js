// Builds the Express app: middleware first, then the routes.
import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { isPushReady } from './push.js';
import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import voiceRoutes from './routes/voice.js';
import deviceRoutes from './routes/devices.js';
import activityRoutes from './routes/activities.js';
import companionRoutes from './routes/companion.js';

const app = express();

app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json());

// push: false means the notification keys are missing or wrong (see the server log).
app.get('/health', (req, res) => res.json({ status: 'ok', push: isPushReady() }));
app.use('/auth', authRoutes);
app.use('/tasks', voiceRoutes);
app.use('/tasks', taskRoutes);
app.use('/devices', deviceRoutes);
app.use('/activities', activityRoutes);
app.use('/companion', companionRoutes);

// Any error not handled above ends up here, so the server never crashes on one bad request.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ detail: 'Something went wrong on the server' });
});

export default app;
