class IndexApp {
  constructor() {
    this.clients = new Map();
  }

  init() {
    sessionStore.onChange(sessions => this._render(sessions));
    this._render(sessionStore.getAll());

    document.getElementById('add-btn').addEventListener('click', () => {
      const input = document.getElementById('ws-url-input');
      const url = input.value.trim();
      if (url.startsWith('ws://') || url.startsWith('wss://')) {
        sessionStore.add(url);
        input.value = '';
      }
    });

    document.getElementById('ws-url-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('add-btn').click();
    });
  }

  _render(sessions) {
    const list = document.getElementById('session-list');
    list.innerHTML = '';

    if (sessions.length === 0) {
      list.innerHTML = '<p style="padding:16px;color:#999;text-align:center">No sessions. Paste a WS URL from the terminal QR code.</p>';
    }

    sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'session-item';
      item.dataset.wsUrl = s.wsUrl;

      const dot = document.createElement('div');
      dot.className = 'session-status-dot';
      dot.id = `dot-${btoa(s.wsUrl).replace(/[^a-z0-9]/gi, '')}`;

      const label = document.createElement('div');
      label.className = 'session-label';
      label.textContent = s.wsUrl;

      const remove = document.createElement('button');
      remove.className = 'session-remove';
      remove.textContent = '✕';
      remove.title = 'Remove session';
      remove.addEventListener('click', e => {
        e.stopPropagation();
        const client = this.clients.get(s.wsUrl);
        if (client) client.disconnect();
        this.clients.delete(s.wsUrl);
        sessionStore.remove(s.wsUrl);
      });

      item.appendChild(dot);
      item.appendChild(label);
      item.appendChild(remove);
      item.addEventListener('click', () => {
        window.location.href = `session.html?wsUrl=${encodeURIComponent(s.wsUrl)}`;
      });

      list.appendChild(item);
      this._connectStatus(s.wsUrl, dot);
    });
  }

  _connectStatus(wsUrl, dot) {
    if (this.clients.has(wsUrl)) return;

    const client = new WalkieClient();
    this.clients.set(wsUrl, client);

    const parsed = new URL(wsUrl);
    const token = parsed.pathname.replace(/^\//, '');
    const base = `${parsed.protocol}//${parsed.host}`;

    client.on('connected', () => {
      dot.className = 'session-status-dot connected';
    });
    client.on('disconnected', () => {
      dot.className = 'session-status-dot';
    });
    client.on('error', () => {
      dot.className = 'session-status-dot error';
    });

    dot.className = 'session-status-dot connecting';
    client.connect(base, token);
  }
}

document.addEventListener('DOMContentLoaded', () => new IndexApp().init());
