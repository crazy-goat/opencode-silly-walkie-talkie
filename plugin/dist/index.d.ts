export declare const WalkieTalkiePlugin: ({ client }: any) => Promise<{
    'command.execute.before': (input: any, output: any) => Promise<void>;
    'session.idle': () => Promise<void>;
    'message.updated': (event: any) => Promise<void>;
    'session.status': (event: any) => Promise<void>;
}>;
export default WalkieTalkiePlugin;
//# sourceMappingURL=index.d.ts.map