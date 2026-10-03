# Логические последовательности 4–5

Браузерные занятия для детей 4–5 лет. Текущий этап — **W01: инженерный каркас**.
Стартовая страница — техническая заглушка; занятия ещё не реализованы.

## Окружение

- Node.js **24.19.0**, зафиксирован в `.nvmrc`; поддерживаемая ветка — 24.
- Corepack **0.35.0**; pnpm **10.32.1** через `packageManager`.
- Утилиты Python появятся при необходимости и будут использовать `uv`.

```sh
nvm install
nvm use
# Если Corepack отсутствует:
npm install --global corepack@0.35.0
corepack pnpm install --frozen-lockfile
corepack pnpm exec playwright install chromium webkit
corepack pnpm dev
```

Dev: <http://127.0.0.1:5173>. На Linux для браузеров:
`corepack pnpm exec playwright install --with-deps chromium webkit`.
Первичная установка зависимостей и браузеров требует сети.

## Проверки

```sh
corepack pnpm check          # форматирование, lint, unit, typecheck/build, E2E
corepack pnpm test           # Vitest, однократный запуск
corepack pnpm test:watch     # Vitest в режиме наблюдения
corepack pnpm test:e2e       # Chromium, WebKit, iPad Mini emulation
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm format:check
corepack pnpm format         # исправление форматирования
corepack pnpm build
corepack pnpm preview       # просмотр dist после build
```

E2E самостоятельно запускает dev server на `127.0.0.1:4173`; порт должен быть свободен.
CI выполняет ту же команду `check` после frozen install. WebKit и эмуляция iPad
не заменяют ручную проверку настоящего Safari и планшета перед beta.

## Структура

- `src/app` — composition root и стартовая оболочка.
- `src/domain` — будущие чистые модели и проверка ответов.
- `src/content` — будущая загрузка и валидация контента.
- `src/engine` — будущие автоматы занятия и задания.
- `src/renderers`, `src/child-ui` — будущие renderer и общие компоненты.
- `src/audio`, `src/storage`, `src/analytics`, `src/parent`, `src/assets` — зарезервированные модули.
- `tests/e2e` — браузерные smoke-проверки; component smoke рядом с `App`.
- `docs/product-spec.md` — дословная рабочая копия исходной спецификации.
- `docs/decisions` — принятые решения W00 и технические решения W01.
- `docs/stage-reports` — результаты и ограничения этапов.

Домен не зависит от React, storage или renderer. Renderer не сохраняет прогресс.
Контент и сохранения появятся в своих этапах; их контракты сейчас не определяются.

## Границы этапа

В W01 нет бизнес-логики, персональных данных, аналитики, backend, внешних API,
изображений, аудио и service worker. PWA/offline запланированы на W24.
Следующий этап — W02, только после архитектурной приёмки W01.
Рабочее имя package — `logic-kids-4-5`; существующий GitHub remote сохранён.
