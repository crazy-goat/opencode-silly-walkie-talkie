import * as os from 'os';

export function getLocalIp(): string {
  const interfaces = os.networkInterfaces();
  const all: string[] = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      if (/^(docker|br-|veth|virbr|vmnet|vbox)/.test(name)) continue;
      if (/^172\.(1[6-9]|2\d|3[01])\./.test(addr.address)) continue;
      all.push(addr.address);
    }
  }

  return all[0] ?? 'localhost';
}

export function getLocalNetworkUrl(port: number): string {
  return `https://${getLocalIp()}:${port}`;
}
