# OpenCode Walkie-Talkie - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a complete POC with OpenCode plugin (WebSocket server + ngrok tunnel) and PWA (Vanilla JS) for mobile notifications.

**Architecture:** OpenCode plugin uses official hooks (`session.idle`, `message.updated`) to broadcast events via WebSocket. ngrok provides public tunnel. PWA connects via WebSocket, displays QR scanner, shows notifications, and displays message history.

**Tech Stack:** TypeScript, Node.js, ws, ngrok, qrcode (plugin); Vanilla JS, html5-qrcode, WebSocket API (PWA).

---

## Prerequisites

Before starting:
1. Ensure Node.js >= 18 is installed: `node --version`
2. Install ngrok globally: `npm install -g ngrok`
3. Configure ngrok authtoken: `ngrok config add-authtoken <your_token>`

---

### Task 1: Project Structure

**Files:**
- Create: `plugin/package.json`
- Create: `plugin/tsconfig.json`
- Create: `pwa/index.html`
- Create: `pwa/manifest.json`
- Create: `pwa/src/app.js` (empty)

**Step 1: Create plugin/package.json**

```bash
mkdir -p plugin/src plugin/tests pwa/src
cat > plugin/package.json << 'EOF'
{
  "name": "@crazy-goat/opencode-walkie-talkie",
  "version": "0.1.0",
  "description": "Walkie-Talkie plugin for OpenCode - mobile notifications",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "jest"
  },
  "keywords": ["opencode", "opencode-plugin", "walkie-talkie", "mobile"],
  "author": "crazy-goat",
  "license": "MIT",
  "dependencies": {
    "ws": "^8.16.0",
    "@ngrok/ngrok": "^0.9.0",
    "qrcode": "^1.5.3",
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "@types/node": "^20.11.0",
    "@types/qrcode": "^1.5.5",
    "@types/uuid": "^9.0.7",
    "typescript": "^5.3.3",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.11",
    "ts-jest": "^29.1.1"
  }
}
EOF
```

**Step 2: Create plugin/tsconfig.json**

```bash
cat > plugin/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
EOF
```

**Step 3: Create pwa/index.html**

```bash
cat > pwa/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenCode Walkie-Talkie</title>
    <link rel="manifest" href="manifest.json">
    <link rel="stylesheet" href="src/styles.css">
</head>
<body>
    <div id="app">
        <h1>Walkie-Talkie for OpenCode</h1>
        <div id="scanner-container">
            <div id="qr-reader"></div>
        </div>
        <div id="connection-status">Disconnected</div>
        <div id="messages"></div>
    </div>
    <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
    <script src="src/ws-client.js"></script>
    <script src="src/qr-scanner.js"></script>
    <script src="src/ui.js"></script>
    <script src="src/app.js"></script>
</body>
</html>
EOF
```

**Step 4: Create pwa/manifest.json**

```bash
cat > pwa/manifest.json << 'EOF'
{
  "name": "OpenCode Walkie-Talkie",
  "short_name": "Walkie",
  "description": "Mobile notifications for OpenCode AI assistant",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#000000",
  "icons": [
    {
      "src": "icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
EOF
```

**Step 5: Create empty PWA source files**

```bash
touch pwa/src/app.js pwa/src/ws-client.js pwa/src/qr-scanner.js pwa/src/ui.js pwa/src/styles.css
```

**Step 6: Install plugin dependencies**

```bash
cd plugin && npm install
```

**Step 7: Verify structure**

Run: `find . -type f -name "*.json" -o -name "*.ts" -o -name "*.js" -o -name "*.html" | head -20`

Expected: List of created files including package.json, tsconfig.json, index.html, manifest.json

**Step 8: Commit**

```bash
git add .
git commit -m "chore: setup project structure"
```

---

### Task 2: WebSocket Protocol Types

**Files:**
- Create: `plugin/src/protocol.ts`
- Test: Check TypeScript compiles

**Step 1: Write protocol types**

