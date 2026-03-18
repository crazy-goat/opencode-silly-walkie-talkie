import { WalkieServer } from './server';
import { getLocalIp } from './tunnel';

let server: any = null;
let sessionId: string | null = null;
let sessionTitle: string | null = null;
let pendingMessage: { id: string; text: string; tools: any[]; parts: any[] } | null = null;
let lastBroadcastId: string | null = null;
const broadcastedTools = new Set<string>();

export default async ({ client, directory, serverUrl: _serverUrl }: any) => {
  const _c = client?.event?._client || client?.session?._client;
  server = new WalkieServer('');
  const port = await server.start(0);
  const ip = getLocalIp();
  const wsUrl = `wss://${ip}:${port}`;

  const WEBUI_URL = process.env.WALKIE_WEBUI_URL || 'https://localhost:3000';

  const fetchInsecure = (url: string, opts: any) =>
    fetch(url, { ...opts, tls: { rejectUnauthorized: false } }).catch(() => {});

  const register = (sid: string, title?: string | null) =>
    fetchInsecure(`${WEBUI_URL}/api/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wsUrl, sessionId: sid, title: title ?? undefined }),
    });

  const unregister = () =>
    fetchInsecure(`${WEBUI_URL}/api/register`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wsUrl }),
    });

  const fetchTitle = async (id: string): Promise<string | null> => {
    const resp = await client.session.get({ path: { id } } as any).catch(() => ({ data: null }));
    return (resp as any)?.data?.title || null;
  };

  const loadHistory = async (id: string): Promise<void> => {
    const resp = await client.session.messages({ path: { id } } as any).catch(() => null);
    const items: any[] = (resp as any)?.data ?? [];
    server.clearMessages();
    for (const item of items) {
      const role = item.info?.role;
      if (!role) continue;
      const text = (item.parts as any[])
        .filter((p: any) => p.type === 'text' && !p.synthetic)
        .map((p: any) => p.text)
        .join('');
      if (!text) continue;
      server.addMessage({ role, content: text, timestamp: item.info?.time?.created ?? Date.now() });
    }
  };

  const selectSession = async (newId: string, title?: string | null) => {
    const resolvedTitle = title || await fetchTitle(newId);
    if (newId === sessionId) {
      if (resolvedTitle && resolvedTitle !== sessionTitle) {
        sessionTitle = resolvedTitle;
        register(sessionId, sessionTitle);
      }
      return;
    }
    if (sessionId) unregister();
    sessionId = newId;
    sessionTitle = resolvedTitle;
    broadcastedTools.clear();
    await loadHistory(newId);
    register(sessionId, sessionTitle);
  };

  const heartbeat = () => {
    if (sessionId) register(sessionId, sessionTitle);
  };

  setInterval(heartbeat, 15000).unref();

  client.global.event().then(({ stream }: any) => {
    client.session.list().then((resp: any) => {
      const sessions: any[] = resp?.data ?? [];
      const match = sessions.find((s: any) => s.directory === directory);
      if (match) selectSession(match.id, match.title || null);
    }).catch(() => {});

    (async () => {
      try {
        for await (const ev of stream) {
          const event = (ev as any)?.payload;
          if (!event) continue;
          if (event.type === 'tui.session.select') {
            if (event.properties?.sessionID) await selectSession(event.properties.sessionID);
          } else if (event.type === 'session.created' || event.type === 'session.updated') {
            const info = event.properties?.info;
            if (info?.id) await selectSession(info.id, info.title || null);
          }
        }
      } catch {}
    })();
  }).catch(() => {});

  server.onMessage = (content: string) => {
    if (!sessionId) return;
    server.addMessage({ role: 'user', content, timestamp: Date.now() });
    client.session.promptAsync({
      path: { id: sessionId },
      body: { parts: [{ type: 'text', text: content }] }
    }).catch(() => {});
  };

  server.onAnswer = (requestID: string, answers: string[][]) => {
    _c.post({
      url: `/question/${requestID}/reply`,
      body: { answers },
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => {});
  };

  return {
    event: async ({ event }: any) => {
      if (!server) return;

      if (event.type === 'session.created' || event.type === 'session.updated') {
        const info = event.properties?.info;
        if (info?.id) await selectSession(info.id, info.title || null);
        return;
      }

      if (event.type === 'message.updated' && event.properties?.info?.role === 'assistant') {
        const info = event.properties.info;
        if (info.sessionID !== sessionId) return;
        const resp = await client.session.message({
          path: { id: info.sessionID, messageID: info.id }
        }).catch(() => ({ data: null }));

        const parts = resp.data?.parts || [];
        const text = parts.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');

        for (const p of parts) {
          if (p.type === 'tool' && p.state?.status === 'completed' && !broadcastedTools.has(p.id)) {
            broadcastedTools.add(p.id);
            const input = p.state.input || {};
            const file = input.filePath || input.path || input.file || input.filename || '';
            const shortFile = file ? file.split('/').slice(-2).join('/') : '';
            const toolName = (p.tool as string).replace(/_/g, ' ').toLowerCase();
            const label = shortFile ? `${toolName} ${shortFile}` : toolName;
            server.broadcast({ type: 'tool_update', tool: { name: p.tool, label } });
          }
        }

        if (text) pendingMessage = { id: info.id, text, tools: [], parts };
      }

      const _flushPending = () => {
        if (pendingMessage && pendingMessage.id !== lastBroadcastId) {
          lastBroadcastId = pendingMessage.id;
          const tools = (pendingMessage.parts || [])
            .filter((p: any) => p.type === 'tool' && p.state?.status === 'completed')
            .map((p: any) => {
              const input = p.state.input || {};
              const output = typeof p.state.output === 'string' ? p.state.output : JSON.stringify(p.state.output ?? '');
              return { name: p.tool, input, output };
            });
          const message: any = {
            role: 'assistant',
            content: pendingMessage.text,
            timestamp: Date.now(),
          };
          if (tools.length) message.tools = tools;
          server.addMessage(message);
          server.broadcast({ type: 'new_message', message });
        }
        pendingMessage = null;
      };

      if (event.type === 'session.status' && event.properties?.status === 'awaiting_input') {
        if (event.properties?.sessionID !== sessionId) return;
        _flushPending();
        server.broadcast({ type: 'awaiting_input' });
      }

      if (event.type === 'session.idle') {
        if (event.properties?.sessionID !== sessionId) return;
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
