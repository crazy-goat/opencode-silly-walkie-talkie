// Main application logic
class WalkieApp {
  constructor() {
    this.ui = new WalkieUI();
    this.scanner = null;
    this.isWorking = false;
  }

  init() {
    console.log('[App] Initializing Walkie-Talkie...');
    
    // Setup event listeners
    this._setupClientListeners();
    
    // Start QR scanner
    this._startScanner();
  }

  _setupClientListeners() {
    // Connection events
    walkieClient.on('connected', () => {
      console.log('[App] Connected to plugin');
      this.ui.setStatus('connected', 'Connected');
      this.ui.hideScanner();
      
      // Request message history
      walkieClient.requestMessages();
    });

    walkieClient.on('disconnected', () => {
      console.log('[App] Disconnected');
      this.ui.setStatus('disconnected', 'Disconnected - reconnecting...');
      this.isWorking = false;
    });

    walkieClient.on('error', (data) => {
      console.error('[App] Connection error:', data);
      this.ui.setStatus('error', 'Connection error');
    });

    // Data events
    walkieClient.on('heartbeat', () => {
      // Heartbeat received, connection is alive
      if (this.isWorking) {
        this.ui.setStatus('working', 'LLM is working...');
      }
    });

    walkieClient.on('new_message', (data) => {
      console.log('[App] New message:', data);
      this.ui.addMessage(data.message);
      this.isWorking = true;
      this.ui.setStatus('working', 'LLM is working...');
    });

    walkieClient.on('end', () => {
      console.log('[App] LLM finished');
      this.isWorking = false;
      this.ui.setStatus('connected', 'Done ✓');
      
      // Play notification sound (optional)
      this._playNotificationSound();
    });

    walkieClient.on('messages', (data) => {
      console.log('[App] Received messages:', data);
      this.ui.renderMessages(data.messages);
    });

    walkieClient.on('awaiting_input', () => {
      console.log('[App] Awaiting input');
      this.ui.setStatus('connected', 'Waiting for your input');
      this._showInputDialog();
    });
  }

  _startScanner() {
    this.ui.setStatus('connecting', 'Scan QR code to connect');
    
    this.scanner = new QRScanner('qr-reader', (result) => {
      console.log('[App] QR scanned:', result);
      walkieClient.connect(result.url, result.token);
    });

    this.scanner.start();
  }

  _playNotificationSound() {
    // Simple beep using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (err) {
      console.warn('[App] Could not play sound:', err);
    }
  }

  _showInputDialog() {
    // Simple prompt for now
    // In production, you'd show a proper input UI
    const input = prompt('LLM is waiting for your response:');
    if (input) {
      walkieClient.send({
        type: 'send_message',
        content: input,
      });
    }
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new WalkieApp();
  app.init();
});

// Register service worker (minimal)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js')
    .then(reg => console.log('[App] Service Worker registered'))
    .catch(err => console.log('[App] Service Worker registration failed:', err));
}
