import type { ServerEvent, Message } from './protocol';
export declare class WalkieServer {
    private wss;
    private token;
    private clients;
    private heartbeatInterval;
    private messages;
    private port;
    start(port?: number): Promise<number>;
    private handleConnection;
    private handleCommand;
    private sendToClient;
    broadcast(event: ServerEvent): void;
    addMessage(message: Message): void;
    private startHeartbeat;
    getToken(): string;
    getPort(): number;
    stop(): Promise<void>;
}
//# sourceMappingURL=server.d.ts.map