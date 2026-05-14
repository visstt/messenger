# MVP мессенджера

Это MVP мессенджера на `React + Go + Postgres`, собранное по [Messenger_Mvp_Technical_Spec.md](./Messenger_Mvp_Technical_Spec.md) и UX-ориентирам из [telegram_screens_detailed.md](./telegram_screens_detailed.md).

## Что реализовано

- регистрация и вход;
- профиль пользователя;
- поиск пользователей;
- личные чаты 1 на 1;
- текстовые сообщения;
- отправка изображений;
- отправка голосовых сообщений;
- базовые realtime-события через WebSocket;
- отметка прочтения сообщений;
- редактирование и удаление своих текстовых сообщений;
- запуск через `docker compose` одной командой.

## Технологический стек

- frontend: React + Vite + Nginx;
- backend: Go + Chi + WebSocket;
- база данных: PostgreSQL.

## Запуск

```bash
docker compose up --build
```

После запуска будут доступны:

- приложение: `http://localhost:3020`;
- healthcheck backend: `http://localhost:9080/healthz`.

## HTTPS, камера и микрофон

Браузеры открывают `getUserMedia` (камера, микрофон, видеокружки) только в **безопасном контексте**: **HTTPS** или `localhost`. Если открыть приложение по `http://IP-сервера/`, `navigator.mediaDevices` может быть недоступен — запрос разрешения не появится.

На сервере обычно делают **nginx на хосте** с TLS (Let’s Encrypt / **certbot**) и проксируют на контейнер (`3020` для фронта). Для **звонков LiveKit** с HTTPS-страницы нужен **`wss://`** (часто отдельный поддомен с тем же или SAN-сертификатом). Пример конфига и шаги: [`deploy/host-nginx-messenger.example.conf`](./deploy/host-nginx-messenger.example.conf).

Переменные для продакшена (скопируйте [`.env.example`](./.env.example) в `.env` и подставьте домены):

- `APP_ORIGIN` — точный URL приложения в браузере, например `https://chat.example.com`;
- `LIVEKIT_PUBLIC_URL` — URL для клиента LiveKit, например `wss://livekit.example.com` (должен совпадать с тем, что отдаёт бэкенд в токене звонка).

Кратко по certbot (Debian/Ubuntu), когда nginx уже смотрит на ваш домен и проксирует на `127.0.0.1:3020`:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d chat.example.com -d livekit.example.com
```

Дальше `sudo nginx -t && sudo systemctl reload nginx`. Продление: `sudo certbot renew` (часто уже в cron).

## Демо-аккаунты

- `alice / alice12345`;
- `bob / bob12345`.

## Структура проекта

- [frontend](./frontend)
- [backend](./backend)
- [Messenger_Mvp_Technical_Spec.md](./Messenger_Mvp_Technical_Spec.md)
- [telegram_screens_detailed.md](./telegram_screens_detailed.md)

## Ограничения текущей версии

- вместо полной модели доставки сообщений используется упрощённый статус `sent/read`;
- нет групп, каналов, push-уведомлений и сквозного шифрования;
- вложения хранятся локально в Docker volume;
- интерфейс покрывает MVP-срез, а не весь объём Telegram-подобного продукта.
