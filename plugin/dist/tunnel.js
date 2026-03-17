"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.startTunnel = startTunnel;
exports.stopTunnel = stopTunnel;
exports.stopNgrokTunnel = stopTunnel;
exports.getCurrentTunnelUrl = getCurrentTunnelUrl;
exports.startNgrokTunnel = startNgrokTunnel;
const ngrok = __importStar(require("@ngrok/ngrok"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let currentSession = null;
let zrokProcess = null;
async function startTunnel(port, config) {
    const provider = config?.provider || process.env.WALKIE_TUNNEL_PROVIDER || 'ngrok';
    if (provider === 'zrok' || process.env.ZROK_TOKEN) {
        return startZrokTunnel(port, config);
    }
    return startNgrokTunnel(port);
}
async function startNgrokTunnel(port) {
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
    }
    catch (err) {
        console.error('[Walkie-Talkie] Failed to start ngrok:', err);
        throw new Error('Failed to create ngrok tunnel. Ensure NGROK_AUTHTOKEN is set.');
    }
}
async function startZrokTunnel(port, config) {
    const zrokApiUrl = config?.zrokApiUrl || process.env.ZROK_API_URL || 'https://zrok.io';
    const zrokToken = config?.zrokToken || process.env.ZROK_TOKEN;
    if (!zrokToken) {
        throw new Error('ZROK_TOKEN not set. Get token from your zrok controller.');
    }
    // Check if zrok CLI is installed
    try {
        await execAsync('zrok version');
    }
    catch {
        throw new Error('zrok CLI not found. Install: https://github.com/openziti/zrok');
    }
    // Enable zrok environment
    try {
        await execAsync(`zrok enable ${zrokToken} --api-url ${zrokApiUrl}`);
    }
    catch (err) {
        // Might already be enabled
        console.log('[Walkie-Talkie] zrok environment already enabled or error:', err);
    }
    // Share the port
    return new Promise((resolve, reject) => {
        const zrokCmd = (0, child_process_1.spawn)('zrok', ['share', 'public', `localhost:${port}`, '--headless'], {
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
async function stopTunnel() {
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
        }
        catch {
            // Ignore errors
        }
        console.log('[Walkie-Talkie] zrok tunnel closed');
    }
}
function getCurrentTunnelUrl() {
    return currentSession?.url() || null;
}
//# sourceMappingURL=tunnel.js.map