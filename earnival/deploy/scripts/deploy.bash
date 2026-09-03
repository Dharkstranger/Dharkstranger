#!/bin/bash
# Deploy the current branch to the provisioned box.
#
# Adapted from hoo-socials-infra/scripts/deploy_scripts. Runs migrations before
# the build so a schema change never serves against an old schema.
set -euo pipefail

APP_DIR=/srv/earnival
APP_USER=earnival
BRANCH="${1:-main}"

echo "→ fetching ${BRANCH}"
sudo -u "$APP_USER" git -C "$APP_DIR/src" fetch --all --prune
sudo -u "$APP_USER" git -C "$APP_DIR/src" reset --hard "origin/${BRANCH}"

cd "$APP_DIR/src/earnival"

echo "→ installing"
sudo -u "$APP_USER" npm ci --omit=dev --no-audit --no-fund

echo "→ migrating"
# DIRECT_DATABASE_URL, not the pooled one — poolers cannot run migrations.
sudo -u "$APP_USER" --preserve-env=PATH env $(grep -v '^#' "$APP_DIR/.env" | xargs -d '\n') \
  npx prisma migrate deploy

echo "→ building"
sudo -u "$APP_USER" env $(grep -v '^#' "$APP_DIR/.env" | xargs -d '\n') \
  npm run build

echo "→ restarting"
sudo systemctl restart earnival
sleep 3

echo "→ health"
curl -fsS http://127.0.0.1:3000/api/health || {
  echo "FAILED — last 40 log lines:"; sudo journalctl -u earnival -n 40 --no-pager; exit 1;
}
echo
echo "✓ deployed"
