import * as ngrok from '@ngrok/ngrok';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const execAsync = promisify(exec);

let currentSession: any = null;
let zrokProcess: any = null;

export type TunnelProvider = 'ngrok' | 'zrok';

export interface TunnelConfig {
  provider: TunnelProvider;
  zrokApiUrl?: string;  // https://api.zrok.twojadomena.pl
  zrokToken?: string;
}

export async function startTunnel(port: number, config?: TunnelConfig): Promise<string> {
  const provider = config?.provider || (process.env.WALKIE_TUNNEL_PROVIDER as TunnelProvider) || 'ngrok';
  
  if (provider === 'zrok' || process.env.ZROK_TOKEN) {
    return startZrokTunnel(port, config);
  }
  
  return startNgrokTunnel(port);
}

async function startNgrokTunnel(port: number): Promise<string> {
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

async function startZrokTunnel(port: number, config?: TunnelConfig): Promise<string> {
  const zrokApiUrl = config?.zrokApiUrl || process.env.ZROK_API_URL || 'https://zrok.io';
  const zrokToken = config?.zrokToken || process.env.ZROK_TOKEN;
  
  if (!zrokToken) {
    throw new Error('ZROK_TOKEN not set. Get token from your zrok controller.');
  }
  
  // Check if zrok CLI is installed
  try {
    await execAsync('zrok version');
  } catch {
    throw new Error('zrok CLI not found. Install: https://github.com/openziti/zrok');
  }
  
  // Enable zrok environment
  try {
    await execAsync(`zrok enable ${zrokToken} --api-url ${zrokApiUrl}`);
  } catch (err) {
    // Might already be enabled
    console.log('[Walkie-Talkie] zrok environment already enabled or error:', err);
  }
  
  // Share the port
  return new Promise((resolve, reject) => {
    const zrokCmd = spawn('zrok', ['share', 'public', `localhost:${port}`, '--headless'], {
      detached: false,
    });
    
    zrokProcess = zrokCmd;
    
    let output = '';
    zrokCmd.stdout.on('data', (data) => {
      output += data.toString();
      
      // Parse zrok output to find URL
      // Example: "access your zrok share at: https://xyz.zrok.io"
      const match = output.match(/https:\/\/[a-zA-Z0-9\-\.]+\.zrok\.[a-z]+/);
      if (match) {
        const url = match[0];
        console.log(`[Walkie-Talkie] zrok tunnel: ${url}`);
        resolve(url);
      }
    });
    
    zrokCmd.stderr.on('data', (data) => {
      console.error('[Walkie-Talkie] zrok error:', data.toString());
    });
    
    zrokCmd.on('error', (err) => {
      reject(new Error(`Failed to start zrok: ${err.message}`));
    });
    
    zrokCmd.on('close', (code) => {
      if (code !== 0 && code !== null) {
        console.log(`[Walkie-Talkie] zrok process exited with code ${code}`);
      }
    });
  });
}

export async function stopTunnel(): Promise<void> {
  // Stop ngrok if active
  if (currentSession) {
    await currentSession.disconnect();
    currentSession = null;
    console.log('[Walkie-Talkie] Ngrok tunnel closed');
  }
  
  // Stop zrok if active
  if (zrokProcess) {
    zrokProcess.kill();
    zrokProcess = null;
    
    try {
      await execAsync('zrok disable');
    } catch {
      // Ignore errors
    }
    
    console.log('[Walkie-Talkie] zrok tunnel closed');
  }
}

export function getCurrentTunnelUrl(): string | null {
  return currentSession?.url() || null;
}

// Backwards compatibility
export { startNgrokTunnel, stopTunnel as stopNgrokTunnel };
