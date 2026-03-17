import { generateQRCode } from '../src/qr';

describe('QR Generator', () => {
  test('should generate QR code string for URL and token', async () => {
    const url = 'https://test.ngrok.io';
    const token = 'abc123';
    
    const qr = await generateQRCode(url, token);
    
    expect(qr).toContain('█'); // QR code contains block characters
    expect(qr).toContain('▀');
  });
});
