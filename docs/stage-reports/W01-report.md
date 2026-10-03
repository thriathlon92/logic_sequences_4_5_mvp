# W01 — Каркас репозитория и инженерные проверки

Status: READY_FOR_REVIEW  
Дата: 2026-10-03

## Реализовано

- React + TypeScript strict + Vite, статическая стартовая заглушка.
- Все каталоги раздела 12.1; будущие модули содержат только .gitkeep.
- ESLint, Prettier, Vitest, Playwright и единая команда `corepack pnpm check`.
- CI для push/PR: frozen install, браузеры, check, артефакты при сбое.
- Node 24.19.0, Corepack 0.35.0, pnpm 10.32.1; точные версии и lockfile.
- README, дословная копия спецификации, три ADR.

## Изменённые файлы

- `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.npmrc`.
- `index.html`, `src/main.tsx`, `src/app/App.tsx`, `src/app/styles.css`.
- `src/{domain,content,engine,renderers,audio,storage,analytics,parent,child-ui,assets}/.gitkeep`.
- `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `playwright.config.ts`.
- `.editorconfig`, `.gitignore`, `.prettierrc.json`, `.prettierignore`.
- `src/app/App.test.tsx`, `tests/setup.ts`, `tests/e2e/shell.spec.ts`.
- `.github/workflows/ci.yml`, `README.md`, `docs/product-spec.md`.
- `docs/decisions/ADR-0001-stack.md`, `ADR-0002-devices.md`, `ADR-0003-stage-scope.md`.
- Этот отчёт. Исходная спецификация не изменялась.

## Проверки и доказательства

- Чистая копия без node_modules: `install --frozen-lockfile --offline` — PASS,
  238 пакетов из локального store; до этого пакеты загружены из публичного npm.
- На Node 24.19.0 в чистой копии `corepack pnpm check` — PASS:
  форматирование, lint, 1 component smoke, strict typecheck, build, 3 E2E.
- E2E: Chromium, Desktop WebKit, iPad Mini WebKit. Проверены dev server,
  заголовок, русский язык документа, перезагрузка, отсутствие горизонтального
  скролла и browser console warnings/errors.
- Production build: JS 220.07 kB / gzip 68.92 kB, CSS 0.62 kB.
- `cmp` исходной спецификации и `docs/product-spec.md` — идентичны.

## Решения и ограничения

- Область — только W01; приоритет явных решений W00/раздела 27.
- pnpm 12 обращался к недоступному системному registry при загрузке своей
  зависимости. Зафиксирован работоспособный pnpm 10.32.1; `.npmrc` задаёт
  публичный npm только для этого проекта.
- TypeScript 6.0.3 совместим с typescript-eslint; TypeScript 7 не выбран
  из-за несовместимого peer range. ESLint 10 проходит lint без предупреждений.
- Для запуска браузеров и локального порта потребовался выход из песочницы.
- Shell вне проекта выбирал Node 26: итоговая чистая проверка выполнена
  с явно заданным PATH на Node 24.19.0. Предварительная проверка на 26 тоже
  прошла, но версия 26 не входит в поддерживаемую матрицу.
- Node печатает служебное предупреждение о NO_COLOR/FORCE_COLOR из окружения
  запуска; браузерная консоль чистая.
- CI подготовлен, но на GitHub не запускался. Физический iPad и настоящий
  Safari вручную не проверялись. Ручная визуальная приёмка остаётся архитектору.

## Не реализовано

Задания, прогресс, контентные схемы, аналитика, backend, финальная графика,
озвучка, PWA/offline и UX следующих этапов — вне W01.

## Внешние действия

Прочитана официальная документация Vite и Playwright. Скачаны pnpm,
npm-зависимости и браузеры Playwright. GitHub MCP не подключался, remote
не изменялся; push, issue, PR и deployment не создавались.

## Вопросы архитектору

Блокирующих вопросов для W01 нет. Расхождения спецификации перечислены в ADR-0003.
Требуется архитектурная приёмка W01 перед W02 по разделу 21.2 спецификации.
