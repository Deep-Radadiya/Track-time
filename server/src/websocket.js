// Live updates. Every open browser tab keeps a WebSocket connection to the server.
// When something changes, we send a small message so the tab refreshes by itself.
import { WebSocketServer } from 'ws';
import { readToken } from './auth.js';
import { User } from './models/User.js';

const connections = new Map(); // userId -> the set of that user's open tabs

// Sends a message to all open tabs of one user (except `exclude`, if given).
export function broadcast(userId, message, exclude = null) {
  for (const socket of connections.get(String(userId)) ?? []) {
    if (socket !== exclude && socket.readyState === 1) socket.send(JSON.stringify(message));
  }
}

// Lets browsers connect at ws://server/ws?token=ACCESS_TOKEN
export function attachWebSocket(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/ws') return socket.destroy();

    let user = null;
    try {
      const data = readToken(url.searchParams.get('token') || '');
      if (data.type !== 'access') throw new Error('wrong token type');
      user = await User.findById(data.sub);
    } catch {
      user = null;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      if (!user) return ws.close(1008, 'Unauthorized');

      const id = user.id;
      if (!connections.has(id)) connections.set(id, new Set());
      connections.get(id).add(ws);

      // A tab can tell the user's other tabs about a change it made.
      ws.on('message', (raw) => {
        try { broadcast(id, JSON.parse(raw.toString()), ws); } catch { /* ignore bad messages */ }
      });
      ws.on('close', () => {
        connections.get(id)?.delete(ws);
        if (connections.get(id)?.size === 0) connections.delete(id);
      });
    });
  });
}
