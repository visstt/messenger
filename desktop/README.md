# Signal Desktop (Electron)

Настольное приложение для мессенджера Signal: открывает веб-клиент в окне Electron, сворачивается в **system tray**, показывает **всплывающие уведомления снизу справа** (как в Telegram) и позволяет **включать/выключать уведомления** из меню трея.

## Возможности

- Окно приложения с вашим мессенджером (тот же интерфейс, что в браузере)
- Закрытие крестиком **сворачивает в трей**, а не завершает процесс
- **Двойной клик по иконке в трее** — показать окно
- Меню трея:
  - **Открыть Signal**
  - **Скрыть окно**
  - **Уведомления** (вкл/выкл)
  - **Выход**
- Toast-уведомления в правом нижнем углу экрана при новых сообщениях (если окно свёрнуто, скрыто или не в фокусе)
- Клик по уведомлению открывает чат

## Требования

- **Node.js 20+**
- Запущенный backend + frontend мессенджера (например через Docker Compose в корне репозитория)

## Быстрый старт (разработка)

### 1. Запустите сервер мессенджера

В корне репозитория:

```bash
docker compose up --build
```

По умолчанию веб-интерфейс: **http://localhost:3020**

### 2. Установите зависимости desktop-клиента

```bash
cd desktop
npm install
```

### 3. Запустите Electron

```bash
# Windows PowerShell
$env:MESSENGER_URL="http://localhost:3020"
npm start
```

Или скопируйте `.env.example` в `.env` и задайте `MESSENGER_URL` (переменная читается через `process.env` при запуске).

```bash
npm start
```

## Иконка приложения

Иконка берётся из PWA (`frontend/public/pwa-512.svg`):

```bash
npm run icons
```

Создаёт:
- `icon.ico` — иконка окна и установщика;
- `tray.ico` — иконка в системном трее (16/32 px, обязательно для Windows);
- `icon.png`, `tray-16.png`, `tray-32.png`.

Команда `npm run dist` автоматически вызывает `icons` перед сборкой.

## Сборка установщика для Windows

```bash
cd desktop
npm install
npm run dist
```

Готовый установщик появится в папке `desktop/release/` (файл `Signal Setup *.exe`).

Чтобы кнопка **«Скачать для ПК»** на сайте отдавала установщик:

```bash
npm run publish-installer
```

Файл копируется в `frontend/public/downloads/Signal-Desktop-Setup.exe` и раздаётся вместе с фронтендом.

> Первая сборка скачивает Electron (~150 MB). Нужен интернет.

### Ошибка «Cannot create symbolic link» при `npm run dist`

На Windows electron-builder иногда падает при распаковке `winCodeSign` (нужны права на симлинки).

**Иконка на панели задач (ярлык Electron вместо Signal):** Windows берёт иконку из `Signal.exe`. При `signAndEditExecutable: false` electron-builder не встраивает её сам — после упаковки срабатывает `scripts/after-pack.cjs` (rcedit). Перед `npm run dist` **закройте запущенный Signal**, иначе сборка или rcedit выдадут `Access is denied` / `Unable to commit changes`.

**Решение 1 (рекомендуется):** в проекте уже отключена подпись кода (`signAndEditExecutable: false`). Очистите кэш и соберите снова:

```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign" -ErrorAction SilentlyContinue
cd desktop
npm run dist
```

**Решение 2:** явно отключить поиск сертификата:

```powershell
npm run dist:unsigned
```

**Решение 3:** собрать portable-версию без установщика (часто проходит без winCodeSign):

```powershell
npm run pack
# Запуск: desktop\release\win-unpacked\Signal.exe
```

**Решение 4:** включить **Режим разработчика** в Windows  
Параметры → Конфиденциальность и безопасность → Для разработчиков → **Режим разработчика** — затем снова `npm run dist`.

## Настройка URL сервера

| Способ | Пример |
|--------|--------|
| Переменная окружения | `MESSENGER_URL=https://chat.example.com npm start` |
| Файл настроек Electron | После первого запуска: `%APPDATA%\messenger-desktop\config.json` → поле `serverUrl` |

Для локальной разработки с Vite (порт 3000):

```bash
MESSENGER_URL=http://localhost:3000 npm start
```

Убедитесь, что backend доступен на `9080`, а Vite проксирует `/api`, `/ws`, `/uploads`.

## Уведомления

1. В трее включите пункт **«Уведомления»** (галочка).
2. Сверните или скройте окно приложения.
3. При входящем сообщении появится плашка **внизу справа** экрана.
4. Клик по плашке открывает окно и переходит в нужный чат.

Уведомления **не показываются**, если окно мессенджера активно и в фокусе (как в Telegram).

## Структура проекта

```
desktop/
  electron/
    main.js          — главный процесс, трей, toast-окна
    preload.cjs      — мост для веб-приложения
    toast.html       — UI всплывающего уведомления
    toast-preload.cjs
  assets/            — иконка (опционально icon.png)
  package.json
  README.md
```

## Интеграция с веб-клиентом

В браузере используется Web Notifications API. В Electron веб-клиент определяет `window.messengerDesktop` и отправляет уведомления в главный процесс (`frontend/src/utils/browserNotifications.js`).

## Частые проблемы

### Белое окно / не загружается

- Проверьте, что `MESSENGER_URL` открывается в обычном браузере.
- Для Docker: `http://localhost:3020`, не `3000`.

### Нет уведомлений

- Включите **Уведомления** в меню трея.
- Окно должно быть **не в фокусе** (свернуто или за другими окнами).
- Войдите в аккаунт в приложении.

### WebSocket не подключается на удалённом сервере

- Сервер должен отдавать приложение по **HTTPS/WSS** или корректно проксировать `ws`.
- Укажите полный публичный URL в `MESSENGER_URL`.

## Автозапуск с Windows (опционально)

После установки через `npm run dist` ярлык можно добавить в автозагрузку:

`Win + R` → `shell:startup` → ярлык на `Signal.exe`.

Или в настройках Windows: **Приложения → Автозагрузка**.
