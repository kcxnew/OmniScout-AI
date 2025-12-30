import Fastify from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { logger } from '../lib/logger';

const fastify = Fastify();
const pairingStore = new Map<string, { userId: string; expires: number }>();
const clients = new Map<string, WebSocket>();

// Endpoint buat pairing token
fastify.post('/api/v1/ghost/pair', async (req, reply) => {
  const userId = (req.body as any).userId;
  if (!userId) return reply.code(400).send({ error: 'userId required' });

  const token = uuidv4();
  pairingStore.set(token, { userId, expires: Date.now() + 2 * 60 * 1000 }); // 2 menit TTL

  logger.info({ userId, token }, 'Created pairing token');
  return { token, expiresIn: 120 };
});

// HTTP server untuk upgrade WS
const server = http.createServer(fastify.server);

// WebSocket server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url || '', 'http://localhost');
  if (url.pathname === '/ghost/connect') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url || '', 'http://localhost');
  const token = url.searchParams.get('token');
  if (!token || !pairingStore.has(token)) {
    ws.close(4001, 'Invalid or expired token');
    return;
  }

  clients.set(token, ws);
  logger.info({ token }, 'Local Ghost client connected');

  ws.on('message', (msg) => {
    try {
      const obj = JSON.parse(msg.toString());
      logger.info({ token, msg: obj }, 'Received message from client');
      // TODO: Forward to Temporal workflow or handle commands here
    } catch (e) {
      logger.error({ err: e }, 'Failed to parse client message');
    }
  });

  ws.on('close', () => {
    clients.delete(token);
    logger.info({ token }, 'Local Ghost client disconnected');
  });
});

// Helper kirim command ke client
export async function sendCommandToLocal(token: string, command: any) {
  const ws = clients.get(token);
  if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('Client offline');
  ws.send(JSON.stringify(command));
}

export default fastify;
export { server };