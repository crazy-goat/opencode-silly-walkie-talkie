import { startNgrokTunnel } from '../src/ngrok';

jest.mock('@ngrok/ngrok', () => ({
  connect: jest.fn().mockResolvedValue({
    url: () => 'https://abc123.ngrok-free.app',
    disconnect: jest.fn(),
  }),
}));

describe('Ngrok Integration', () => {
  test('should return public URL for local port', async () => {
    const url = await startNgrokTunnel(8765);
    expect(url).toBe('https://abc123.ngrok-free.app');
  });
});
