#!/usr/bin/env bash
# Обновление и перезапуск мессенджера на VPS (Ubuntu/Debian).
# Запуск из корня репозитория: bash deploy/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHAT_URL="https://chat.5-35-88-205.sslip.io"
CHAT_HOST="chat.5-35-88-205.sslip.io"
LIVEKIT_HOST="livekit.5-35-88-205.sslip.io"
NGINX_SITE="messenger"
NGINX_AVAILABLE="/etc/nginx/sites-available/${NGINX_SITE}"
NGINX_ENABLED="/etc/nginx/sites-enabled/${NGINX_SITE}"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARN: %s\n' "$*" >&2; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Не найдена команда: $1" >&2
    exit 1
  }
}

sync_env() {
  log "Синхронизация .env из deploy/env.production"
  cp "$ROOT/deploy/env.production" "$ROOT/.env"
}

git_pull() {
  if [[ ! -d "$ROOT/.git" ]]; then
    return 0
  fi

  log "git pull"
  cd "$ROOT"

  if [[ -n "$(git status --porcelain deploy/ 2>/dev/null)" ]]; then
    warn "Локальные правки в deploy/ будут сброшены (на VPS не редактируйте эти файлы)"
    git checkout -- deploy/ 2>/dev/null || true
  fi

  if ! git pull --ff-only; then
    warn "git pull не удался — продолжаем с текущими файлами"
  fi
}

check_desktop_installer() {
  local installer="$ROOT/frontend/public/downloads/Signal-Desktop-Setup.exe"
  if [[ ! -f "$installer" ]]; then
    warn "Нет $installer — кнопка «Скачать для ПК» не сработает."
    warn "На Windows: cd desktop && npm run dist && npm run publish-installer, затем снова deploy/update.sh"
  fi
}

setup_nginx() {
  if ! command -v nginx >/dev/null 2>&1; then
    warn "nginx не установлен — пропускаем (доступ только по :3020)"
    return 0
  fi

  local conf_src="$ROOT/deploy/nginx-messenger-sslip-full.conf"
  if [[ ! -f "$conf_src" ]]; then
    warn "Нет $conf_src"
    return 0
  fi

  log "nginx: установка конфига sslip"
  sudo cp "$conf_src" "$NGINX_AVAILABLE"
  sudo ln -sf "$NGINX_AVAILABLE" "$NGINX_ENABLED"
  sudo rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

  if [[ ! -f "/etc/letsencrypt/live/${CHAT_HOST}/fullchain.pem" ]]; then
    warn "SSL-сертификат не найден. После первого HTTP-запуска выполните:"
    warn "  sudo certbot --nginx -d ${CHAT_HOST} -d ${LIVEKIT_HOST}"
    warn "Пока можно использовать deploy/nginx-messenger-5-35-88-205-http.conf для HTTP."
  fi

  sudo nginx -t
  sudo systemctl reload nginx || sudo systemctl restart nginx
}

docker_deploy() {
  log "Docker: сборка и запуск"
  require_cmd docker
  if docker compose version >/dev/null 2>&1; then
    COMPOSE="docker compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    COMPOSE="docker-compose"
  else
    echo "Нужен docker compose или docker-compose" >&2
    exit 1
  fi

  COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)

  $COMPOSE --env-file "$ROOT/.env" "${COMPOSE_FILES[@]}" build --pull
  $COMPOSE --env-file "$ROOT/.env" "${COMPOSE_FILES[@]}" up -d --remove-orphans --force-recreate
  $COMPOSE --env-file "$ROOT/.env" "${COMPOSE_FILES[@]}" ps

  log "Проверка переменных backend"
  $COMPOSE --env-file "$ROOT/.env" "${COMPOSE_FILES[@]}" exec -T backend sh -c \
    'echo APP_ORIGIN=$APP_ORIGIN; echo LIVEKIT_PUBLIC_URL=$LIVEKIT_PUBLIC_URL' || \
    warn "Не удалось прочитать env из контейнера backend"
}

health_hint() {
  log "Готово"
  echo "  Сайт:     ${CHAT_URL}"
  echo "  LiveKit:  wss://${LIVEKIT_HOST}"
  echo "  Локально: curl -sI ${CHAT_URL} | head -1"
  echo "  Логи:     docker compose logs -f --tail=80"
}

main() {
  log "Deploy Signal → ${CHAT_URL}"
  sync_env
  git_pull
  check_desktop_installer
  docker_deploy
  setup_nginx
  health_hint
}

main "$@"
