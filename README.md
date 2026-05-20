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
3. Собирает и перезапускает `docker compose`
4. Подключает nginx-конфиг `deploy/nginx-messenger-sslip-full.conf` и перезагружает nginx

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

### Кнопка «Скачать для ПК»

Установщик собирается **на Windows**, затем снова деплой:

```powershell
# в репозитории на ПК
powershell -ExecutionPolicy Bypass -File deploy/build-desktop.ps1
# залить frontend/public/downloads/Signal-Desktop-Setup.exe на сервер (git/rsync)
bash deploy/update.sh
```

Установленный desktop по умолчанию открывает `https://chat.5-35-88-205.sslip.io`.

## Конфигурация

| Файл | Назначение |
|------|------------|
| `deploy/env.production` | URL для Docker на VPS |
| `deploy/nginx-messenger-sslip-full.conf` | HTTPS + прокси chat/livekit |
| `deploy/update.sh` | Автообновление на сервере |
| `deploy/build-desktop.ps1` | Сборка exe с прод-URL |

Подробнее про desktop: [desktop/README.md](desktop/README.md)
