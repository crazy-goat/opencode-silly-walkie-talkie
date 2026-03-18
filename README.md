# OpenCode Walkie-Talkie

A plugin for OpenCode that lets you monitor and interact with your AI sessions from a browser or phone in real time — see messages as they stream and send responses without being at your keyboard.

## How It Works

```
OpenCode (plugin)  ←──WebSocket──→  Web UI (browser, multi-session)
OpenCode (plugin)  ←──WebSocket──→  PWA (phone/tablet, QR scan)
```

The plugin starts a WebSocket server when OpenCode launches. You connect to it from the Web UI or PWA using the URL shown in the terminal.

## Quick Start

### 1. Install the Plugin

```bash
cd plugin
npm install
npm run build
```

This builds the plugin and copies it to `.opencode/plugins/walkie-talkie.js` automatically.

Add to your `opencode.json`:
```json
{
  "plugins": ["walkie-talkie"]
}
```

### 2. Trust the TLS Certificate (one-time)

The plugin auto-generates a self-signed certificate on first start. You need to trust it so your browser can connect.

**First, start OpenCode once** to generate the certificate:
```
~/.config/opencode/walkie-tls/cert.pem
```

Then trust it:

**macOS:**
```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ~/.config/opencode/walkie-tls/cert.pem
```

**Linux (Chrome/Chromium):**
```bash
# Install certutil
sudo apt install libnss3-tools   # Debian/Ubuntu
sudo dnf install nss-tools       # Fedora

# Trust in Chrome
certutil -A -n "walkie-talkie-local" -t "CT,," \
  -i ~/.config/opencode/walkie-tls/cert.pem \
  -d sql:$HOME/.pki/nssdb
```

**Linux (Firefox):**
```bash
certutil -A -n "walkie-talkie-local" -t "CT,," \
  -i ~/.config/opencode/walkie-tls/cert.pem \
  -d ~/.mozilla/firefox/<your-profile>/
```

**Windows (PowerShell as Administrator):**
```powershell
Import-Certificate -FilePath "$env:USERPROFILE\.config\opencode\walkie-tls\cert.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

Restart your browser after adding the certificate.

**Verify:** Open `https://<your-ip>:<port>` in your browser — if no certificate warning appears, it's trusted.

### 3. Start the Web UI

```bash
docker compose -f docker-compose.webui.yml up -d
```

Open `https://localhost:3000`.

### 4. Connect to a Session

In OpenCode, ask for the connection info:
```
use walkie_qr tool
```

The plugin prints a QR code and a `WebSocket: wss://...` URL. Copy the URL, paste it into the Web UI and click **Add Session**.

On **mobile**, scan the QR code with the Web UI's built-in scanner (click **Scan QR**).

## Web UI

A browser dashboard for monitoring multiple OpenCode sessions simultaneously.

- **Session list** — shows all added sessions with live status dots
- **Per-session chat view** — full message history, send responses
- **QR scanner** — scan terminal QR codes directly in the browser
- **Persistent** — sessions survive page refresh (stored in localStorage)

```bash
# Start
docker compose -f docker-compose.webui.yml up -d

# Stop
docker compose -f docker-compose.webui.yml down
```

## TLS / HTTPS

The plugin uses a self-signed TLS certificate stored at:

```
~/.config/opencode/walkie-tls/cert.pem
~/.config/opencode/walkie-tls/key.pem
```

The certificate is generated automatically on first run (requires `openssl`) and reused across sessions (valid 10 years).

**Manual generation** (if auto-generation fails):
```bash
mkdir -p ~/.config/opencode/walkie-tls
openssl req -x509 -newkey rsa:2048 \
  -keyout ~/.config/opencode/walkie-tls/key.pem \
  -out ~/.config/opencode/walkie-tls/cert.pem \
  -days 3650 -nodes \
  -subj "/CN=walkie-talkie-local"
```

## Development

```bash
cd plugin
npm install
npm run dev    # Watch mode
npm test       # Run tests
```

## Troubleshooting

**Browser can't connect to WebSocket?**
Trust the plugin's TLS certificate (see Quick Start step 2), then open `https://<ip>:<port>` directly in your browser to verify.

**Duplicate messages?**
Restart OpenCode — this was fixed in the latest version.

## License

MIT
