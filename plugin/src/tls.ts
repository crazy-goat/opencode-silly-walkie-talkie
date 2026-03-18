import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';

const TLS_DIR = path.join(os.homedir(), '.config', 'opencode', 'walkie-tls');
const CERT_PATH = path.join(TLS_DIR, 'cert.pem');
const KEY_PATH = path.join(TLS_DIR, 'key.pem');

export interface TlsCert {
  cert: string;
  key: string;
  certPath: string;
  keyPath: string;
}

export function ensureTlsCert(): TlsCert {
  if (!fs.existsSync(TLS_DIR)) {
    fs.mkdirSync(TLS_DIR, { recursive: true });
    fs.chmodSync(TLS_DIR, 0o700);
  }

  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    try {
      execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 3650 -nodes -subj "/CN=walkie-talkie-local"`,
        { stdio: 'pipe' }
      );
    } catch (err: any) {
      const detail = err.stderr?.toString().trim() ?? err.message;
      throw new Error(`Failed to generate TLS certificate. Is openssl installed? Details: ${detail}`);
    }
    fs.chmodSync(KEY_PATH, 0o600);
  }

  return {
    cert: fs.readFileSync(CERT_PATH, 'utf8'),
    key: fs.readFileSync(KEY_PATH, 'utf8'),
    certPath: CERT_PATH,
    keyPath: KEY_PATH,
  };
}
