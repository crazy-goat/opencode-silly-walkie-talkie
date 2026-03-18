import { WalkieServer } from './server';
import { getLocalIp } from './tunnel';
import { generateQRCode } from './qr';

let server: any = null;
let sessionId: string | null = null;
let pendingMessage: { id: string; text: string } | null = null;

const WALKIE_XML_RE = /<walkie-connection ip="([^"]+)" port="(\d+)" token="([^"]*)"\s*\/>/;

export default async ({ client }: any) => {
  // Start server on random port, no token by default
  server = new WalkieServer('');
  const port = await server.start(0);

  // Forward messages from PWA to OpenCode session
  server.onMessage = (content: string) => {
    if (!sessionId) return;
    client.session.promptAsync({
      path: { id: sessionId },
      body: { parts: [{ type: 'text', text: content }] }
    }).catch(() => {});
  };

  return {
    tool: {
      walkie_qr: {
        description: 'Returns the Walkie-Talkie connection info for the mobile PWA. Show the result to the user as-is.',
        args: {},
        async execute() {
          if (!server) return 'Server not started';
          const ip = getLocalIp();
          const port = server.getPort();
          const token = server.getToken();
          return `<walkie-connection ip="${ip}" port="${port}" token="${token}" />`;
        }
      }
    },
    
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

      if (event.type === 'session.status' && event.status === 'awaiting_input') {
        if (pendingMessage) {
          server.broadcast({ 
            type: 'new_message', 
            message: { role: 'assistant', content: pendingMessage.text, timestamp: Date.now() } 
          });
          pendingMessage = null;
        }
        server.broadcast({ type: 'awaiting_input' });
      }

      if (event.type === 'session.idle') {
        if (pendingMessage) {
          server.broadcast({ 
            type: 'new_message', 
            message: { role: 'assistant', content: pendingMessage.text, timestamp: Date.now() } 
          });
          pendingMessage = null;
        }
        server.broadcast({ type: 'end' });
      }
    },

    'experimental.text.complete': async (_input: any, output: { text: string }) => {
      const match = output.text.match(WALKIE_XML_RE);
      if (!match) return;

      const [fullMatch, ip, port, token] = match;
      const wsUrl = token ? `wss://${ip}:${port}/${token}` : `wss://${ip}:${port}`;

      const httpUrl = `https://${ip}:${port}`;
      const autoConnectUrl = `${httpUrl}/?wsUrl=${encodeURIComponent(wsUrl)}`;
      const qr = await generateQRCode(autoConnectUrl);
      const replacement = `\`\`\`\n${qr}\n\`\`\`\nOpen on phone: ${httpUrl}\nWebSocket: ${wsUrl}`;
      output.text = output.text.replace(fullMatch, replacement);
    }
  };
};
