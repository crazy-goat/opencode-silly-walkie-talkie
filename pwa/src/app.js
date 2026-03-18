// Main application logic
class WalkieApp {
  constructor() {
    this.ui = new WalkieUI();
    this.scanner = null;
    this.pendingQuestion = null;
  }

  init() {
    console.log('[App] Initializing Walkie-Talkie...');
    
    this._setupClientListeners();
    
    // Check URL for auto-connect
    const urlParams = new URLSearchParams(window.location.search);
    const wsUrl = urlParams.get('wsUrl');
    if (wsUrl && (wsUrl.startsWith('ws://') || wsUrl.startsWith('wss://'))) {
      this._connectWs(wsUrl);
      return;
    }
    const autoUrl = urlParams.get('url');
    if (autoUrl) {
      this._connect(autoUrl);
      return;
    }

    this._setupManualToggle();
    this._startScanner();
  }

  _setupManualToggle() {
    document.getElementById('connect-btn')?.addEventListener('click', () => {
      const url = document.getElementById('server-url').value.trim();
      if (url) this._connect(url);
    });
  }

  _startScanner() {
    this.scanner = new QRScanner('qr-reader', (result) => {
      console.log('[App] QR scanned:', result);
      this._connectWs(result.wsUrl);
    });
    this.scanner.start();
  }

  _connect(url) {
    // Manual input or auto-connect from URL param
    const wsUrl = url.startsWith('ws://') || url.startsWith('wss://') ? url : `wss://${url}`;
    this._connectWs(wsUrl);
  }

  _connectWs(wsUrl) {
    this.ui.setStatus('connecting', 'Connecting...');
    document.getElementById('manual-container').style.display = 'none';
    document.getElementById('qr-reader').style.display = 'none';

    const parsed = new URL(wsUrl);
    const token = parsed.pathname.replace(/^\//, '');
    const base = `${parsed.protocol}//${parsed.host}`;
    walkieClient.connect(base, token);
  }

  _setupClientListeners() {
    walkieClient.on('connected', () => {
      console.log('[App] Connected');
      this.ui.setStatus('connected', 'Connected');
      this._setupInput();
      walkieClient.requestMessages();
    });

    walkieClient.on('disconnected', () => {
      console.log('[App] Disconnected');
      this.ui.setStatus('disconnected', 'Disconnected');
      document.getElementById('manual-container').style.display = 'block';
      document.getElementById('input-container').style.display = 'none';
    });

    walkieClient.on('error', () => {
      this.ui.setStatus('error', 'Connection failed');
      document.getElementById('manual-container').style.display = 'block';
    });

    walkieClient.on('new_message', (data) => {
      this.ui.addMessage(data.message);
    });

    walkieClient.on('end', () => {
      this.ui.setStatus('connected', 'Done');
    });

    walkieClient.on('awaiting_input', () => {
      this.ui.setStatus('connected', 'Waiting for input');
    });

    walkieClient.on('question', (data) => {
      this.ui.renderQuestion(data);
      this._setPendingQuestion(data.requestID, data.questions);
    });
  }

  _setPendingQuestion(requestID, questions) {
    this.pendingQuestion = { requestID, questions };
  }

  _setupInput() {
    const textarea = document.getElementById('input-text');
    const button = document.getElementById('input-send');
    const container = document.getElementById('input-container');
    
    container.style.display = 'flex';

    const send = () => {
      const text = textarea.value.trim();
      if (!text) return;

      if (this.pendingQuestion) {
        const { requestID, questions } = this.pendingQuestion;
        this.pendingQuestion = null;
        const answers = questions.map(() => [text]);
        walkieClient.send({ type: 'answer_question', requestID, answers });
        this.ui.addMessage({ role: 'user', content: text, timestamp: Date.now() });
      } else {
        walkieClient.send({ type: 'send_message', content: text });
        this.ui.addMessage({ role: 'user', content: text, timestamp: Date.now() });
      }

      textarea.value = '';
    };

    button.addEventListener('click', send);
    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  new WalkieApp().init();
});

// Unregister service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
