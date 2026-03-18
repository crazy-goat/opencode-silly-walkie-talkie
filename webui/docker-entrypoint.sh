#!/bin/sh
set -e

if [ ! -f /etc/walkie-tls/cert.pem ] || [ ! -f /etc/walkie-tls/key.pem ]; then
  echo ""
  echo "ERROR: TLS certificates not found."
  echo ""
  echo "Run OpenCode once to auto-generate them, or generate manually:"
  echo ""
  echo "  mkdir -p ~/.config/opencode/walkie-tls"
  echo "  openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \\"
  echo "    -keyout ~/.config/opencode/walkie-tls/key.pem \\"
  echo "    -out ~/.config/opencode/walkie-tls/cert.pem \\"
  echo "    -subj /CN=walkie-talkie-local"
  echo ""
  exit 1
fi

cp /etc/walkie-tls/cert.pem /etc/nginx/ssl.crt
cp /etc/walkie-tls/key.pem /etc/nginx/ssl.key

HOST_GATEWAY=$(ip route | awk '/default/ {print $3; exit}')
echo "Host gateway: $HOST_GATEWAY"

awk -v gw="$HOST_GATEWAY" '{gsub(/\$\{HOST_GATEWAY\}/, gw)}1' \
  /etc/nginx/nginx-template.conf > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
