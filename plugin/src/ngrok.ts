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
