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
        () => {
          // Ignore scan errors (no QR in frame)
        }
      );

      this.isScanning = true;
      console.log('[QRScanner] Started');
    } catch (err) {
      console.error('[QRScanner] Failed to start:', err);
    }
  }

  _onScanSuccess(decodedText) {
    console.log('[QRScanner] Code detected:', decodedText);
    this.stop();
    // Pass the ws:// URL directly to app
    this.onScan({ wsUrl: decodedText.trim() });
  }

  async stop() {
    if (this.html5QrCode && this.isScanning) {
      await this.html5QrCode.stop();
      this.isScanning = false;
      console.log('[QRScanner] Stopped');
    }
  }
}