```bash
cat > plugin/src/protocol.ts << 'EOF'
// WebSocket Protocol Types for OpenCode Walkie-Talkie

export type EventType = 'heartbeat' | 'new_message' | 'end' | 'messages' | 'awaiting_input' | 'pong';
export type CommandType = 'get_messages' | 'ping' | 'bye' | 'send_message';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

// Events: Server -> Client
export interface HeartbeatEvent {
  type: 'heartbeat';
  timestamp: number;
}

export interface NewMessageEvent {
  type: 'new_message';
  message: Message;
}

export interface EndEvent {
  type: 'end';
  timestamp: number;
}

export interface MessagesEvent {
  type: 'messages';
  messages: Message[];
}

export interface AwaitingInputEvent {
  type: 'awaiting_input';
  prompt?: string;
}

export interface PongEvent {
  type: 'pong';
  timestamp: number;
}

export type ServerEvent = 
  | HeartbeatEvent 
  | NewMessageEvent 
  | EndEvent 
  | MessagesEvent 
  | AwaitingInputEvent
  | PongEvent;

// Commands: Client -> Server
export interface GetMessagesCommand {
  type: 'get_messages';
}

export interface PingCommand {
  type: 'ping';
}

export interface ByeCommand {
  type: 'bye';
}

export interface SendMessageCommand {
  type: 'send_message';
  content: string;
}

export type ClientCommand = 
  | GetMessagesCommand 
  | PingCommand 
  | ByeCommand
  | SendMessageCommand;

// WebSocket message wrapper
export interface WebSocketMessage {
  id?: string;
  payload: ServerEvent | ClientCommand;
}
EOF
```

**Step 2: Compile TypeScript**

```bash
cd plugin && npx tsc --noEmit
```

Expected: No errors (empty output means success)

**Step 3: Commit**

```bash
git add plugin/src/protocol.ts
git commit -m "feat: add WebSocket protocol types"
```

---

### Task 3: WebSocket Server

**Files:**
- Create: `plugin/src/server.ts`
- Create: `plugin/tests/server.test.ts`

**Step 1: Write the failing test**

```bash
cat > plugin/tests/server.test.ts << 'EOF'
import { WalkieServer } from '../src/server';

describe('WalkieServer', () => {
  let server: WalkieServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should start server on specified port', async () => {
    server = new WalkieServer();
    const port = await server.start(8765);
    expect(port).toBe(8765);
  });

  test('should generate unique token on start', async () => {
    server = new WalkieServer();
    await server.start(8766);
    const token = server.getToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(10);
  });

  test('should accept valid token connection', async () => {
    server = new WalkieServer();
    await server.start(8767);
    const token = server.getToken();
    
    const ws = new WebSocket(`ws://localhost:8767?token=${token}`);
    
    await new Promise((resolve, reject) => {
      ws.on('open', resolve);
      ws.on('error', reject);
    });
    
    ws.close();
  });

  test('should reject invalid token', async () => {
    server = new WalkieServer();
    await server.start(8768);
    
    const ws = new WebSocket('ws://localhost:8768?token=invalid');
    
    await expect(new Promise((resolve, reject) => {
      ws.on('open', () => reject(new Error('Should not connect')));
      ws.on('error', resolve);
    })).resolves.toBeDefined();
  });
});
EOF
```

**Step 2: Configure Jest**

```bash
cat > plugin/jest.config.js << 'EOF'
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js'],
};
EOF
```

**Step 3: Run test to verify it fails**

```bash
cd plugin && npm test -- server.test.ts 2>&1 | head -30
```

Expected: FAIL - "Cannot find module '../src/server'"

**Step 4: Write minimal implementation**

```bash
cat > plugin/src/server.ts << 'EOF'
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import type { ServerEvent, ClientCommand, Message } from './protocol';

interface Client {
  ws: WebSocket;
  isAlive: boolean;
  lastPong: number;
}

export class WalkieServer {
  private wss: WebSocketServer | null = null;
  private token: string = '';
  private clients: Map<WebSocket, Client> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messages: Message[] = [];
  private port: number = 0;

