## uiKit

Эта папка — **переносимый публичный слой UI**, который можно импортировать в другом проекте.
Сейчас внутри лежат **реэкспорты** существующих компонентов/ассетов/темы, чтобы:

- иметь **стабильные импорты** вида `uiKit/...` (не завися от исходной структуры `Components/*`)
- переносить UI частями (иконки → атомы → экраны), не ломая текущий проект

### Что физически лежит внутри `src/uiKit/`

- `src/uiKit/Components/**` — копия всех UI-компонентов
- `src/uiKit/assets/**` — копия ассетов (включая `Icons/*`)
- `src/uiKit/Theme.js` — тема (Material-UI v4 + CSS variables)
- `src/uiKit/TelegramApp.css`, `src/uiKit/index.css` — базовые стили

### Что уже экспортируется (публичный API)

#### Иконки
`src/uiKit/icons/index.js` реэкспортирует все иконки из `src/Assets/Icons/*`.

Пример:

```js
import { Icons } from '../uiKit';

function SendButton() {
  return <Icons.Send />;
}
```

#### Кнопки
`src/uiKit/buttons/index.js`

- `Buttons.CallBlobButton` → `src/Components/Calls/Button.js`

#### Экраны/страницы
`src/uiKit/screens/index.js`

- `Screens.MainPage`
- `Screens.InactivePage`
- `Screens.NativeAppPage`
- `Screens.SidebarPage`

#### Тема
`src/uiKit/theme/index.js`

- `Theme.withAppTheme` → `src/Theme.js` (Material-UI v4 ThemeProvider + CSS variables `--*`)

#### Ассеты
`src/uiKit/assets/index.js`

- `Assets.TelegramLogo` (`src/Assets/telegram-logo.svg`)
- `Assets.Bubbles` (`src/Assets/Bubbles.svg`)
- `Assets.BubbleTailLeft` (`src/Assets/bubble-tail-left.svg`)

### Как перенести UI в другой проект (минимальный чеклист)

1. **Зависимости**
   - `react@16+`
   - `@material-ui/core@4`, `@material-ui/icons@4`, `@material-ui/lab@4` (если используете компоненты, которые от них зависят)
   - `classnames` (часто встречается в компонентах)
2. **CSS**
   - в текущем проекте UI активно использует глобальные CSS и CSS-переменные из `Theme.js`.
   - при переносе подключите базовые стили (`src/index.css`, `src/TelegramApp.css` и css-файлы конкретных компонентов, которые переносите).
3. **Theme Provider**
   - оберните корневой компонент в `Theme.withAppTheme` (внутри это `src/uiKit/Theme.js`).

Пример интеграции:

```js
import React from 'react';
import { Theme, Screens } from './uiKit';

function App() {
  return <Screens.MainPage />;
}

export default Theme.withAppTheme(App);
```

### Важно про “экраны”

`MainPage` и похожие страницы зависят не только от UI, но и от:
- `Stores/*`
- `Actions/*`
- `TdLibController`

То есть они переносятся как “feature/UI” вместе с логикой. Если цель — чистый UI-kit,
то следующие кандидаты на выделение в `uiKit` — это атомарные компоненты (`Tile/*`, базовые кнопки, иконки, элементы ввода),
которые не тянут TDLib/Stores.

### Дальше

Следующий шаг — собрать список “чистых” компонентов без зависимости от `Stores/Controllers`,
и перенести/реэкспортировать их в `uiKit` по слоям:

- `uiKit/atoms` (Button, Icon, Avatar, Badge…)
- `uiKit/molecules` (InputBox части, Search bar…)
- `uiKit/organisms` (Dialog list items, message tiles…)
- `uiKit/screens` (только если вы готовы тянуть сторы/действия)

