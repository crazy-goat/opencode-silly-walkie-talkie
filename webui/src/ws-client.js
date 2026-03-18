class WalkieClient {
  constructor() {
    this.ws = null;
    this.url = null;
    this.token = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelay = 60000;
    this.heartbeatTimeout = null;
    this.lastHeartbeat = 0;
    this.listeners = new Map();
    this._intentionalDisconnect = false;
    this._heartbeatInterval = null;
  }

  connect(url, token) {
    this.url = url;
    this.token = token;
    this.reconnectAttempts = 0;
    this.lastHeartbeat = Date.now();
    this._connect();
  }

  _connect() {
    this._intentionalDisconnect = false;
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this.ws) {
      this.ws.close();
    }

    const wsUrl = this.url.replace(/^http/, 'ws') + `/${this.token}`;
    console.log('[Walkie] Connecting to:', wsUrl);

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('[Walkie] Connected');
      this.reconnectAttempts = 0;
      this._emit('connected', {});
      this._startHeartbeatMonitor();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this._handleMessage(data.payload);
      } catch (err) {
        console.error('[Walkie] Failed to parse message:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[Walkie] Disconnected');
      this._emit('disconnected', {});
      this._scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[Walkie] WebSocket error:', err);
      this._emit('error', { error: err });
    };
  }

  _handleMessage(payload) {
    // Update last heartbeat time
    if (payload.type === 'heartbeat' || payload.type === 'pong') {
      this.lastHeartbeat = Date.now();
    }

    this._emit(payload.type, payload);
  }

  _startHeartbeatMonitor() {
    // Check heartbeat every 10 seconds
    this._heartbeatInterval = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
        return;
      }

      const timeSinceLastHeartbeat = Date.now() - this.lastHeartbeat;

      // If no heartbeat for 10s, send ping
      if (timeSinceLastHeartbeat > 10000) {
        this.send({ type: 'ping' });
      }

      // If no heartbeat for 30s, connection is dead
      if (timeSinceLastHeartbeat > 30000) {
        console.log('[Walkie] Heartbeat timeout, reconnecting...');
        this.ws.close();
        clearInterval(this._heartbeatInterval);
        this._heartbeatInterval = null;
      }
    }, 1000);
  }

  _scheduleReconnect() {
    if (this._intentionalDisconnect) return;
    const delay = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );

    console.log(`[Walkie] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    setTimeout(() => {
      this.reconnectAttempts++;
      this._connect();
    }, delay);
  }

  send(command) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(command));
    } else {
      console.warn('[Walkie] Cannot send, not connected');
    }
  }

  disconnect() {
    this._intentionalDisconnect = true;
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
      this._heartbeatInterval = null;
    }
    if (this.ws) {
      this.send({ type: 'bye' });
      this.ws.close();
    }
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  _emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  requestMessages() {
    this.send({ type: 'get_messages' });
  }
}