  async start(port: number = 0): Promise<number> {
    this.port = port;
    this.token = uuidv4();
    
    this.wss = new WebSocketServer({ port: this.port });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });
    
    // Wait for server to start
    await new Promise<void>((resolve, reject) => {
      this.wss!.on('listening', resolve);
      this.wss!.on('error', reject);
    });
    
    // Get actual port if 0 was passed
    const address = this.wss.address();
    if (typeof address !== 'string') {
      this.port = address.port;
    }
    
    this.startHeartbeat();
    
    return this.port;
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const url = new URL(req.url || '/', 'http://localhost');
    const providedToken = url.searchParams.get('token');
    
    if (providedToken !== this.token) {
      ws.close(1008, 'Invalid token');
      return;
    }
    
    const client: Client = { ws, isAlive: true, lastPong: Date.now() };
    this.clients.set(ws, client);
    
    ws.on('message', (data) => {
      try {
        const command = JSON.parse(data.toString()) as ClientCommand;
        this.handleCommand(ws, command);
      } catch (err) {
        console.error('Invalid message:', err);
      }
    });
    
    ws.on('pong', () => {
      client.isAlive = true;
      client.lastPong = Date.now();
    });
    
    ws.on('close', () => {
      this.clients.delete(ws);
    });
    
    // Send initial heartbeat
    this.sendToClient(ws, { type: 'heartbeat', timestamp: Date.now() });
  }

  private handleCommand(ws: WebSocket, command: ClientCommand): void {
    switch (command.type) {
      case 'get_messages':
        this.sendToClient(ws, { type: 'messages', messages: this.messages });
        break;
      case 'ping':
        this.sendToClient(ws, { type: 'pong', timestamp: Date.now() });
        break;
      case 'bye':
        ws.close();
        break;
    }
  }

  private sendToClient(ws: WebSocket, event: ServerEvent): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ payload: event }));
    }
  }

  broadcast(event: ServerEvent): void {
    for (const [ws, client] of this.clients) {
      this.sendToClient(ws, event);
    }
  }

  addMessage(message: Message): void {
    this.messages.push(message);
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.broadcast({ type: 'heartbeat', timestamp: Date.now() });
      
      // Check for dead connections (30s timeout)
      const now = Date.now();
      for (const [ws, client] of this.clients) {
        if (now - client.lastPong > 30000) {
          ws.terminate();
          this.clients.delete(ws);
        }
      }
    }, 10000); // Every 10s
  }

  getToken(): string {
    return this.token;
  }

  getPort(): number {
    return this.port;
  }

  async stop(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    for (const [ws] of this.clients) {
      ws.close();
    }
    this.clients.clear();
    
    return new Promise((resolve) => {
      this.wss?.close(resolve);
    });
  }
}
EOF
```

**Step 5: Run test to verify it passes**

```bash
cd plugin && npm test -- server.test.ts
```

Expected: PASS (all 4 tests)

**Step 6: Commit**

```bash
git add plugin/src/server.ts plugin/tests/server.test.ts plugin/jest.config.js
git commit -m "feat: implement WebSocket server with heartbeat"
```

---

### Task 4: Ngrok Integration

**Files:**
- Create: `plugin/src/ngrok.ts`
- Create: `plugin/tests/ngrok.test.ts`

**Step 1: Write failing test (mocked)**

```bash
cat > plugin/tests/ngrok.test.ts << 'EOF'
import { startNgrokTunnel } from '../src/ngrok';

jest.mock('@ngrok/ngrok', () => ({
  connect: jest.fn().mockResolvedValue({
    url: () => 'https://abc123.ngrok-free.app',
    disconnect: jest.fn(),
  }),
}));

describe('Ngrok Integration', () => {
  test('should return public URL for local port', async () => {
    const url = await startNgrokTunnel(8765);
    expect(url).toBe('https://abc123.ngrok-free.app');
  });
});
EOF
```

**Step 2: Run test (should fail)**

```bash
cd plugin && npm test -- ngrok.test.ts 2>&1 | head -20
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```bash
cat > plugin/src/ngrok.ts << 'EOF'
import * as ngrok from '@ngrok/ngrok';

let currentSession: any = null;

export async function startNgrokTunnel(port: number): Promise<string> {
  // Disconnect previous session if exists
  if (currentSession) {
    await currentSession.disconnect();
    currentSession = null;
  }
  
  try {
    currentSession = await ngrok.connect({
      addr: port,
      authtoken_from_env: true,
    });
    
    const url = currentSession.url();
    console.log(`[Walkie-Talkie] Ngrok tunnel: ${url}`);
    return url;
  } catch (err) {
    console.error('[Walkie-Talkie] Failed to start ngrok:', err);
    throw new Error('Failed to create ngrok tunnel. Ensure NGROK_AUTHTOKEN is set.');
  }
}

export async function stopNgrokTunnel(): Promise<void> {
  if (currentSession) {
    await currentSession.disconnect();
    currentSession = null;
    console.log('[Walkie-Talkie] Ngrok tunnel closed');
  }
}

export function getCurrentTunnelUrl(): string | null {
  return currentSession?.url() || null;
}
EOF
```

**Step 4: Run tests**

```bash
cd plugin && npm test -- ngrok.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugin/src/ngrok.ts plugin/tests/ngrok.test.ts
git commit -m "feat: add ngrok tunnel integration"
```

---

### Task 5: QR Code Generator

**Files:**
- Create: `plugin/src/qr.ts`
- Create: `plugin/tests/qr.test.ts`

**Step 1: Write failing test**

