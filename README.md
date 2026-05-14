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
