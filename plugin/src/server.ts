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
    if (address && typeof address !== 'string') {
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
    
    return new Promise<void>((resolve) => {
      this.wss?.close(() => resolve());
    });
  }
}