```bash
cat > plugin/tests/qr.test.ts << 'EOF'
import { generateQRCode } from '../src/qr';

describe('QR Generator', () => {
  test('should generate QR code string for URL and token', async () => {
    const url = 'https://test.ngrok.io';
    const token = 'abc123';
    
    const qr = await generateQRCode(url, token);
    
    expect(qr).toContain('█'); // QR code contains block characters
    expect(qr).toContain('▀');
  });
});
EOF
```

**Step 2: Run test (should fail)**

```bash
cd plugin && npm test -- qr.test.ts 2>&1 | head -20
```

Expected: FAIL - module not found

**Step 3: Write implementation**

```bash
cat > plugin/src/qr.ts << 'EOF'
import * as QRCode from 'qrcode';

export async function generateQRCode(url: string, token: string): Promise<string> {
  const fullUrl = `${url}?token=${token}`;
  
  try {
    // Generate terminal-friendly QR code
    const qr = await QRCode.toString(fullUrl, {
      type: 'terminal',
      small: true,
    });
    
    return qr;
  } catch (err) {
    console.error('[Walkie-Talkie] Failed to generate QR:', err);
    // Fallback: just return the URL
    return `Scan this URL:\n${fullUrl}`;
  }
}

export function displayQRCode(qr: string): void {
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  📱 Scan with Walkie-Talkie PWA    │');
  console.log('└─────────────────────────────────────┘');
  console.log(qr);
  console.log('');
}
EOF
```

**Step 4: Run tests**

```bash
cd plugin && npm test -- qr.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add plugin/src/qr.ts plugin/tests/qr.test.ts
git commit -m "feat: add QR code generator for connection"
```

---

### Task 6: OpenCode Plugin Entry Point

**Files:**
- Create: `plugin/src/index.ts`
- Create: `plugin/opencode.json`

**Step 1: Create opencode.json**

```bash
cat > plugin/opencode.json << 'EOF'
{
  "name": "walkie-talkie",
  "entry": "dist/index.js"
}
EOF
```

**Step 2: Write plugin implementation**

```bash
cat > plugin/src/index.ts << 'EOF'
import { WalkieServer } from './server';
import { startNgrokTunnel, stopNgrokTunnel } from './ngrok';
import { generateQRCode, displayQRCode } from './qr';
import type { Message } from './protocol';

// Store server instance for cleanup
let server: WalkieServer | null = null;
let isInitialized = false;

export const WalkieTalkiePlugin = async ({ client, project }: any) => {
  if (isInitialized) {
    console.log('[Walkie-Talkie] Already initialized');
    return {};
  }

  // Initialize server
  server = new WalkieServer();
  
  try {
    const port = await server.start(0); // Random available port
    console.log(`[Walkie-Talkie] WebSocket server started on port ${port}`);
    
    // Start ngrok tunnel
    const publicUrl = await startNgrokTunnel(port);
    const token = server.getToken();
    
    // Generate and display QR
    const qr = await generateQRCode(publicUrl, token);
    displayQRCode(qr);
    
    isInitialized = true;
    
    // Log info
    await client.app.log({
      body: {
        service: 'walkie-talkie',
        level: 'info',
        message: 'Walkie-Talkie plugin initialized',
        extra: { url: publicUrl },
      },
    });
  } catch (err) {
    console.error('[Walkie-Talkie] Initialization failed:', err);
    await client.app.log({
      body: {
        service: 'walkie-talkie',
        level: 'error',
        message: 'Failed to initialize Walkie-Talkie',
        extra: { error: String(err) },
      },
    });
    return {};
  }

  // Cleanup on process exit
  process.on('SIGINT', async () => {
    if (server) {
      await server.stop();
      await stopNgrokTunnel();
    }
    process.exit(0);
  });

  return {
    // Hook: LLM finished responding
    'session.idle': async (event: any) => {
      if (server) {
        server.broadcast({
          type: 'end',
          timestamp: Date.now(),
        });
      }
    },

    // Hook: New message received
    'message.updated': async (event: any) => {
      if (!server) return;
      
      // Check if this is a new message
      if (event.message && !event.isUpdate) {
        const message: Message = {
          id: event.message.id || String(Date.now()),
          role: event.message.role,
          content: event.message.content,
          timestamp: Date.now(),
        };
        
        server.addMessage(message);
        server.broadcast({
          type: 'new_message',
          message,
        });
      }
    },

    // Hook: Session awaiting input
    'session.status': async (event: any) => {
      if (server && event.status === 'awaiting_input') {
        server.broadcast({
          type: 'awaiting_input',
          prompt: event.prompt,
        });
      }
    },
  };
};

export default WalkieTalkiePlugin;
EOF
```

**Step 3: Build and test**

