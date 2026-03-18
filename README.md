# OpenCode Walkie-Talkie

📱 Get mobile notifications when your AI assistant needs you.

Walkie-Talkie is a plugin for OpenCode that sends real-time notifications to your phone or tablet when:
- LLM finishes generating a response
- LLM is waiting for your input

## Quick Start

### 1. Install the Plugin

```bash
cd plugin
npm install
npm run build
npm link
```

Add to your `opencode.json`:
```json
{
  "plugins": ["@crazy-goat/opencode-walkie-talkie"]
}
```

### 2. Setup (Best - no limits, your own domain)

If you have a VPS with Dokploy:

**On your VPS:**
```bash
# 1. Klonuj repo lub skopiuj pliki
cd /home/decodo/work/open-code-silly-walkie-talkie

# 2. Skonfiguruj zmienne środowiskowe
cp .env.example .env
# Edytuj .env - ustaw swoje domeny i tokeny
nano .env

# 3. Deploy do Dokploy
dokploy deploy -f dokploy-zrok.yml --env-file .env
```

**Wymagana konfiguracja DNS (np. Cloudflare):**
```
A    api.zrok.twojadomena.pl    → YOUR_VPS_IP
A    *.zrok.twojadomena.pl      → YOUR_VPS_IP  
A    tunel.zrok.twojadomena.pl  → YOUR_VPS_IP
```

**Pierwsze uruchomienie - generowanie tokena użytkownika:**
```bash
# Po uruchomieniu controllera, wygeneruj token dla użytkownika
curl -X POST https://api.zrok.twojadomena.pl:18080/api/v1/users \
  -H "X-Admin-Token: <ZROK_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# Odpowiedź zawiera token - zapisz go do .env jako ZROK_TOKEN i zrestartuj
```

**Na Twoim komputerze lokalnym:**
```bash
# Instalacja zrok CLI
curl -sSL https://get.openziti.io/install.bash | bash

# Aktywacja (one-time setup)
zrok enable <ZROK_TOKEN> --api-url https://api.zrok.twojadomena.pl

# Konfiguracja pluginu
export ZROK_TOKEN=<ZROK_TOKEN>
export ZROK_API_URL=https://api.zrok.twojadomena.pl
```

The plugin will automatically use zrok if `ZROK_TOKEN` is set, otherwise falls back to local network connection.

### 3. Start OpenCode

When you start OpenCode, the plugin will:
1. Start a WebSocket server
2. Display a QR code in your terminal

### 4. Scan QR with Your Phone

1. Open the PWA URL (or host it locally)
2. Allow camera access
3. Scan the QR code displayed in OpenCode terminal
4. You're connected!

## Multi-Session Web UI

The Web UI is a Docker-hosted dashboard that lets you monitor and interact with multiple OpenCode sessions from a browser.

### Start the Web UI

```bash
docker compose -f docker-compose.webui.yml up -d
```

Open `https://localhost:3001` in your browser (accept the self-signed certificate warning).

### Add a Session

1. In OpenCode, call the `walkie_qr` tool — it prints a QR and a `WebSocket: wss://...` URL
2. Copy the `wss://...` URL
3. Paste it into the Web UI input and click **Add Session**
4. The session appears in the list with a status dot (grey → yellow → green when connected)
5. Click the session to open the chat view

### Session List

Each session shows:
- Status dot: grey (disconnected), yellow (connecting), green (connected), red (error)
- WS URL of the session
- Remove button (✕) to disconnect and remove the session

### Stop the Web UI

```bash
docker compose -f docker-compose.webui.yml down
```

## Using the PWA

### Option A: Local Development

```bash
cd pwa
# Serve with any static server
npx serve .
# Or
python3 -m http.server 8080
```

Open `http://localhost:8080` on your phone.

### Option B: Deploy

Deploy `pwa/` folder to any static hosting:
- GitHub Pages
- Netlify
- Vercel
- Cloudflare Pages

## TLS / HTTPS

Walkie-Talkie requires HTTPS/WSS because browsers block WebSocket connections to untrusted origins.
The plugin auto-generates a self-signed TLS certificate on first start and saves it to:

```
~/.config/opencode/walkie-tls/cert.pem
~/.config/opencode/walkie-tls/key.pem
```

For the Web UI to connect to the plugin's WebSocket, **the browser must trust the plugin's certificate**. Without this, connections will silently fail.

### Trusting the certificate (one-time setup)

#### macOS

```bash
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain \
  ~/.config/opencode/walkie-tls/cert.pem
```

Then restart your browser.

#### Linux (Chrome/Chromium)

```bash
# Install certutil if needed
sudo apt install libnss3-tools   # Debian/Ubuntu
# or
sudo dnf install nss-tools       # Fedora

# Add to Chrome's NSS database
certutil -A -n "walkie-talkie-local" \
  -t "CT,," \
  -i ~/.config/opencode/walkie-tls/cert.pem \
  -d sql:$HOME/.pki/nssdb

# Add to Chromium's NSS database (if using Chromium)
certutil -A -n "walkie-talkie-local" \
  -t "CT,," \
  -i ~/.config/opencode/walkie-tls/cert.pem \
  -d sql:$HOME/.config/chromium/Default
```

Then restart your browser.

#### Linux (Firefox)

```bash
# Find your Firefox profile directory
ls ~/.mozilla/firefox/*.default-release/

# Add certificate
certutil -A -n "walkie-talkie-local" \
  -t "CT,," \
  -i ~/.config/opencode/walkie-tls/cert.pem \
  -d ~/.mozilla/firefox/<your-profile>/
```

Then restart Firefox.

#### Windows

```powershell
Import-Certificate -FilePath "$env:USERPROFILE\.config\opencode\walkie-tls\cert.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

Run in PowerShell as Administrator, then restart your browser.

### Verifying the certificate is trusted

After adding the certificate, open the plugin's WebSocket URL directly in your browser:

```
https://<ip>:<port>
```

You should see a plain page (not a certificate warning). If you see the page without warnings, the Web UI will be able to connect.

### Generating the certificate manually

If auto-generation fails (e.g. `openssl` not found), generate it manually:

```bash
mkdir -p ~/.config/opencode/walkie-tls
openssl req -x509 -newkey rsa:2048 \
  -keyout ~/.config/opencode/walkie-tls/key.pem \
  -out ~/.config/opencode/walkie-tls/cert.pem \
  -days 3650 -nodes \
  -subj "/CN=walkie-talkie-local"
```

The certificate is valid for 10 years and reused across sessions.

## Architecture

```
OpenCode (plugin)  ←──WebSocket──→  PWA (phone/tablet)
OpenCode (plugin)  ←──WebSocket──→  Web UI (browser, multi-session)
```

## Protocol

WebSocket events:
- `heartbeat` (every 10s)
- `new_message` (when LLM sends content)
- `end` (when LLM finishes)
- `messages` (message history)

## Development

### Plugin

```bash
cd plugin
npm install
npm run dev    # Watch mode
npm test       # Run tests
```

### PWA

```bash
cd pwa
# Serve locally
npx serve .
```

## Troubleshooting

**Connection drops?**
- Check your local network or zrok status.

## License

MIT
