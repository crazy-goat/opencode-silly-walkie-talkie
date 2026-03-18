class IndexApp {
  constructor() {
    this.clients = new Map();
    this.sessions = new Map();
    this.hubWs = null;
  }

  init() {
    this._connectHub();
  }

  _connectHub() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${location.host}/api/sessions/ws`;
    this.hubWs = new WebSocket(url);

    this.hubWs.onmessage = (e) => {
      const event = JSON.parse(e.data);
      if (event.type === 'session.added') this._addSession(event.session);
      if (event.type === 'session.removed') this._removeSession(event.session.wsUrl);
    };

    this.hubWs.onclose = () => setTimeout(() => this._connectHub(), 2000);
  }

  _addSession(session) {
    if (this.sessions.has(session.wsUrl)) return;
    this.sessions.set(session.wsUrl, session);
    this._render();
  }

  _removeSession(wsUrl) {
    const client = this.clients.get(wsUrl);
    if (client) { client.disconnect(); this.clients.delete(wsUrl); }
    this.sessions.delete(wsUrl);
    this._render();
  }

  _render() {
    const list = document.getElementById('session-list');
    list.innerHTML = '';

    if (this.sessions.size === 0) {
      list.innerHTML = '<p style="padding:16px;color:#999;text-align:center">No active sessions.</p>';
      return;
    }

    this.sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = 'session-item';

      const dot = document.createElement('div');
      dot.className = 'session-status-dot';

      const label = document.createElement('div');
      label.className = 'session-label';
      label.textContent = s.wsUrl;

      item.appendChild(dot);
      item.appendChild(label);
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
    client.on('connected', () => { dot.className = 'session-status-dot connected'; });
    client.on('disconnected', () => { dot.className = 'session-status-dot'; });
    client.on('error', () => { dot.className = 'session-status-dot error'; });
    dot.className = 'session-status-dot connecting';
    client.connectUrl(toProxyUrl(wsUrl));
  }
}

document.addEventListener('DOMContentLoaded', () => new IndexApp().init());