```bash
cd plugin && npm run build
```

Expected: Compiled successfully (no errors)

**Step 4: Commit**

```bash
git add plugin/src/index.ts plugin/opencode.json
git commit -m "feat: add OpenCode plugin entry point with hooks"
```

---

### Task 7: PWA WebSocket Client

**Files:**
- Create: `pwa/src/ws-client.js`
- Test: Manual browser test

**Step 1: Write WebSocket client**

```bash
cat > pwa/src/ws-client.js << 'EOF'
class WalkieClient {
  constructor() {
    this.ws = null;
    this.url = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 60000;
    this.heartbeatTimeout = null;
    this.lastHeartbeat = 0;
    this.listeners = new Map();
  }

  connect(url, token) {
    this.url = url;
    this.token = token;
    this.reconnectAttempts = 0;
    this._connect();
  }

  _connect() {
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = this.url.replace(/^http/, 'ws') + `?token=${this.token}`;
    console.log('[Walkie] Connecting to:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Walkie] Connected');
      this.reconnectAttempts = 0;
      this._emit('connected', {});
      this._startHeartbeatMonitor();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data.payload);
      } catch (err) {
        console.error('[Walkie] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[Walkie] Disconnected');
      this._emit('disconnected', {});
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Walkie] WebSocket error:', err);
      this._emit('error', { error: err });
    };
  }

  _handleMessage(payload) {
    // Update last heartbeat time
    if (payload.type === 'heartbeat' || payload.type === 'pong') {
      this.lastHeartbeat = Date.now();
    }

    this._emit(payload.type, payload);
  }

  _startHeartbeatMonitor() {
    // Check heartbeat every 10 seconds
    const checkInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearInterval(checkInterval);
        return;
      }

      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

      // If no heartbeat for 10s, send ping
      if (timeSinceLastHeartbeat > 10000) {
        this.send({ type: 'ping' });
      }

      // If no heartbeat for 30s, connection is dead
      if (timeSinceLastHeartbeat > 30000) {
        console.log('[Walkie] Heartbeat timeout, reconnecting...');
        this.ws.close();
        clearInterval(checkInterval);
      }
    }, 1000);
  }

  _scheduleReconnect() {
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[Walkie] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this._connect();
    }, delay);
  }

  send(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('[Walkie] Cannot send, not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.send({ type: 'bye' });
      this.ws.close();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  requestMessages() {
    this.send({ type: 'get_messages' });
  }
}

// Create global instance
const walkieClient = new WalkieClient();
EOF
```

**Step 2: Commit**

```bash
git add pwa/src/ws-client.js
git commit -m "feat: add PWA WebSocket client with reconnection"
```

---

### Task 8: PWA QR Scanner

**Files:**
- Create: `pwa/src/qr-scanner.js`

**Step 1: Write QR scanner**

```bash
cat > pwa/src/qr-scanner.js << 'EOF'
class QRScanner {
  constructor(containerId, onScan) {
    this.containerId = containerId;
    this.onScan = onScan;
    this.html5QrCode = null;
    this.isScanning = false;
  }

  async start() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('[QRScanner] Container not found:', this.containerId);
      return;
    }

    this.html5QrCode = new Html5Qrcode(this.containerId);

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          this._onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors (no QR in frame)
        }
      );

      this.isScanning = true;
      console.log('[QRScanner] Started');
    } catch (err) {
      console.error('[QRScanner] Failed to start:', err);
      this._showPermissionError();
    }
  }

  _onScanSuccess(decodedText) {
    console.log('[QRScanner] QR Code detected:', decodedText);
    
    // Parse URL and token
    try {
      const url = new URL(decodedText);
      const token = url.searchParams.get('token');
      
      if (!token) {
        console.error('[QRScanner] No token in QR code');
        return;
      }

      // Stop scanning
      this.stop();

      // Call callback
      this.onScan({
        url: decodedText.split('?')[0],
        token: token,
      });
    } catch (err) {
      console.error('[QRScanner] Invalid QR code format:', err);
    }
  }

  _showPermissionError() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = `
        <div class="qr-error">
          <p>Camera access denied. Please:</p>
          <ol>
            <li>Allow camera access in your browser</li>
            <li>Or enter URL manually:</li>
          </ol>
          <input type="text" id="manual-url" placeholder="wss://xxx.ngrok.io?token=...">
          <button id="manual-connect">Connect</button>
        </div>
      `;

      document.getElementById('manual-connect').addEventListener('click', () => {
        const input = document.getElementById('manual-url');
        this._onScanSuccess(input.value);
      });
    }
  }

  async stop() {
    if (this.html5QrCode && this.isScanning) {
      await this.html5QrCode.stop();
      this.isScanning = false;
      console.log('[QRScanner] Stopped');
    }
  }
}
EOF
```

