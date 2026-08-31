#!/bin/bash
# Point a domain at the app, optionally with Let's Encrypt TLS.
#
#   ./setup-domain.bash earnival.app --ssl
#
# Adapted from hoo-socials-infra/scripts/nginx_scripts/setup-backend-domain.bash.
set -euo pipefail

DOMAIN="${1:-}"
SSL=false
for arg in "$@"; do [ "$arg" = "--ssl" ] && SSL=true; done

if [ -z "$DOMAIN" ] || [ "$DOMAIN" = "--ssl" ]; then
  echo "Usage: $0 <domain> [--ssl]"; exit 1
fi

UPSTREAM="http://127.0.0.1:3000"
CONF="/etc/nginx/sites-available/${DOMAIN}"

echo "→ writing ${CONF}"
sudo tee "$CONF" >/dev/null <<CONFIG
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};

    # Ticket badges are bearer credentials — never cache them, never index them.
    location ~ ^/(t|find)/ {
        proxy_pass ${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        add_header Cache-Control "no-store, max-age=0" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
    }

    location / {
        proxy_pass ${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 60s;
    }

    # Paystack posts here. The signature is verified against the raw body, so
    # nothing may rewrite it in transit.
    location /api/webhooks/ {
        proxy_pass ${UPSTREAM};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_request_buffering on;
        client_max_body_size 1m;
    }

    client_max_body_size 12m;   # image uploads
}
CONFIG

sudo ln -sfn "$CONF" "/etc/nginx/sites-enabled/${DOMAIN}"
sudo nginx -t
sudo systemctl reload nginx
echo "✓ nginx serving ${DOMAIN}"

if [ "$SSL" = true ]; then
  echo "→ certificate"
  command -v certbot >/dev/null || sudo apt-get install -y certbot python3-certbot-nginx
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    -m "admin@${DOMAIN}" --redirect
  echo "✓ https://${DOMAIN}"
fi
