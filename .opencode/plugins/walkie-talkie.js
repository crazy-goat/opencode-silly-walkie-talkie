// src/server.ts
import * as fs2 from "fs";
import * as path2 from "path";

// src/tls.ts
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
var TLS_DIR = path.join(os.homedir(), ".config", "opencode", "walkie-tls");
var CERT_PATH = path.join(TLS_DIR, "cert.pem");
var KEY_PATH = path.join(TLS_DIR, "key.pem");
function ensureTlsCert() {
  if (!fs.existsSync(TLS_DIR)) {
    fs.mkdirSync(TLS_DIR, { recursive: true });
    fs.chmodSync(TLS_DIR, 448);
  }
  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 3650 -nodes -subj "/CN=walkie-talkie-local"`,
        { stdio: "pipe" }
      );
    } catch (err) {
      const detail = err.stderr?.toString().trim() ?? err.message;
      throw new Error(`Failed to generate TLS certificate. Is openssl installed? Details: ${detail}`);
    }
    fs.chmodSync(KEY_PATH, 384);
  }
  return {
    cert: fs.readFileSync(CERT_PATH, "utf8"),
    key: fs.readFileSync(KEY_PATH, "utf8"),
    certPath: CERT_PATH,
    keyPath: KEY_PATH
  };
}

// src/server.ts
function findPwaDir() {
  const candidates = [path2.join(process.cwd(), "pwa")];
  for (const dir of candidates) {
    if (fs2.existsSync(path2.join(dir, "index.html"))) return dir;
  }
  return null;
}
var MIME = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};
var WalkieServer = class {
  constructor(fixedToken = "") {
    this.fixedToken = fixedToken;
  }
  token = "";
  clients = /* @__PURE__ */ new Set();
  messages = [];
  port = 0;
  bunServer = null;
  pwaDir = null;
  tlsCert = null;
  onDebug = null;
  async start(port = 0) {
    this.token = this.fixedToken;
    this.pwaDir = findPwaDir();
    const self = this;
    if (!this.tlsCert) this.tlsCert = ensureTlsCert();
    const tls = this.tlsCert;
    this.bunServer = Bun.serve({
      port,
      hostname: "0.0.0.0",
      tls: {
        cert: tls.cert,
        key: tls.key
      },
      fetch(req, server2) {
        const url = new URL(req.url);
        const token = url.pathname.split("/").filter(Boolean)[0] ?? "";
        if (req.headers.get("upgrade") === "websocket") {
          if (self.token && token !== self.token) {
            return new Response("Invalid token", { status: 403 });
          }
          const ok = server2.upgrade(req, { data: { token } });
          if (!ok) return new Response("Upgrade failed", { status: 500 });
          return void 0;
        }
        const pwaDir = self.pwaDir;
        if (!pwaDir) return new Response("PWA not found", { status: 404 });
        let filePath = path2.join(pwaDir, url.pathname === "/" ? "index.html" : url.pathname);
        if (!fs2.existsSync(filePath)) filePath = path2.join(pwaDir, "index.html");
        const ext = path2.extname(filePath);
        try {
          const data = fs2.readFileSync(filePath);
          return new Response(data, {
            headers: { "Content-Type": MIME[ext] || "application/octet-stream" }
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
      websocket: {
        open(ws) {
          const token = ws.data?.token ?? "";
          self.onDebug?.("WS open", { token, expected: self.token });
          if (self.token && token !== self.token) {
            ws.close(1008, "Invalid token");
            return;
          }
          self.clients.add(ws);
          ws.send(JSON.stringify({ payload: { type: "heartbeat", timestamp: Date.now() } }));
        },
        message(ws, data) {
          try {
            const command = JSON.parse(data);
            self._handleCommand(ws, command);
          } catch {
          }
        },
        close(ws) {
          self.onDebug?.("WS close", {});
          self.clients.delete(ws);
        }
      }
    });
    this.port = this.bunServer.port;
    setInterval(() => {
      self.broadcast({ type: "heartbeat", timestamp: Date.now() });
    }, 1e4).unref();
    return this.port;
  }
  onMessage = null;
  onAnswer = null;
  _handleCommand(ws, command) {
    switch (command.type) {
      case "get_messages":
        ws.send(JSON.stringify({ payload: { type: "messages", messages: this.messages } }));
        break;
      case "ping":
        ws.send(JSON.stringify({ payload: { type: "pong", timestamp: Date.now() } }));
        break;
      case "send_message":
        if (this.onMessage && command.content) {
          this.onMessage(command.content);
        }
        break;
      case "answer_question":
        if (this.onAnswer) {
          this.onAnswer(command.requestID, command.answers);
        }
        break;
      case "bye":
        ws.close();
        break;
    }
  }
  broadcast(event) {
    const msg = JSON.stringify({ payload: event });
    for (const ws of this.clients) {
      try {
        ws.send(msg);
      } catch {
      }
    }
  }
  addMessage(message) {
    this.messages.push(message);
  }
  getToken() {
    return this.token;
  }
  getPort() {
    return this.port;
  }
  async stop() {
    await this.bunServer?.stop();
  }
};

// src/tunnel.ts
import * as os2 from "os";
function getLocalIp() {
  const interfaces = os2.networkInterfaces();
  const all = [];
  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== "IPv4" || addr.internal) continue;
      if (/^(docker|br-|veth|virbr|vmnet|vbox)/.test(name)) continue;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr.address)) continue;
      all.push(addr.address);
    }
  }
  return all[0] ?? "localhost";
}

// src/index.ts
var server = null;
var sessionId = null;
var pendingMessage = null;
var lastBroadcastId = null;
var index_default = async ({ client }) => {
  server = new WalkieServer("");
  const port = await server.start(0);
  const ip = getLocalIp();
  const wsUrl = `wss://${ip}:${port}`;
  const WEBUI_URL = process.env.WALKIE_WEBUI_URL || "https://localhost:3000";
  const register = () => fetch(`${WEBUI_URL}/api/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wsUrl })
  }).catch(() => {
  });
  const unregister = () => fetch(`${WEBUI_URL}/api/register`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ wsUrl })
  }).catch(() => {
  });
  register();
  process.on("exit", () => unregister());
  process.on("SIGTERM", () => {
    unregister();
    process.exit(0);
  });
  process.on("SIGINT", () => {
    unregister();
    process.exit(0);
  });
  server.onMessage = (content) => {
    if (!sessionId) return;
    server.addMessage({ role: "user", content, timestamp: Date.now() });
    client.session.promptAsync({
      path: { id: sessionId },
      body: { parts: [{ type: "text", text: content }] }
    }).catch(() => {
    });
  };
  server.onAnswer = (requestID, answers) => {
    client.question.reply({
      path: { requestID },
      body: { answers }
    }).catch(() => {
    });
  };
  return {
    event: async ({ event }) => {
      if (!server) return;
      if (event.type === "session.created") {
        sessionId = event.properties?.info?.id ?? null;
      }
      if (event.type === "message.updated" && event.properties?.info?.role === "assistant") {
        const info = event.properties.info;
        const resp = await client.session.message({
          path: { id: info.sessionID, messageID: info.id }
        }).catch(() => ({ data: null }));
        const parts = resp.data?.parts || [];
        const text = parts.filter((p) => p.type === "text").map((p) => p.text).join("");
        if (text) {
          pendingMessage = { id: info.id, text };
        }
      }
      const _flushPending = () => {
        if (pendingMessage && pendingMessage.id !== lastBroadcastId) {
          lastBroadcastId = pendingMessage.id;
          const message = { role: "assistant", content: pendingMessage.text, timestamp: Date.now() };
          server.addMessage(message);
          server.broadcast({ type: "new_message", message });
        }
        pendingMessage = null;
      };
      if (event.type === "session.status" && event.properties?.status === "awaiting_input") {
        _flushPending();
        server.broadcast({ type: "awaiting_input" });
      }
      if (event.type === "session.idle") {
        _flushPending();
        server.broadcast({ type: "end" });
      }
      if (event.type === "question.asked") {
        const req = event.properties;
        server.broadcast({
          type: "question",
          requestID: req.id,
          questions: req.questions.map((q) => ({
            question: q.question,
            header: q.header,
            options: q.options,
            multiple: q.multiple,
            custom: q.custom
          }))
        });
      }
    }
  };
};
export {
  index_default as default
};