**Step 2: Commit**

```bash
git add pwa/src/qr-scanner.js
git commit -m "feat: add PWA QR scanner with html5-qrcode"
```

---

### Task 9: PWA UI Components

**Files:**
- Create: `pwa/src/ui.js`
- Create: `pwa/src/styles.css`

**Step 1: Write UI module**

```bash
cat > pwa/src/ui.js << 'EOF'
class WalkieUI {
  constructor() {
    this.statusEl = document.getElementById('connection-status');
    this.messagesEl = document.getElementById('messages');
    this.scannerContainer = document.getElementById('scanner-container');
    this.currentStatus = 'disconnected';
  }

  setStatus(status, message = '') {
    this.currentStatus = status;
    
    const statusIcons = {
      disconnected: '⚪',
      connecting: '🟡',
      connected: '🟢',
      error: '🔴',
      working: '🔄',
      done: '✓',
    };

    const icon = statusIcons[status] || '⚪';
    this.statusEl.textContent = `${icon} ${message || status}`;
    this.statusEl.className = `status-${status}`;
  }

  hideScanner() {
    if (this.scannerContainer) {
      this.scannerContainer.style.display = 'none';
    }
  }

  showScanner() {
    if (this.scannerContainer) {
      this.scannerContainer.style.display = 'block';
    }
  }

  addMessage(message) {
    if (!this.messagesEl) return;

    const msgEl = document.createElement('div');
    msgEl.className = `message message-${message.role}`;
    msgEl.innerHTML = `
      <div class="message-header">${message.role}</div>
      <div class="message-content">${this._escapeHtml(message.content)}</div>
      <div class="message-time">${this._formatTime(message.timestamp)}</div>
    `;

    this.messagesEl.appendChild(msgEl);
    this.scrollToBottom();
  }

  clearMessages() {
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
    }
  }

  renderMessages(messages) {
    this.clearMessages();
    messages.forEach(msg => this.addMessage(msg));
  }

  scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
EOF
```

**Step 2: Write CSS**

```bash
cat > pwa/src/styles.css << 'EOF'
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: #f5f5f5;
  color: #333;
  line-height: 1.6;
  padding: 20px;
}

#app {
  max-width: 600px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  overflow: hidden;
}

h1 {
  padding: 20px;
  background: #000;
  color: white;
  font-size: 1.2rem;
  text-align: center;
}

#connection-status {
  padding: 12px 20px;
  background: #f0f0f0;
  border-bottom: 1px solid #ddd;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-disconnected { color: #999; }
.status-connecting { color: #f0a500; }
.status-connected { color: #28a745; }
.status-error { color: #dc3545; }
.status-working { animation: pulse 1s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

#scanner-container {
  padding: 20px;
  background: #fafafa;
  border-bottom: 1px solid #ddd;
}

#qr-reader {
  width: 100% !important;
  border: none !important;
}

.qr-error {
  padding: 20px;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 8px;
  text-align: center;
}

.qr-error input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.qr-error button {
  background: #000;
  color: white;
  border: none;
  padding: 10px 20px;
  border-radius: 4px;
  cursor: pointer;
}

#messages {
  max-height: 400px;
  overflow-y: auto;
  padding: 20px;
}

.message {
  margin-bottom: 16px;
  padding: 12px;
  border-radius: 12px;
  max-width: 80%;
}

.message-user {
  background: #007bff;
  color: white;
  margin-left: auto;
  border-bottom-right-radius: 4px;
}

.message-assistant {
  background: #f0f0f0;
  color: #333;
  margin-right: auto;
  border-bottom-left-radius: 4px;
}

.message-header {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  opacity: 0.7;
  margin-bottom: 4px;
}

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
}

.message-time {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-top: 4px;
  text-align: right;
}
EOF
```

**Step 3: Commit**

```bash
git add pwa/src/ui.js pwa/src/styles.css
git commit -m "feat: add PWA UI components and styling"
```

---

### Task 10: PWA Main App

**Files:**
- Modify: `pwa/src/app.js`

**Step 1: Write main app logic**

