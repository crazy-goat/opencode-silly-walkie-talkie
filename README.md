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

### 2a. Setup ngrok (Easy, Free tier = 1h limit)

```bash
npm install -g ngrok
ngrok config add-authtoken <your_token>
```

### 2b. Setup zrok self-hosted (Best - no limits, your own domain)

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

The plugin will automatically use zrok if `ZROK_TOKEN` is set, otherwise falls back to ngrok.

### 3. Start OpenCode

When you start OpenCode, the plugin will:
1. Start a WebSocket server
2. Create an ngrok tunnel
3. Display a QR code in your terminal

### 4. Scan QR with Your Phone

1. Open the PWA URL (or host it locally)
2. Allow camera access
3. Scan the QR code displayed in OpenCode terminal
4. You're connected!

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

## Architecture

```
OpenCode (plugin)  ←──WebSocket──→  PWA (phone/tablet)
      ↓
   ngrok tunnel (public URL)
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

**QR code not displaying?**
- Make sure ngrok authtoken is configured (or ZROK_TOKEN for zrok)
- Check that port 8765 is not in use

**Cannot connect from phone?**
- Ensure your phone is on the same network (for local testing)
- Check that ngrok/zrok tunnel is active

**Connection drops?**
- With ngrok free tier: normal (1 hour limit), restart OpenCode to get new QR code
- With zrok self-hosted: shouldn't happen, check VPS status

## License

MIT
