class WalkieUI {
  constructor() {
    this.statusEl = document.getElementById('connection-status');
    this.messagesEl = document.getElementById('messages');
    this.scannerContainer = document.getElementById('scanner-container');
    this.currentStatus = 'disconnected';
  }

  setStatus(status, message = '') {
    this.currentStatus = status;
    
    const statusIcons = {
      disconnected: '⚪',
      connecting: '🟡',
      connected: '🟢',
      error: '🔴',
      working: '🔄',
      done: '✓',
    };

    const icon = statusIcons[status] || '⚪';
    this.statusEl.textContent = `${icon} ${message || status}`;
    this.statusEl.className = `status-${status}`;
  }

  hideScanner() {
    if (this.scannerContainer) {
      this.scannerContainer.style.display = 'none';
    }
  }

  showScanner() {
    if (this.scannerContainer) {
      this.scannerContainer.style.display = 'block';
    }
  }

  addMessage(message) {
    if (!this.messagesEl) return;

    const msgEl = document.createElement('div');
    msgEl.className = `message message-${message.role}`;
    msgEl.innerHTML = `
      <div class="message-header">${message.role}</div>
      <div class="message-content">${this._escapeHtml(message.content)}</div>
      <div class="message-time">${this._formatTime(message.timestamp)}</div>
    `;

    this.messagesEl.appendChild(msgEl);
    this.scrollToBottom();
  }

  clearMessages() {
    if (this.messagesEl) {
      this.messagesEl.innerHTML = '';
    }
  }

  renderMessages(messages) {
    this.clearMessages();
    messages.forEach(msg => this.addMessage(msg));
  }

  scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  renderQuestion(data) {
    if (!this.messagesEl) return;

    for (const q of data.questions) {
      const optionsList = q.options.map(o => `• ${o.label}: ${o.description}`).join('\n');
      const text = `${q.question}\n\nOptions:\n${optionsList}`;
      this.addMessage({ role: 'assistant', content: text, timestamp: Date.now() });
    }
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  _formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
