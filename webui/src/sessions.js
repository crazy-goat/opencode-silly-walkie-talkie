function toProxyUrl(wsUrl) {
  try {
    const parsed = new URL(wsUrl);
    const port = parsed.port;
    const token = parsed.pathname.replace(/^\//, '');
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const path = token ? `/ws/${port}/${token}` : `/ws/${port}/`;
    return `${scheme}://${location.host}${path}`;
  } catch {
    return wsUrl;
  }
}
