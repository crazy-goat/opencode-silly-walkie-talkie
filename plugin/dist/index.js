"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalkieTalkiePlugin = void 0;
const server_1 = require("./server");
const tunnel_1 = require("./tunnel");
const qr_1 = require("./qr");
// Store server instance for cleanup
let server = null;
let isInitialized = false;
const WalkieTalkiePlugin = async ({ client, project }) => {
    if (isInitialized) {
        console.log('[Walkie-Talkie] Already initialized');
        return {};
    }
    // Initialize server
    server = new server_1.WalkieServer();
    try {
        const port = await server.start(0); // Random available port
        console.log(`[Walkie-Talkie] WebSocket server started on port ${port}`);
        // Start tunnel (ngrok or zrok)
        const publicUrl = await (0, tunnel_1.startTunnel)(port);
        const token = server.getToken();
        // Generate and display QR
        const qr = await (0, qr_1.generateQRCode)(publicUrl, token);
        (0, qr_1.displayQRCode)(qr);
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
    }
    catch (err) {
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
            await (0, tunnel_1.stopTunnel)();
        }
        process.exit(0);
    });
    return {
        // Hook: LLM finished responding
        'session.idle': async (event) => {
            if (server) {
                server.broadcast({
                    type: 'end',
                    timestamp: Date.now(),
                });
            }
        },
        // Hook: New message received
        'message.updated': async (event) => {
            if (!server)
                return;
            // Check if this is a new message
            if (event.message && !event.isUpdate) {
                const message = {
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
        'session.status': async (event) => {
            if (server && event.status === 'awaiting_input') {
                server.broadcast({
                    type: 'awaiting_input',
                    prompt: event.prompt,
                });
            }
        },
    };
};
exports.WalkieTalkiePlugin = WalkieTalkiePlugin;
exports.default = exports.WalkieTalkiePlugin;
//# sourceMappingURL=index.js.map