#!/usr/bin/env bash
# Сборка Windows-установщика на Linux (Docker + Wine). Вызывается из deploy/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DESKTOP_DIR="$ROOT/desktop"
INSTALLER="$ROOT/frontend/public/downloads/Signal-Desktop-Setup.exe"
IMAGE="${ELECTRON_BUILDER_IMAGE:-electronuserland/builder:wine}"
PRODUCTION_URL="${MESSENGER_URL:-https://chat.5-35-88-205.sslip.io}"

log() { printf '  %s\n' "$*"; }

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker не найден — нельзя собрать desktop на сервере" >&2
  exit 1
fi

if [[ ! -f "$DESKTOP_DIR/package.json" ]]; then
  echo "Нет $DESKTOP_DIR/package.json" >&2
  exit 1
fi

log "Образ: $IMAGE"
log "URL desktop: $PRODUCTION_URL"

mkdir -p "$ROOT/frontend/public/downloads"

# root в контейнере — после сборки поправим права на release/ и downloads/
docker run --rm \
  -v "$ROOT:/project" \
  -v messenger-electron-cache:/root/.cache \
  -w /project/desktop \
  -e MESSENGER_URL="$PRODUCTION_URL" \
  -e CSC_IDENTITY_AUTO_DISCOVERY=false \
  "$IMAGE" \
  bash -lc 'set -euo pipefail
    npm ci
    npm run release
  '

if [[ ! -f "$INSTALLER" ]]; then
  echo "Сборка завершилась, но не найден $INSTALLER" >&2
  exit 1
fi

if command -v chown >/dev/null 2>&1; then
  owner="$(stat -c '%u:%g' "$ROOT" 2>/dev/null || echo "")"
  if [[ -n "$owner" ]]; then
    chown -R "$owner" "$DESKTOP_DIR/release" "$ROOT/frontend/public/downloads" 2>/dev/null || true
  fi
fi

log "Готово: $INSTALLER ($(du -h "$INSTALLER" | cut -f1))"
