class QRScanner {
  constructor(containerId, onScan) {
    this.containerId = containerId;
    this.onScan = onScan;
    this.html5QrCode = null;
    this.isScanning = false;
  }

  async start() {
    const container = document.getElementById(this.containerId);
    if (!container) {
      console.error('[QRScanner] Container not found:', this.containerId);
      return;
    }

    this.html5QrCode = new Html5Qrcode(this.containerId);

    try {
      await this.html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        (decodedText) => {
          this._onScanSuccess(decodedText);
        },
        (errorMessage) => {
          // Ignore scan errors (no QR in frame)
        }
      );

      this.isScanning = true;
      console.log('[QRScanner] Started');
    } catch (err) {
      console.error('[QRScanner] Failed to start:', err);
      this._showPermissionError();
    }
  }

  _onScanSuccess(decodedText) {
    console.log('[QRScanner] QR Code detected:', decodedText);
    
    // Parse URL and token
    try {
      const url = new URL(decodedText);
      const token = url.searchParams.get('token');
      
      if (!token) {
        console.error('[QRScanner] No token in QR code');
        return;
      }

      // Stop scanning
      this.stop();

      // Call callback
      this.onScan({
        url: decodedText.split('?')[0],
        token: token,
      });
    } catch (err) {
      console.error('[QRScanner] Invalid QR code format:', err);
    }
  }

  _showPermissionError() {
    const container = document.getElementById(this.containerId);
    if (container) {
      container.innerHTML = `
        <div class="qr-error">
          <p>Camera access denied. Please:</p>
          <ol>
            <li>Allow camera access in your browser</li>
            <li>Or enter URL manually:</li>
          </ol>
          <input type="text" id="manual-url" placeholder="wss://xxx.ngrok.io?token=...">
          <button id="manual-connect">Connect</button>
        </div>
      `;

      document.getElementById('manual-connect').addEventListener('click', () => {
        const input = document.getElementById('manual-url');
        this._onScanSuccess(input.value);
      });
    }
  }

  async stop() {
    if (this.html5QrCode && this.isScanning) {
      await this.html5QrCode.stop();
      this.isScanning = false;
      console.log('[QRScanner] Stopped');
    }
  }
}
