import { WalkieServer } from '../src/server';

describe('WalkieServer', () => {
  let server: WalkieServer;

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
  });

  test('should start server on specified port', async () => {
    server = new WalkieServer();
    const port = await server.start(8765);
    expect(port).toBe(8765);
  });

  test('should generate unique token on start', async () => {
    server = new WalkieServer();
    await server.start(8766);
    const token = server.getToken();
    expect(token).toBeDefined();
    expect(token.length).toBeGreaterThan(10);
  });

  test('should return different tokens for different instances', async () => {
    const server1 = new WalkieServer();
    const server2 = new WalkieServer();
    
    await server1.start(8767);
    await server2.start(8768);
    
    const token1 = server1.getToken();
    const token2 = server2.getToken();
    
    expect(token1).not.toBe(token2);
    
    await server1.stop();
    await server2.stop();
  });

  test('should return actual port when 0 is passed', async () => {
    server = new WalkieServer();
    const port = await server.start(0);
    
    expect(port).toBeGreaterThan(0);
    expect(port).not.toBe(0);
  });
});
