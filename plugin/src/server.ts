import * as fs from 'fs';
import * as path from 'path';
import type { ServerEvent, ClientCommand, Message } from './protocol';
import { ensureTlsCert } from './tls';

declare const Bun: any;

function findPwaDir(): string | null {
  const candidates = [path.join(process.cwd(), 'pwa')];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  }
  return null;
}

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export class WalkieServer {
  private token: string = '';
  private clients: Set<any> = new Set();
  private messages: Message[] = [];
  private port: number = 0;
  private bunServer: any = null;
  private pwaDir: string | null = null;
  private tlsCert: any = null;
  onDebug: ((msg: string, extra?: any) => void) | null = null;

  constructor(private fixedToken: string = '') {}

  async start(port: number = 0): Promise<number> {
    this.token = this.fixedToken; // Can be empty string (no auth)
    this.pwaDir = findPwaDir();

    const self = this;

    if (!this.tlsCert) this.tlsCert = ensureTlsCert();
    const tls = this.tlsCert;

    this.bunServer = Bun.serve({
      port,
      hostname: '0.0.0.0',
      tls: {
        cert: tls.cert,
        key: tls.key,
      },

      fetch(req: Request, server: any) {
        const url = new URL(req.url);
        const token = url.pathname.split('/').filter(Boolean)[0] ?? '';

        if (req.headers.get('upgrade') === 'websocket') {
          // If no token required, accept any; otherwise check token
          if (self.token && token !== self.token) {
            return new Response('Invalid token', { status: 403 });
          }
          const ok = server.upgrade(req, { data: { token } });
          if (!ok) return new Response('Upgrade failed', { status: 500 });
          return undefined as any;
        }

        const pwaDir = self.pwaDir;
        if (!pwaDir) return new Response('PWA not found', { status: 404 });

        let filePath = path.join(pwaDir, url.pathname === '/' ? 'index.html' : url.pathname);
        if (!fs.existsSync(filePath)) filePath = path.join(pwaDir, 'index.html');

        const ext = path.extname(filePath);
        try {
          const data = fs.readFileSync(filePath);
          return new Response(data, {
            headers: { 'Content-Type': MIME[ext] || 'application/octet-stream' },
          });
        } catch {
          return new Response('Not found', { status: 404 });
        }
      },

      websocket: {
        open(ws: any) {
          const token = ws.data?.token ?? '';
          self.onDebug?.('WS open', { token, expected: self.token });
          // Validate token if set
          if (self.token && token !== self.token) {
            ws.close(1008, 'Invalid token');
            return;
          }
          self.clients.add(ws);
          ws.send(JSON.stringify({ payload: { type: 'heartbeat', timestamp: Date.now() } }));
          self.onClientConnected?.();
        },
        message(ws: any, data: string) {
          try {
            const command = JSON.parse(data) as ClientCommand;
            self._handleCommand(ws, command);
          } catch {}
        },
        close(ws: any) {
          self.onDebug?.('WS close', {});
          self.clients.delete(ws);
          self.onClientDisconnected?.();
        },
      },
    });

    this.port = this.bunServer.port;

    setInterval(() => {
      self.broadcast({ type: 'heartbeat', timestamp: Date.now() });
    }, 10000).unref();

    return this.port;
  }

  onMessage: ((content: string) => void) | null = null;
  onAnswer: ((requestID: string, answers: string[][]) => void) | null = null;
  onClientConnected: (() => void) | null = null;
  onClientDisconnected: (() => void) | null = null;

  private _handleCommand(ws: any, command: ClientCommand): void {
    switch (command.type) {
      case 'get_messages': {
        const after = (command as any).after as string | undefined;
        let messages = this.messages;
        if (after) {
          const idx = messages.findIndex(m => m.id === after);
          messages = idx >= 0 ? messages.slice(idx + 1) : [];
        }
        ws.send(JSON.stringify({ payload: { type: 'messages', messages } }));
        break;
      }
      case 'ping':
        ws.send(JSON.stringify({ payload: { type: 'pong', timestamp: Date.now() } }));
        break;
      case 'send_message':
        if (this.onMessage && (command as any).content) {
          this.onMessage((command as any).content);
        }
        break;
      case 'answer_question':
        if (this.onAnswer) {
          this.onAnswer((command as any).requestID, (command as any).answers);
        }
        break;
      case 'bye':
        ws.close();
        break;
    }
  }

  broadcast(event: ServerEvent): void {
    const msg = JSON.stringify({ payload: event });
    for (const ws of this.clients) {
      try { ws.send(msg); } catch {}
    }
  }

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  clearMessages(): void {
    this.messages = [];
  }

  getToken(): string {
    return this.token;
  }

  getPort(): number {
    return this.port;
  }

  getClientCount(): number {
    return this.clients.size;
  }

  async stop(): Promise<void> {
    await this.bunServer?.stop();
  }
}
