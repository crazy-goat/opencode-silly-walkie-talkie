const STORAGE_KEY = 'walkie_sessions';

class SessionStore {
  constructor() {
    this._listeners = [];
  }

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  add(wsUrl) {
    const sessions = this.getAll();
    if (sessions.find(s => s.wsUrl === wsUrl)) return;
    sessions.push({ wsUrl, addedAt: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    this._notify();
  }

  remove(wsUrl) {
    const sessions = this.getAll().filter(s => s.wsUrl !== wsUrl);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    this._notify();
  }

  onChange(fn) {
    this._listeners.push(fn);
  }

  _notify() {
    this._listeners.forEach(fn => fn(this.getAll()));
  }
}

const sessionStore = new SessionStore();

function toProxyUrl(wsUrl) {
  try {
    const parsed = new URL(wsUrl);
    const port = parsed.port;
    const token = parsed.pathname.replace(/^\//, '');
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const path = token ? `/ws/${port}/${token}` : `/ws/${port}/`;
    return `${scheme}://${location.host}${path}`;
  } catch {
    return wsUrl;
  }
}
