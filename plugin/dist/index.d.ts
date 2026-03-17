export declare const WalkieTalkiePlugin: ({ client, project }: any) => Promise<{
    'session.idle'?: undefined;
    'message.updated'?: undefined;
    'session.status'?: undefined;
} | {
    'session.idle': (event: any) => Promise<void>;
    'message.updated': (event: any) => Promise<void>;
    'session.status': (event: any) => Promise<void>;
}>;
export default WalkieTalkiePlugin;
//# sourceMappingURL=index.d.ts.map