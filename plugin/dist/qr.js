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
exports.generateQRCode = generateQRCode;
exports.openQRInBrowser = openQRInBrowser;
exports.displayQRCode = displayQRCode;
const QRCode = __importStar(require("qrcode"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
async function generateQRCode(url, token) {
    const fullUrl = `${url}?token=${token}`;
    try {
        return await QRCode.toString(fullUrl, { type: 'terminal', small: true });
    }
    catch (err) {
        return `Scan this URL:\n${fullUrl}`;
    }
}
async function openQRInBrowser(url, token) {
    const fullUrl = `${url}?token=${token}`;
    const dataUrl = await QRCode.toDataURL(fullUrl);
    const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Walkie-Talkie QR</title>
<style>body{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#111;color:#fff;}img{width:300px;height:300px;}p{margin-top:16px;font-size:14px;opacity:.6;}a{color:#7cf;}</style>
</head>
<body>
<img src="${dataUrl}" />
<p>Scan with Walkie-Talkie PWA</p>
<p><a href="${fullUrl}">${fullUrl}</a></p>
</body>
</html>`;
    const tmpFile = path.join(os.tmpdir(), 'walkie-talkie-qr.html');
    fs.writeFileSync(tmpFile, html);
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    (0, child_process_1.exec)(`${opener} ${tmpFile}`);
}
function displayQRCode(qr) {
    console.log('\n┌─────────────────────────────────────┐');
    console.log('│  Scan with Walkie-Talkie PWA       │');
    console.log('└─────────────────────────────────────┘');
    console.log(qr);
}
//# sourceMappingURL=qr.js.map