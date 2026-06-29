#!/usr/bin/env bash
# Обновление и перезапуск мессенджера на VPS (Ubuntu/Debian).
# Запуск из корня репозитория: bash deploy/update.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CHAT_URL="https://chat.5-35-88-205.sslip.io"
CHAT_HOST="chat.5-35-88-205.sslip.io"
LIVEKIT_HOST="livekit.5-35-88-205.sslip.io"
DESKTOP_DIR="$ROOT/desktop"
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
  if [[ -f "$ROOT/.env" ]]; then
    log ".env уже существует — не перезаписываем (сохраняем секреты)"
    return 0
  fi
  log "Создание .env из deploy/env.production (первый запуск)"
  cp "$ROOT/deploy/env.production" "$ROOT/.env"
}

env_value() {
  local key="$1"
  awk -v key="$key" '
    $0 ~ "^[[:space:]]*" key "=" {
      line = $0
      sub(/\r$/, "", line)
      sub(/^[[:space:]]*[^=]*=/, "", line)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      print line
      exit
    }
  ' "$ROOT/.env"
}

env_has_value() {
  local key="$1"
  [[ -n "$(env_value "$key")" ]]
}

validate_smtp_env() {
  local required=(SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASSWORD SMTP_FROM)
  local missing=()
  local any_set=0
  local smtp_password=""

  for key in "${required[@]}"; do
    if env_has_value "$key"; then
      any_set=1
    else
      missing+=("$key")
    fi
  done

  if [[ "$any_set" -eq 0 ]]; then
    warn "SMTP не настроен (.env: SMTP_* пустые) — письма с кодами не будут отправляться"
    warn "Если хотите включить SMTP, заполните: ${required[*]}"
    return 0
  fi

  if [[ ${#missing[@]} -gt 0 ]]; then
    warn "SMTP заполнен частично. Пустые обязательные поля: ${missing[*]}"
    warn "Исправьте .env и повторите: bash deploy/update.sh"
    return 1
  fi

  smtp_password="$(env_value SMTP_PASSWORD)"
  case "$(printf '%s' "$smtp_password" | tr '[:upper:]' '[:lower:]')" in
    change-me|changeme|password|12345678|123456789|qwerty123)
      warn "SMTP_PASSWORD выглядит как шаблонный/слабый пароль (${smtp_password})"
      warn "Укажите реальный пароль почтового ящика в .env и повторите deploy"
      return 1
      ;;
  esac
  if [[ ${#smtp_password} -lt 8 ]]; then
    warn "SMTP_PASSWORD слишком короткий (${#smtp_password} символов)"
    warn "Укажите корректный пароль почтового ящика в .env и повторите deploy"
    return 1
  fi

  log "SMTP: конфигурация заполнена (SMTP_HOST/SMTP_USER/SMTP_FROM/SMTP_PASSWORD)"
}

git_pull() {
  if [[ ! -d "$ROOT/.git" ]]; then
    return 0
  fi

  log "git fetch origin"
  cd "$ROOT"

  if [[ -n "$(git status --porcelain deploy/ 2>/dev/null)" ]]; then
    warn "Локальные правки в deploy/ будут сброшены (на VPS не редактируйте эти файлы)"
    git checkout -- deploy/ 2>/dev/null || true
  fi

  if ! git fetch origin; then
    warn "git fetch не удался — продолжаем с текущими файлами"
    return 0
  fi

  local local_head remote_head
  local_head="$(git rev-parse HEAD 2>/dev/null || true)"
  remote_head="$(git rev-parse origin/main 2>/dev/null || true)"

  if [[ -z "$local_head" || -z "$remote_head" ]]; then
    warn "не удалось сравнить HEAD с origin/main — продолжаем с текущими файлами"
    return 0
  fi

  if [[ "$local_head" == "$remote_head" ]]; then
    log "репозиторий уже на актуальном коммите origin/main"
    return 0
  fi

  if git merge-base --is-ancestor "$local_head" "$remote_head"; then
    log "fast-forward до origin/main"
    git merge --ff-only origin/main
    return 0
  fi

  warn "ветка на VPS разошлась с origin/main — сброс на origin/main (локальные коммиты на сервере будут потеряны)"
  git reset --hard origin/main
}

DESKTOP_INSTALLER="$ROOT/frontend/public/downloads/Signal-Desktop-Setup.exe"
DESKTOP_STAMP="$ROOT/deploy/.desktop-build-stamp"

should_build_desktop() {
  if [[ "${SKIP_DESKTOP_BUILD:-}" == "1" ]]; then
    return 1
  fi
  if [[ "${FORCE_DESKTOP_BUILD:-}" == "1" ]]; then
    return 0
  fi
  if [[ ! -f "$DESKTOP_INSTALLER" ]]; then
    return 0
  fi

  if [[ -d "$ROOT/.git" ]]; then
    local before after
    before="$(git rev-parse HEAD@{1} 2>/dev/null || true)"
    after="$(git rev-parse HEAD 2>/dev/null || true)"
    if [[ -n "$before" && -n "$after" && "$before" != "$after" ]]; then
      if git diff --name-only "$before" "$after" | grep -qE '^(desktop/|frontend/public/pwa-)'; then
        return 0
      fi
    fi
  fi

  if find "$DESKTOP_DIR/electron" "$DESKTOP_DIR/scripts" "$DESKTOP_DIR/package.json" "$DESKTOP_DIR/package-lock.json" \
    -type f -newer "$DESKTOP_INSTALLER" 2>/dev/null | head -1 | grep -q .; then
    return 0
  fi
x 
  return 1
}

build_desktop_installer() {
  if ! should_build_desktop; then
    log "Desktop: пересборка не нужна (изменений в desktop/ нет)"
    return 0
  fi

  log "Desktop: сборка Windows .exe в Docker (10–20 мин при первом запуске)"
  require_cmd docker

  if bash "$ROOT/deploy/build-desktop-docker.sh"; then
    git rev-parse HEAD >"$DESKTOP_STAMP" 2>/dev/null || date -Iseconds >"$DESKTOP_STAMP"
    log "Desktop: установщик обновлён → frontend/public/downloads/"
    return 0
  fi

  warn "Сборка desktop на сервере не удалась"
  check_desktop_installer
  return 1
}

check_desktop_installer() {
  if [[ ! -f "$DESKTOP_INSTALLER" ]]; then
    warn "Нет $DESKTOP_INSTALLER — кнопка «Скачать для ПК» не сработает."
    warn "Повторите: FORCE_DESKTOP_BUILD=1 bash deploy/update.sh"
    warn "Или соберите на Windows: powershell deploy/release-windows.ps1"
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
    'echo APP_ORIGIN=$APP_ORIGIN; echo LIVEKIT_PUBLIC_URL=$LIVEKIT_PUBLIC_URL; echo SMTP_HOST=$SMTP_HOST; echo SMTP_USER=$SMTP_USER' || \
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
  build_desktop_installer || true
  check_desktop_installer
  validate_smtp_env
  docker_deploy
  setup_nginx
  health_hint
}

main "$@"
