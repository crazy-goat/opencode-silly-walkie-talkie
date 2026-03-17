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
exports.startNgrokTunnel = startNgrokTunnel;
exports.stopNgrokTunnel = stopNgrokTunnel;
exports.getCurrentTunnelUrl = getCurrentTunnelUrl;
const ngrok = __importStar(require("@ngrok/ngrok"));
let currentSession = null;
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
async function stopNgrokTunnel() {
    if (currentSession) {
        await currentSession.disconnect();
        currentSession = null;
        console.log('[Walkie-Talkie] Ngrok tunnel closed');
    }
}
function getCurrentTunnelUrl() {
    return currentSession?.url() || null;
}
//# sourceMappingURL=ngrok.js.map