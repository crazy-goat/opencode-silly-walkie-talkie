import { WalkieServer } from './server';
import { getLocalIp } from './tunnel';

let server: any = null;
let sessionId: string | null = null;
let pendingMessage: { id: string; text: string } | null = null;
let lastBroadcastId: string | null = null;

export default async ({ client }: any) => {
  server = new WalkieServer('');
  const port = await server.start(0);
  const ip = getLocalIp();
  const wsUrl = `wss://${ip}:${port}`;

  const WEBUI_URL = process.env.WALKIE_WEBUI_URL || 'https://localhost:3000';

  const register = () =>
    fetch(`${WEBUI_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wsUrl }),
    }).catch(() => {});

  const unregister = () =>
    fetch(`${WEBUI_URL}/api/register`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wsUrl }),
    }).catch(() => {});

  register();
  process.on('exit', () => unregister());
  process.on('SIGTERM', () => { unregister(); process.exit(0); });
  process.on('SIGINT', () => { unregister(); process.exit(0); });

  server.onMessage = (content: string) => {
    if (!sessionId) return;
    server.addMessage({ role: 'user', content, timestamp: Date.now() });
    client.session.promptAsync({
      path: { id: sessionId },
      body: { parts: [{ type: 'text', text: content }] }
    }).catch(() => {});
  };

  server.onAnswer = (requestID: string, answers: string[][]) => {
    client.question.reply({
      path: { requestID },
      body: { answers },
    }).catch(() => {});
  };

  return {
    event: async ({ event }: any) => {
      if (!server) return;

      if (event.type === 'session.created') {
        sessionId = event.properties?.info?.id ?? null;
      }

      if (event.type === 'message.updated' && event.properties?.info?.role === 'assistant') {
        const info = event.properties.info;
        const resp = await client.session.message({
          path: { id: info.sessionID, messageID: info.id }
        }).catch(() => ({ data: null }));

        const parts = resp.data?.parts || [];
        const text = parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');

        if (text) {
          pendingMessage = { id: info.id, text };
        }
      }

      const _flushPending = () => {
        if (pendingMessage && pendingMessage.id !== lastBroadcastId) {
          lastBroadcastId = pendingMessage.id;
          const message = { role: 'assistant', content: pendingMessage.text, timestamp: Date.now() };
          server.addMessage(message);
          server.broadcast({ type: 'new_message', message });
        }
        pendingMessage = null;
      };

      if (event.type === 'session.status' && event.properties?.status === 'awaiting_input') {
        _flushPending();
        server.broadcast({ type: 'awaiting_input' });
      }

      if (event.type === 'session.idle') {
        _flushPending();
        server.broadcast({ type: 'end' });
      }

      if (event.type === 'question.asked') {
        const req = event.properties;
        server.broadcast({
          type: 'question',
          requestID: req.id,
          questions: req.questions.map((q: any) => ({
            question: q.question,
            header: q.header,
            options: q.options,
            multiple: q.multiple,
            custom: q.custom,
          })),
        });
      }
    },
  };
};
