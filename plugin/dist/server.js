"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalkieServer = void 0;
const ws_1 = require("ws");
const uuid_1 = require("uuid");
class WalkieServer {
    wss = null;
    token = '';
    clients = new Map();
    heartbeatInterval = null;
    messages = [];
    port = 0;
    nextConnectionCallback = null;
    async start(port = 0) {
        this.port = port;
        this.token = (0, uuid_1.v4)();
        this.wss = new ws_1.WebSocketServer({ port: this.port });
        this.wss.on('listening', () => this.wss._server?.unref());
        this.wss.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });
        // Wait for server to start
        await new Promise((resolve, reject) => {
            this.wss.on('listening', resolve);
            this.wss.on('error', reject);
        });
        // Get actual port if 0 was passed
        const address = this.wss.address();
        if (address && typeof address !== 'string') {
            this.port = address.port;
        }
        this.startHeartbeat();
        return this.port;
    }
    handleConnection(ws, req) {
        const url = new URL(req.url || '/', 'http://localhost');
        const providedToken = url.searchParams.get('token');
        if (providedToken !== this.token) {
            ws.close(1008, 'Invalid token');
            return;
        }
        const client = { ws, isAlive: true, lastPong: Date.now() };
        this.clients.set(ws, client);
        if (this.nextConnectionCallback) {
            const cb = this.nextConnectionCallback;
            this.nextConnectionCallback = null;
            cb();
        }
        ws.on('message', (data) => {
            try {
                const command = JSON.parse(data.toString());
                this.handleCommand(ws, command);
            }
            catch (err) {
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
    handleCommand(ws, command) {
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
    sendToClient(ws, event) {
        if (ws.readyState === ws_1.WebSocket.OPEN) {
            ws.send(JSON.stringify({ payload: event }));
        }
    }
    broadcast(event) {
        for (const [ws, client] of this.clients) {
            this.sendToClient(ws, event);
        }
    }
    addMessage(message) {
        this.messages.push(message);
    }
    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.heartbeatInterval?.unref();
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
    onNextConnection(cb) {
        this.nextConnectionCallback = cb;
    }
    getToken() {
        return this.token;
    }
    getPort() {
        return this.port;
    }
    async stop() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
        for (const [ws] of this.clients) {
            ws.close();
        }
        this.clients.clear();
        return new Promise((resolve) => {
            this.wss?.close(() => resolve());
        });
    }
}
exports.WalkieServer = WalkieServer;
//# sourceMappingURL=server.js.map