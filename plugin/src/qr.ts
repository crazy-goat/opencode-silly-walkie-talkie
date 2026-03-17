import * as QRCode from 'qrcode';

export async function generateQRCode(url: string, token: string): Promise<string> {
  const fullUrl = `${url}?token=${token}`;
  
  try {
    // Generate terminal-friendly QR code
    const qr = await QRCode.toString(fullUrl, {
      type: 'terminal',
      small: true,
    });
    
    return qr;
  } catch (err) {
    console.error('[Walkie-Talkie] Failed to generate QR:', err);
    // Fallback: just return the URL
    return `Scan this URL:\n${fullUrl}`;
  }
}

export function displayQRCode(qr: string): void {
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  📱 Scan with Walkie-Talkie PWA    │');
  console.log('└─────────────────────────────────────┘');
  console.log(qr);
  console.log('');
}
