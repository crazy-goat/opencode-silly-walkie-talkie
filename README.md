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

### 2. Setup ngrok

```bash
npm install -g ngrok
ngrok config add-authtoken <your_token>
```

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
- Make sure ngrok authtoken is configured
- Check that port 8765 is not in use

**Cannot connect from phone?**
- Ensure your phone is on the same network (for local testing)
- Check that ngrok tunnel is active

**Connection drops?**
- Normal for ngrok free tier (1 hour limit)
- Restart OpenCode to get new QR code

## License

MIT
