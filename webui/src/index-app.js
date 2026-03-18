class App {
  constructor() {
    this.sessions = new Map();
    this.statusClients = new Map();
    this.activeKey = null;
    this.chatClient = null;
    this.hubWs = null;
    this.recognition = null;
    this.isRecording = false;
    this.lastMessageId = null;
    this.typingEl = null;
    this.typingTimer = null;
    this.typingStart = null;
    this.seenTools = new Set();
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

    if (this.sessions.size === 0) {
      if (list.dataset.empty !== '1') {
        list.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:0.8rem">No active sessions</div>';
        list.dataset.empty = '1';
      }
      return;
    }
    list.dataset.empty = '0';

    const existingKeys = new Set([...list.querySelectorAll('.session-item')].map(el => el.dataset.key));
    const desiredKeys = new Set(this.sessions.keys());

    existingKeys.forEach(key => {
      if (!desiredKeys.has(key)) list.querySelector(`[data-key="${CSS.escape(key)}"]`)?.remove();
    });

    this.sessions.forEach((s, key) => {
      let item = list.querySelector(`[data-key="${CSS.escape(key)}"]`);
      if (!item) {
        item = document.createElement('div');
        item.dataset.key = key;

        const dot = document.createElement('span');
        dot.id = `dot-${key.replace(/[^a-z0-9]/gi, '_')}`;

        const label = document.createElement('span');
        label.className = 'session-label';

        item.appendChild(dot);
        item.appendChild(label);
        item.addEventListener('click', () => this._selectSession(key));
        list.appendChild(item);
      }

      item.className = 'session-item' + (key === this.activeKey ? ' active' : '');

      const dot = item.querySelector('span');
      const sc = this.statusClients.get(key);
      if (sc?.ws?.readyState === WebSocket.OPEN) dot.className = 'status-dot connected';
      else if (sc?.ws?.readyState === WebSocket.CONNECTING) dot.className = 'status-dot connecting';
      else dot.className = 'status-dot';

      const label = item.querySelector('.session-label');
      const newText = s.title || s.sessionId || null;
      if (newText) { label.textContent = newText; }
      else { label.innerHTML = '<em>Starting...</em>'; }
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
    this._setBottombar(false);

    const existing = this.statusClients.get(key);
    this.statusClients.delete(key);

    const client = existing || new WalkieClient();
    this.chatClient = client;

    const attachListeners = () => {
      this._setChatStatus('connected');
      this._setBottombar(true);
      client.requestMessages(this.lastMessageId);
    };

    client.on('connected', attachListeners);
    client.on('disconnected', () => {
      this._setChatStatus('');
      this._setBottombar(false);
    });

    client.on('messages', (data) => {
      this._appendMessages(data.messages || []);
    });

    client.on('tool_update', (data) => {
      const k = data.tool?.name + JSON.stringify(data.tool?.input);
      if (this.seenTools.has(k)) return;
      this.seenTools.add(k);
      this._addTypingTool(data.tool);
    });

    client.on('new_message', (data) => {
      this._hideTyping();
      this._addMessage(data.message);
    });

    client.on('question', (data) => {
      this._hideTyping();
      this._showQuestion(data);
    });

    client.on('awaiting_input', () => {
      this._hideTyping();
      this._setBottombar(true);
    });

    client.on('end', () => {
      this._hideTyping();
      this._setBottombar(true);
    });

    if (existing && existing.ws?.readyState === WebSocket.OPEN) {
      this._setChatStatus('connected');
      this._setBottombar(true);
      client.requestMessages(this.lastMessageId);
    } else {
      this._setChatStatus('connecting');
      client.connectUrl(toProxyUrl(session.wsUrl));
    }
  }

  _clearChat() {
    document.getElementById('messages').innerHTML = '';
    document.getElementById('chat-title').textContent = 'Select a session';
    this._setChatStatus('');
    this.lastMessageId = null;
    this.seenTools = new Set();
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

  _appendMessages(messages) {
    messages.forEach(m => this._addMessage(m, true));
    const msgs = document.getElementById('messages');
    msgs.scrollTop = msgs.scrollHeight;
  }

  _addMessage(message, noScroll = false) {
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

    if (message.tools?.length) {
      const toolsEl = document.createElement('div');
      toolsEl.className = 'message-tools';
      for (const tool of message.tools) toolsEl.appendChild(this._buildToolEl(tool));
      el.appendChild(toolsEl);
    }

    const time = document.createElement('div');
    time.className = 'message-time';
    time.textContent = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    el.appendChild(content);
    el.appendChild(time);

    if (message.id) this.lastMessageId = message.id;

    const msgs = document.getElementById('messages');
    msgs.appendChild(el);
    if (!noScroll) msgs.scrollTop = msgs.scrollHeight;
  }

  _escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  _showQuestion(data) {
    const { requestID, questions } = data;
    const el = document.createElement('div');
    el.className = 'message message-question';
    el.dataset.requestId = requestID;

    for (const q of questions) {
      const block = document.createElement('div');
      block.className = 'question-block';

      const header = document.createElement('div');
      header.className = 'question-header';
      header.textContent = q.question;
      block.appendChild(header);

      const opts = document.createElement('div');
      opts.className = 'question-options';

      const selected = new Set();

      const submit = (answers) => {
        if (this.chatClient) {
          this.chatClient.send({ type: 'answer_question', requestID, answers });
        }
        el.querySelectorAll('.question-option').forEach(b => b.disabled = true);
        el.querySelectorAll('.question-custom input').forEach(i => i.disabled = true);
        el.querySelectorAll('.question-submit').forEach(b => b.disabled = true);
      };

      for (const opt of (q.options || [])) {
        const btn = document.createElement('button');
        btn.className = 'question-option';
        btn.textContent = opt.label;
        if (opt.description) btn.title = opt.description;
        btn.addEventListener('click', () => {
          if (q.multiple) {
            btn.classList.toggle('selected');
            if (btn.classList.contains('selected')) selected.add(opt.label);
            else selected.delete(opt.label);
          } else {
            submit([[opt.label]]);
          }
        });
        opts.appendChild(btn);
      }

      block.appendChild(opts);

      if (q.custom !== false) {
        const customRow = document.createElement('div');
        customRow.className = 'question-custom';
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Type your answer...';
        const submitBtn = document.createElement('button');
        submitBtn.className = 'question-submit';
        submitBtn.textContent = 'Send';
        submitBtn.addEventListener('click', () => {
          const val = input.value.trim();
          if (val) submit([[val]]);
        });
        input.addEventListener('keydown', e => {
          if (e.key === 'Enter') { const val = input.value.trim(); if (val) submit([[val]]); }
        });
        customRow.appendChild(input);
        customRow.appendChild(submitBtn);
        block.appendChild(customRow);
      }

      if (q.multiple) {
        const submitBtn = document.createElement('button');
        submitBtn.className = 'question-submit';
        submitBtn.textContent = 'Confirm';
        submitBtn.addEventListener('click', () => submit([[...selected]]));
        block.appendChild(submitBtn);
      }

      el.appendChild(block);
    }

    const msgs = document.getElementById('messages');
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  // ── Input ──────────────────────────────��────────────────────

  _setBottombar(visible) {
    const bar = document.getElementById('bottombar');
    bar.classList.toggle('hidden', !visible);
  }

  _showTyping() {
    this._hideTyping();
    this.typingStart = Date.now();
    const el = document.createElement('div');
    el.className = 'message message-assistant message-typing';
    el.innerHTML = '<div class="message-content"><span class="typing-dots"><span>.</span><span>.</span><span>.</span></span> <span class="typing-time">0:00</span><span class="typing-tool"></span></div>';
    const msgs = document.getElementById('messages');
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    this.typingEl = el;
    this.typingTimer = setInterval(() => {
      const s = Math.floor((Date.now() - this.typingStart) / 1000);
      const m = Math.floor(s / 60);
      const sec = String(s % 60).padStart(2, '0');
      el.querySelector('.typing-time').textContent = `${m}:${sec}`;
    }, 1000);
  }

  _addTypingTool(tool) {
    if (!this.typingEl) this._showTyping();
    const label = tool.label || tool.name;
    const el = this.typingEl.querySelector('.typing-tool');
    if (el) el.textContent = ' · ' + label;
  }

  _buildToolEl(tool) {
    const t = document.createElement('div');
    t.className = 'tool-call';
    const inputStr = tool.input ? JSON.stringify(tool.input, null, 2) : '';
    const hasDetails = inputStr || tool.output;
    t.innerHTML = `<span class="tool-name">⚙ ${this._escapeHtml(tool.name)}</span>${hasDetails ? ' <span class="tool-toggle">▸</span>' : ''}`;
    if (hasDetails) {
      const details = document.createElement('div');
      details.className = 'tool-details hidden';
      if (inputStr) details.innerHTML += `<pre class="tool-input">${this._escapeHtml(inputStr)}</pre>`;
      if (tool.output) details.innerHTML += `<pre class="tool-output">${this._escapeHtml(tool.output)}</pre>`;
      t.appendChild(details);
      t.addEventListener('click', () => {
        details.classList.toggle('hidden');
        t.querySelector('.tool-toggle').textContent = details.classList.contains('hidden') ? '▸' : '▾';
      });
    }
    return t;
  }

  _hideTyping() {
    if (this.typingTimer) { clearInterval(this.typingTimer); this.typingTimer = null; }
    if (this.typingEl) { this.typingEl.remove(); this.typingEl = null; }
    this.typingStart = null;
    this.seenTools = new Set();
    document.querySelectorAll('.tool-standalone').forEach(el => el.remove());
  }

  _setupInput() {
    const textarea = document.getElementById('input-text');
    const sendBtn = document.getElementById('input-send');
    const micBtn = document.getElementById('mic-btn');

    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 80) + 'px';
    });

    const stopMic = () => {
      if (this.isRecording) {
        this.recognition?.stop();
        this.micStopped = true;
      }
    };

    const send = () => {
      const text = textarea.value.trim();
      if (!text || !this.chatClient) return;
      stopMic();
      this.chatClient.send({ type: 'send_message', content: text });
      this._addMessage({ role: 'user', content: text, timestamp: Date.now() });
      this._showTyping();
      textarea.value = '';
      textarea.style.height = 'auto';
    };

    sendBtn.addEventListener('click', send);
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    textarea.addEventListener('focus', () => stopMic());

    this._setupMic(micBtn, textarea);
  }

  _setupMic(micBtn, textarea) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { micBtn.style.display = 'none'; return; }

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';
    this.recognition = recognition;

    let base = '';

    recognition.onstart = () => {
      this.isRecording = true;
      this.micStopped = false;
      micBtn.classList.add('recording');
      base = textarea.value;
    };

    recognition.onresult = (e) => {
      if (this.micStopped) return;
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
