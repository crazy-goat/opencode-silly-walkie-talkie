export type EventType = 'heartbeat' | 'new_message' | 'end' | 'messages' | 'awaiting_input' | 'pong';
export type CommandType = 'get_messages' | 'ping' | 'bye' | 'send_message';
export interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}
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
export type ServerEvent = HeartbeatEvent | NewMessageEvent | EndEvent | MessagesEvent | AwaitingInputEvent | PongEvent;
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
export type ClientCommand = GetMessagesCommand | PingCommand | ByeCommand | SendMessageCommand;
export interface WebSocketMessage {
    id?: string;
    payload: ServerEvent | ClientCommand;
}
//# sourceMappingURL=protocol.d.ts.map