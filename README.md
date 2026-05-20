# Signal Messenger

Веб-мессенджер + desktop (Electron). Продакшен: [https://chat.5-35-88-205.sslip.io](https://chat.5-35-88-205.sslip.io/)

## Локально (разработка)

```bash
docker compose up --build
```

Сайт: http://localhost:3020

## Деплой на VPS (обновление одной командой)

На сервере (Ubuntu/Debian), в каталоге проекта:

```bash
chmod +x deploy/update.sh
bash deploy/update.sh
```

Скрипт:

1. Копирует `deploy/env.production` → `.env` (домен, LiveKit, IP ICE)
2. Делает `git pull` (если репозиторий под git)
3. **Собирает Windows `.exe` на сервере** (Docker + Wine), если менялся `desktop/` или нет установщика
4. Собирает и перезапускает `docker compose` (сайт + кнопка «Скачать для ПК»)
5. Подключает nginx-конфиг `deploy/nginx-messenger-sslip-full.conf` и перезагружает nginx

Переменные для деплоя:

| Переменная | Значение |
|------------|----------|
| `FORCE_DESKTOP_BUILD=1` | Всегда пересобрать `.exe` |
| `SKIP_DESKTOP_BUILD=1` | Не собирать desktop (быстрый деплой только сайта) |

### Первый запуск на чистом сервере

```bash
# Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin git nginx certbot python3-certbot-nginx

# Клон / обновление проекта
cd /path/to/messenger
bash deploy/update.sh

# SSL (один раз), если сертификата ещё нет:
sudo certbot --nginx -d chat.5-35-88-205.sslip.io -d livekit.5-35-88-205.sslip.io
bash deploy/update.sh
```

Порты compose: frontend **3020**, backend **9080**, LiveKit **7880** (проксируются nginx).

### Desktop (.exe)

Обычно **не нужно** собирать на ПК: `bash deploy/update.sh` на сервере сам соберёт установщик в Docker.

Локально (опционально):

```powershell
powershell -ExecutionPolicy Bypass -File deploy/release-windows.ps1
```

После деплоя пользователи **переустанавливают** Signal из «Скачать для ПК» на сайте.

### Если на сервере в API/звонках всё ещё `localhost`

На VPS обязательно `bash deploy/update.sh` — скрипт пересоздаёт контейнеры и печатает `APP_ORIGIN` / `LIVEKIT_PUBLIC_URL`. Должно быть `https://chat...` и `wss://livekit...`, не `localhost`.

## Конфигурация

| Файл | Назначение |
|------|------------|
| `deploy/env.production` | URL для Docker на VPS |
| `deploy/nginx-messenger-sslip-full.conf` | HTTPS + прокси chat/livekit |
| `deploy/update.sh` | Автообновление на сервере |
| `deploy/build-desktop-docker.sh` | Сборка exe на Linux (Wine) |
| `deploy/build-desktop.ps1` | Сборка exe на Windows (опционально) |

Подробнее про desktop: [desktop/README.md](desktop/README.md)