```bash
cat > pwa/src/app.js << 'EOF'
// Main application logic
class WalkieApp {
  constructor() {
    this.ui = new WalkieUI();
    this.scanner = null;
    this.isWorking = false;
  }

  init() {
    console.log('[App] Initializing Walkie-Talkie...');
    
    // Setup event listeners
    this._setupClientListeners();
    
    // Start QR scanner
    this._startScanner();
  }

  _setupClientListeners() {
    // Connection events
    walkieClient.on('connected', () => {
      console.log('[App] Connected to plugin');
      this.ui.setStatus('connected', 'Connected');
      this.ui.hideScanner();
      
      // Request message history
      walkieClient.requestMessages();
    });

    walkieClient.on('disconnected', () => {
      console.log('[App] Disconnected');
      this.ui.setStatus('disconnected', 'Disconnected - reconnecting...');
      this.isWorking = false;
    });

    walkieClient.on('error', (data) => {
      console.error('[App] Connection error:', data);
      this.ui.setStatus('error', 'Connection error');
    });

    // Data events
    walkieClient.on('heartbeat', () => {
      // Heartbeat received, connection is alive
      if (this.isWorking) {
        this.ui.setStatus('working', 'LLM is working...');
      }
    });

    walkieClient.on('new_message', (data) => {
      console.log('[App] New message:', data);
      this.ui.addMessage(data.message);
      this.isWorking = true;
      this.ui.setStatus('working', 'LLM is working...');
    });

    walkieClient.on('end', () => {
      console.log('[App] LLM finished');
      this.isWorking = false;
      this.ui.setStatus('connected', 'Done ✓');
      
      // Play notification sound (optional)
      this._playNotificationSound();
    });

    walkieClient.on('messages', (data) => {
      console.log('[App] Received messages:', data);
      this.ui.renderMessages(data.messages);
    });

    walkieClient.on('awaiting_input', () => {
      console.log('[App] Awaiting input');
      this.ui.setStatus('connected', 'Waiting for your input');
      this._showInputDialog();
    });
  }

  _startScanner() {
    this.ui.setStatus('connecting', 'Scan QR code to connect');
    
    this.scanner = new QRScanner('qr-reader', (result) => {
      console.log('[App] QR scanned:', result);
      walkieClient.connect(result.url, result.token);
    });

    this.scanner.start();
  }

  _playNotificationSound() {
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn('[App] Could not play sound:', err);
    }
  }

  _showInputDialog() {
    // Simple prompt for now
    // In production, you'd show a proper input UI
    const input = prompt('LLM is waiting for your response:');
    if (input) {
      walkieClient.send({
        type: 'send_message',
        content: input,
      });
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new WalkieApp();
  app.init();
});

// Register service worker (minimal)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('[App] Service Worker registered'))
    .catch(err => console.log('[App] Service Worker registration failed:', err));
}
EOF
```

**Step 2: Write minimal service worker**

```bash
cat > pwa/sw.js << 'EOF'
// Minimal service worker for PWA
const CACHE_NAME = 'walkie-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/src/app.js',
  '/src/ws-client.js',
  '/src/qr-scanner.js',
  '/src/ui.js',
  '/src/styles.css',
  'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});
EOF
```

**Step 3: Commit**

```bash
git add pwa/src/app.js pwa/sw.js
git commit -m "feat: add PWA main application logic"
```

---

### Task 11: Build Plugin

**Files:**
- Build: `plugin/dist/`

**Step 1: Compile TypeScript**

```bash
cd plugin && npm run build
```

Expected: Compiled successfully, `dist/` directory created

**Step 2: Verify build output**

```bash
ls -la plugin/dist/
```

Expected: `index.js`, `server.js`, `ngrok.js`, `qr.js`, `protocol.js`, and `.d.ts` files

**Step 3: Commit**

```bash
git add plugin/dist/
git commit -m "build: compile plugin TypeScript"
```

---

### Task 12: Integration Test

**Step 1: Manual test script**

Create a simple test to verify plugin starts:

```bash
cat > plugin/test-manual.js << 'EOF'
// Manual test - run with: node test-manual.js
const { WalkieServer } = require('./dist/server');
const { startNgrokTunnel } = require('./dist/ngrok');
const { generateQRCode, displayQRCode } = require('./dist/qr');

async function test() {
  console.log('[Test] Starting manual integration test...\n');

  // 1. Start WebSocket server
  const server = new WalkieServer();
  const port = await server.start(8765);
  console.log(`[Test] Server started on port ${port}`);
  console.log(`[Test] Token: ${server.getToken()}`);

  // 2. Start ngrok tunnel
  try {
    const url = await startNgrokTunnel(port);
    console.log(`[Test] Ngrok URL: ${url}`);

    // 3. Generate QR
    const qr = await generateQRCode(url, server.getToken());
    displayQRCode(qr);

    console.log('[Test] Test running. Press Ctrl+C to stop.');
    console.log('[Test] Try connecting from browser to test PWA.\n');
  } catch (err) {
    console.error('[Test] Error:', err.message);
    console.log('[Test] Make sure NGROK_AUTHTOKEN is set in environment');
    process.exit(1);
  }

  // Keep running
  process.on('SIGINT', async () => {
    console.log('\n[Test] Stopping...');
    await server.stop();
    process.exit(0);
  });
}

test();
EOF
```

