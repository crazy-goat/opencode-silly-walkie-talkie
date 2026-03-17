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
