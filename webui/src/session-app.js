class SessionApp {
  constructor() {
    this.ui = new WalkieUI();
    this.client = new WalkieClient();
    this._inputSetup = false;
  }

  init() {
    document.getElementById('back-btn').addEventListener('click', () => {
      this.client.disconnect();
      window.location.href = 'index.html';
    });

    const params = new URLSearchParams(window.location.search);
    const wsUrl = params.get('wsUrl');

    if (!wsUrl || (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://'))) {
      this.ui.setStatus('error', 'Invalid session URL');
      return;
    }

    this._setupListeners();
    this._connect(wsUrl);
  }

  _connect(wsUrl) {
    this.ui.setStatus('connecting', 'Connecting...');
    this.client.connectUrl(toProxyUrl(wsUrl));
  }

  _setupListeners() {
    this.client.on('connected', () => {
      this.ui.setStatus('connected', 'Connected');
      this._setupInput();
      this.client.requestMessages();
    });

    this.client.on('disconnected', () => {
      this.ui.setStatus('disconnected', 'Disconnected');
      document.getElementById('input-container').style.display = 'none';
    });

    this.client.on('error', () => {
      this.ui.setStatus('error', 'Connection failed');
    });

    this.client.on('messages', (data) => {
      this.ui.renderMessages(data.messages || []);
    });

    this.client.on('new_message', (data) => {
      this.ui.addMessage(data.message);
    });

    this.client.on('end', () => {
      this.ui.setStatus('connected', 'Done');
    });

    this.client.on('awaiting_input', () => {
      this.ui.setStatus('connected', 'Waiting for input');
    });
  }

  _setupInput() {
    if (this._inputSetup) return;
    this._inputSetup = true;
    const textarea = document.getElementById('input-text');
    const button = document.getElementById('input-send');
    const micBtn = document.getElementById('mic-btn');
    const container = document.getElementById('input-container');

    container.style.display = 'flex';

    const stopMic = this._setupMic(micBtn, textarea);

    const send = () => {
      const text = textarea.value.trim();
      if (!text) return;
      stopMic();
      this.client.send({ type: 'send_message', content: text });
      this.ui.addMessage({ role: 'user', content: text, timestamp: Date.now() });
      textarea.value = '';
    };

    button.addEventListener('click', send);
    textarea.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });
  }

  _setupMic(micBtn, textarea) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      micBtn.style.display = 'none';
      return () => {};
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || 'en-US';

    let listening = false;
    let baseText = '';

    recognition.onstart = () => {
      listening = true;
      micBtn.innerHTML = '<span aria-hidden="true">🔴</span>';
      micBtn.setAttribute('aria-label', 'Stop recording');
      baseText = textarea.value;
    };

    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map(r => r[0].transcript).join('');
      textarea.value = baseText + (baseText && !baseText.endsWith(' ') ? ' ' : '') + transcript;
    };

    recognition.onend = () => {
      listening = false;
      micBtn.innerHTML = '<span aria-hidden="true">🎤</span>';
      micBtn.setAttribute('aria-label', 'Voice input');
    };

    recognition.onerror = () => {
      listening = false;
      micBtn.innerHTML = '<span aria-hidden="true">🎤</span>';
      micBtn.setAttribute('aria-label', 'Voice input');
    };

    micBtn.addEventListener('click', () => {
      if (listening) {
        recognition.stop();
      } else {
        recognition.start();
      }
    });

    return () => { if (listening) recognition.stop(); };
  }
}

document.addEventListener('DOMContentLoaded', () => new SessionApp().init());
