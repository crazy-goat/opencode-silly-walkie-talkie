// WebSocket Protocol Types for OpenCode Walkie-Talkie

export type EventType = 'heartbeat' | 'new_message' | 'end' | 'messages' | 'awaiting_input' | 'pong' | 'question' | 'tool_update';
export type CommandType = 'get_messages' | 'ping' | 'bye' | 'send_message' | 'answer_question';

export interface ToolCall {
  name: string;
  input?: Record<string, any>;
  output?: string;
}

export interface FileDiff {
  file: string;
  before: string;
  after: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tools?: ToolCall[];
  diffs?: FileDiff[];
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

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionInfoPayload {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionEvent {
  type: 'question';
  requestID: string;
  questions: QuestionInfoPayload[];
}

export interface ToolUpdateEvent {
  type: 'tool_update';
  tool: ToolCall;
}

export type ServerEvent = 
  | HeartbeatEvent 
  | NewMessageEvent 
  | EndEvent 
  | MessagesEvent 
  | AwaitingInputEvent
  | PongEvent
  | QuestionEvent
  | ToolUpdateEvent;

// Commands: Client -> Server
export interface GetMessagesCommand {
  type: 'get_messages';
  after?: string;
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

export interface AnswerQuestionCommand {
  type: 'answer_question';
  requestID: string;
  answers: string[][];
}

export type ClientCommand = 
  | GetMessagesCommand 
  | PingCommand 
  | ByeCommand
  | SendMessageCommand
  | AnswerQuestionCommand;

// WebSocket message wrapper
export interface WebSocketMessage {
  id?: string;
  payload: ServerEvent | ClientCommand;
}
