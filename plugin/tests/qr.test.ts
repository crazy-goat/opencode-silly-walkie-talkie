import { generateQRCode } from '../src/qr';

describe('QR Generator', () => {
  test('should generate QR code string for URL', async () => {
    const url = 'https://192.168.1.1:38579';
    
    const qr = await generateQRCode(url);
    
    expect(qr).toContain('█'); // QR code contains block characters
    expect(qr).toContain('▀');
  });
});
