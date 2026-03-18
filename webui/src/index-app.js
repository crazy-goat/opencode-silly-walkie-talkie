class App {
  constructor() {
    this.sessions = new Map();
    this.statusClients = new Map();
    this.activeKey = null;
    this.chatClient = null;
    this.hubWs = null;
    this.recognition = null;
    this.isRecording = false;
  }

  init() {
    this._connectHub();
    this._setupInput();
    this._setBottombar(false);
  }

  // ── Hub (session list) ──────────────────────────────────────

  _connectHub() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    this.hubWs = new WebSocket(`${scheme}://${location.host}/api/sessions/ws`);
    this.hubWs.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'session.added') this._addSession(ev.session);
      if (ev.type === 'session.removed') this._removeSession(ev.session);
    };
    this.hubWs.onopen = () => this._setHubStatus('connected');
    this.hubWs.onclose = () => {
      this._setHubStatus('error');
      setTimeout(() => this._connectHub(), 2000);
    };
  }

  _key(s) { return s.sessionId || s.wsUrl; }

  _addSession(session) {
    const key = this._key(session);
    const existing = this.sessions.get(key);
    this.sessions.set(key, session);

    if (existing && existing.wsUrl !== session.wsUrl) {
      const sc = this.statusClients.get(key);
      if (sc) { sc.disconnect(); this.statusClients.delete(key); }
      if (this.activeKey === key) this._openChat(key);
    }

    this._renderSidebar();
    if (!this._hasDot(key)) this._connectStatusDot(key, session.wsUrl);
  }

  _removeSession(session) {
    const key = this._key(session);
    const sc = this.statusClients.get(key);
    if (sc) { sc.disconnect(); this.statusClients.delete(key); }
    this.sessions.delete(key);
    if (this.activeKey === key) {
      this.activeKey = null;
      this._clearChat();
      this._setBottombar(false);
    }
    this._renderSidebar();
  }

  // ── Sidebar rendering ───────────────────────────────────────

  _renderSidebar() {
    const list = document.getElementById('session-list');
    list.innerHTML = '';

    if (this.sessions.size === 0) {
      list.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.8rem">No active sessions</div>';
      return;
    }

    this.sessions.forEach((s, key) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (key === this.activeKey ? ' active' : '') + (!s.sessionId ? ' no-session' : '');
      item.dataset.key = key;

      const dot = document.createElement('span');
      dot.className = 'status-dot';
      dot.id = `dot-${key.replace(/[^a-z0-9]/gi, '_')}`;

      const sc = this.statusClients.get(key);
      if (sc?.ws?.readyState === WebSocket.OPEN) dot.className = 'status-dot connected';
      else if (sc?.ws?.readyState === WebSocket.CONNECTING) dot.className = 'status-dot connecting';

      const label = document.createElement('span');
      label.className = 'session-label';
      if (s.title) {
        label.textContent = s.title;
      } else if (s.sessionId) {
        label.textContent = s.sessionId;
      } else {
        label.innerHTML = '<em>Starting...</em>';
      }

      item.appendChild(dot);
      item.appendChild(label);

      if (s.sessionId) {
        item.addEventListener('click', () => this._selectSession(key));
      }

      list.appendChild(item);
    });
  }

  _hasDot(key) { return this.statusClients.has(key); }

  _connectStatusDot(key, wsUrl) {
    const client = new WalkieClient();
    this.statusClients.set(key, client);

    const updateDot = (cls) => {
      const dot = document.getElementById(`dot-${key.replace(/[^a-z0-9]/gi, '_')}`);
      if (dot) dot.className = 'status-dot ' + cls;
    };

    client.on('connected', () => updateDot('connected'));
    client.on('disconnected', () => updateDot(''));
    client.on('error', () => updateDot('error'));
    client.connectUrl(toProxyUrl(wsUrl));
  }

  // ── Chat ────────────────────────────────────────────────────

  _selectSession(key) {
    if (this.activeKey === key) return;
    this.activeKey = key;
    this._renderSidebar();
    this._openChat(key);
  }

  _openChat(key) {
    if (this.chatClient) {
      this.chatClient.disconnect();
      this.chatClient = null;
    }

    const session = this.sessions.get(key);
    if (!session) return;

    this._clearChat();
    this._setChatTitle(session.title || session.sessionId || session.wsUrl);
    this._setChatStatus('connecting');
    this._setBottombar(false);

    const client = new WalkieClient();
    this.chatClient = client;

    client.on('connected', () => {
      this._setChatStatus('connected');
      this._setBottombar(true);
      client.requestMessages();
    });

    client.on('disconnected', () => {
      this._setChatStatus('');
      this._setBottombar(false);
    });

    client.on('messages', (data) => {
      this._renderMessages(data.messages || []);
    });

    client.on('new_message', (data) => {
      this._addMessage(data.message);
    });

    client.on('awaiting_input', () => {
      this._setBottombar(true);
    });

    client.on('end', () => {
      this._setBottombar(false);
    });

    client.connectUrl(toProxyUrl(session.wsUrl));
  }

  _clearChat() {
    document.getElementById('messages').innerHTML = '';
    document.getElementById('chat-title').textContent = 'Select a session';
    this._setChatStatus('');
  }

  _setChatTitle(title) {
    document.getElementById('chat-title').textContent = title;
  }

  _setChatStatus(cls) {
    const dot = document.getElementById('chat-status');
    dot.className = 'status-dot' + (cls ? ' ' + cls : '');
  }

  _setHubStatus(cls) {
    const dot = document.getElementById('hub-status');
    dot.className = 'status-dot' + (cls ? ' ' + cls : '');
  }

  _renderMessages(messages) {
    document.getElementById('messages').innerHTML = '';
    messages.forEach(m => this._addMessage(m));
  }

  _addMessage(message) {
    const el = document.createElement('div');
    el.className = `message message-${message.role}`;

    const content = document.createElement('div');
    content.className = 'message-content';
    if (typeof marked !== 'undefined') {
      content.innerHTML = marked.parse(message.content || '');
    } else {
      const d = document.createElement('div');
      d.textContent = message.content || '';
      content.appendChild(d);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.appendChild(content);
    el.appendChild(time);

    const msgs = document.getElementById('messages');
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Input ──────────────────────────────��────────────────────

  _setBottombar(visible) {
    const bar = document.getElementById('bottombar');
    bar.classList.toggle('hidden', !visible);
  }

  _setupInput() {
    const textarea = document.getElementById('input-text');
    const sendBtn = document.getElementById('input-send');
    const micBtn = document.getElementById('mic-btn');

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    });

    const send = () => {
      const text = textarea.value.trim();
      if (!text || !this.chatClient) return;
      this.chatClient.send({ type: 'send_message', content: text });
      this._addMessage({ role: 'user', content: text, timestamp: Date.now() });
      textarea.value = '';
      textarea.style.height = 'auto';
    };

    sendBtn.addEventListener('click', send);
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    this._setupMic(micBtn, textarea);
  }

  _setupMic(micBtn, textarea) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    let base = '';

    recognition.onstart = () => {
      this.isRecording = true;
      micBtn.classList.add('recording');
      base = textarea.value;
    };

    recognition.onresult = (e) => {
      const t = Array.from(e.results).map(r => r[0].transcript).join('');
      textarea.value = base + (base && !base.endsWith(' ') ? ' ' : '') + t;
    };

    recognition.onend = () => {
      this.isRecording = false;
      micBtn.classList.remove('recording');
    };

    micBtn.addEventListener('click', () => {
      if (this.isRecording) recognition.stop();
      else recognition.start();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => new App().init());