**Step 2: Run manual test**

```bash
cd plugin && node test-manual.js
```

Expected: Server starts, ngrok connects, QR code displays in terminal

**Step 3: Cleanup and commit**

```bash
rm plugin/test-manual.js
git add .
git commit -m "test: add integration test setup"
```

---

### Task 13: Documentation

**Files:**
- Create: `README.md` (updated)
- Create: `CONTRIBUTING.md`

**Step 1: Update README**

```bash
cat > README.md << 'EOF'
# OpenCode Walkie-Talkie

📱 Get mobile notifications when your AI assistant needs you.

Walkie-Talkie is a plugin for OpenCode that sends real-time notifications to your phone or tablet when:
- LLM finishes generating a response
- LLM is waiting for your input

## Quick Start

### 1. Install the Plugin

```bash
cd plugin
npm install
npm run build
npm link
```

Add to your `opencode.json`:
```json
{
  "plugins": ["@crazy-goat/opencode-walkie-talkie"]
}
```

### 2. Setup ngrok

```bash
npm install -g ngrok
ngrok config add-authtoken <your_token>
```

### 3. Start OpenCode

When you start OpenCode, the plugin will:
1. Start a WebSocket server
2. Create an ngrok tunnel
3. Display a QR code in your terminal

### 4. Scan QR with Your Phone

1. Open the PWA URL (or host it locally)
2. Allow camera access
3. Scan the QR code displayed in OpenCode terminal
4. You're connected!

## Using the PWA

### Option A: Local Development

```bash
cd pwa
# Serve with any static server
npx serve .
# Or
python3 -m http.server 8080
```

Open `http://localhost:8080` on your phone.

### Option B: Deploy

Deploy `pwa/` folder to any static hosting:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## Architecture

```
OpenCode (plugin)  ←──WebSocket──→  PWA (phone/tablet)
      ↓
   ngrok tunnel (public URL)
```

## Protocol

WebSocket events:
- `heartbeat` (every 10s)
- `new_message` (when LLM sends content)
- `end` (when LLM finishes)
- `messages` (message history)

## Development

### Plugin

```bash
cd plugin
npm install
npm run dev    # Watch mode
npm test       # Run tests
```

### PWA

```bash
cd pwa
# Serve locally
npx serve .
```

## Troubleshooting

**QR code not displaying?**
- Make sure ngrok authtoken is configured
- Check that port 8765 is not in use

**Cannot connect from phone?**
- Ensure your phone is on the same network (for local testing)
- Check that ngrok tunnel is active

**Connection drops?**
- Normal for ngrok free tier (1 hour limit)
- Restart OpenCode to get new QR code

## License

MIT
EOF
```

**Step 2: Create CONTRIBUTING**

```bash
cat > CONTRIBUTING.md << 'EOF'
# Contributing to OpenCode Walkie-Talkie

## Development Setup

1. Fork and clone the repo
2. Install dependencies in `plugin/`
3. Build: `npm run build`
4. Test: `npm test`

## Pull Request Process

1. Create a feature branch
2. Make changes with tests
3. Ensure all tests pass
4. Update documentation
5. Submit PR

## Code Style

- TypeScript for plugin
- Vanilla JS for PWA
- DRY, YAGNI principles
- TDD approach
EOF
```

**Step 3: Final commit**

```bash
git add README.md CONTRIBUTING.md
git commit -m "docs: update README and add CONTRIBUTING guide"
```

---

## Summary

**Implementation complete!**

Created:
- ✅ OpenCode plugin with WebSocket server
- ✅ ngrok tunnel integration
- ✅ QR code generation
- ✅ PWA with QR scanner
- ✅ WebSocket client with reconnection
- ✅ Real-time notifications
- ✅ Message history

**Next steps:**
1. Test end-to-end manually
2. Publish to npm (plugin)
3. Deploy PWA to hosting
4. Gather feedback
5. Iterate

**Plan saved to:** `docs/plans/2025-03-17-implementation-plan.md`

---

## Execution Choice

**Plan complete and saved. Two execution options:**

**1. Subagent-Driven (this session)** - Dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach do you prefer?**
