# Калькулятор типографии и широкоформатной печати

Веб-приложение для онлайн-расчёта стоимости полиграфической и широкоформатной продукции с инженерными SVG-схемами, корзиной коммерческих предложений, личным кабинетом клиента, CRM и панелью администратора.

Проект включает:

- каталог полиграфической и широкоформатной продукции с плавной интерактивной анимацией карточек;
- серверный расчёт себестоимости, расхода материалов, налогов и тиражных наценок;
- динамические инженерные SVG-схемы изделий в реальном масштабе;
- корзину, общие ссылки на смету и формирование коммерческих предложений (КП);
- клиентские заказы и производственную CRM с канбан/списочным представлением;
- ролевую модель `client`, `production`, `manager`, `admin`;
- JSON-хранилище для локальной разработки и опциональное MongoDB-хранилище для production;
- CLI-миграцию JSON → MongoDB;
- модульные и интеграционные тесты frontend и backend.

> В проекте нет безопасных production PIN по умолчанию. Перед запуском обязательно задайте секреты через переменные окружения или настройте их в защищённой конфигурации.

---

## Ключевые возможности калькулятора и админ-панели

### Полиграфическая продукция
- Автоматический расчёт раскладки изделий на печатном листе SRA3 с учётом вылетов под обрез и запечатываемого поля.
- Настройка цветности блока и обложки, ламинации, многостраничности, биговки/фальцовки и типа скрепления (скоба с кратноcтью 4 стр., пружина сверху/сбоку, КБС, болты, кольца, шнурок).
- Указание и отображение габаритов полиграфических изделий в **миллиметрах (`мм`)**.

### Широкоформатная печать
- **Размеры в сантиметрах (`см`)**: ввод произвольной ширины и высоты, список форматов, размерные стрелки на SVG-схеме, предупреждение о стыковочном шве рулона, заголовок вкладки и позиции в корзине/КП отображаются в сантиметрах.
- **Учёт рулонов по ширине, длине и цене за 1 м²**: в базе материалов для рулонных носителей (`Баннеры, плёнка и холсты`) задаются **ширина и длина рулона в метрах** (`roll_width_m × roll_length_m`) с автоматическим вычислением площади рулона (`м²`). Поддерживается редактирование **себестоимости за 1 м²**, на основе которой автоматически пересчитывается закупочная цена рулона (и обратный пересчёт при прямом вводе цены рулона). Ширина рулона для расчёта печати и предупреждения о склейке берётся непосредственно из выбранного материала.
- **Гибкая настройка установки люверсов**: при выборе опции «Установка люверсов — Да» отображается выбор расстояния между люверсами: **15, 20, 25, 30, 50 см** или **«По углам»** (4 шт.). Выбранный шаг автоматически пересчитывает количество люверсов и стоимость заказа на сервере.
- **Масштабная SVG-схема баннера**: при включённых люверсах 4 угловых люверса всегда располагаются строго по углам зоны проварки края, а промежуточные люверсы распределяются в едином масштабе 1:1 по обеим осям точно на выбранном расстоянии с аккуратным размером колец и синхронизацией миниатюры активного вида изделия.

### Интерфейс и навигация
- Плавный отклик карточек каталога с мягким увеличением при наведении и деликатным 3D-наклоном до `0.5°` со сглаживанием при перемещении курсора между карточками; кнопки навигации в шапке используют чистое масштабирование без 3D-наклона.
- Поддержка светлой и тёмной темы оформления.

---

## Стек

### Frontend

- React 19
- TypeScript
- Vite 8
- Tailwind CSS 4
- `lucide-react`
- `tsx` + встроенный раннер `node:test`

### Backend

- Python 3.9+
- Flask 3 (модульная архитектура на Blueprints)
- Flask-CORS
- PyMongo для MongoDB-режима
- JSON storage для локального режима и fallback

---

## Архитектура проекта

```text
├── backend/
│   ├── app.py                        # Инициализация Flask-приложения и middleware безопасности
│   ├── wsgi.py                       # Точка входа для production WSGI-сервера
│   ├── core.py                       # Общие утилиты, конфигурация, токены и валидация
│   ├── seed_data.py                  # Начальные справочники категорий, материалов и изделий
│   ├── storage.py                    # JSON storage, нормализация и миграции структуры
│   ├── repository.py                 # MongoDB repository и доменные операции
│   ├── pricing.py                    # Серверная логика расчёта стоимости и расхода материалов
│   ├── routes/
│   │   ├── catalog.py                # Публичный каталог, расчёт стоимости и шаринг корзины
│   │   ├── orders_crm.py             # Заказы клиентов, CRM, статусы и комментарии
│   │   ├── admin_catalog.py          # Управление каталогом, базой материалов и настройками
│   │   └── auth_users.py             # Авторизация, регистрация, профиль и роли пользователей
│   ├── migrate_json_to_mongo.py      # Явная CLI-миграция JSON → MongoDB
│   ├── test_api_blueprints.py        # Интеграционные тесты API и расчётов широкоформата/полиграфии
│   ├── test_repository.py            # Тесты JSON/repository и миграции
│   └── test_repository_mongo.py      # Опциональный live smoke-тест MongoDB
├── data/
│   ├── database.json                 # Локальная runtime-база (не коммитить)
│   ├── database.json.bak             # Автоматический backup предыдущего состояния
│   └── uploads/                      # Загруженные изображения товаров
├── src/
│   ├── app/
│   │   └── AppShell.tsx              # Общая оболочка приложения
│   ├── features/
│   │   ├── auth/useAuth.ts           # Сессии и права доступа
│   │   ├── cart/useEstimateCart.ts   # Корзина и общие сметы
│   │   ├── catalog/useCatalog.ts     # Загрузка и индексация каталога
│   │   └── calculator/useCalculator.ts
│   ├── components/                   # UI-компоненты, калькулятор, SVG-схемы, CRM и админ-панель
│   │   ├── ProductCalculatorView.tsx
│   │   ├── ProductSchematicSVG.tsx   # Векторные схемы изделий и раскладка люверсов
│   │   └── ProductSchematicSVG.test.ts
│   ├── utils/
│   │   ├── wideFormatPricing.ts      # Чистые функции расчёта рулонов и цены за 1 м²
│   │   ├── wideFormatPricing.test.ts
│   │   ├── adaptiveCardTilt.ts       # Сглаженный hover/tilt карточек каталога (0.5°)
│   │   └── adaptiveCardTilt.test.ts
│   ├── App.tsx                       # Композиция экранов и маршрутизация
│   ├── routing.ts                    # Парсинг и генерация URL
│   ├── types.ts                      # Общие TypeScript-типы
│   ├── calculatorUtils.ts            # Чистые функции форматов (мм/см), люверсов и текстов КП
│   ├── calculatorUtils.test.ts
│   └── theme.ts                      # Палитры светлой и тёмной тем
├── dev.mjs                           # Оркестратор локального запуска Flask + Vite
├── vite.config.ts
├── package.json
└── README.md
```

Runtime-данные находятся вне `src/` и не должны попадать в репозиторий. Не публикуйте `data/`, JSON exports, ZIP-архивы с исходниками или production credentials.

---

## Быстрый локальный запуск

Требования:

- Node.js 18+ (рекомендуется 20+);
- Python 3.9+;
- npm;
- виртуальное окружение Python желательно.

### Установка

```bash
npm install
python -m pip install -r backend/requirements.txt
```

### Секрет приложения

`AUTH_SECRET_KEY` обязателен в production и должен содержать минимум 32 символа (`dev.mjs` подставляет локальный ключ только для dev-режима).

PowerShell:

```powershell
$env:AUTH_SECRET_KEY="local-development-secret-with-at-least-32-characters"
```

Bash:

```bash
export AUTH_SECRET_KEY="local-development-secret-with-at-least-32-characters"
```

### Запуск

```bash
npm run dev
```

По умолчанию запускаются:

- Flask API: `http://127.0.0.1:5000`;
- Vite frontend: `http://127.0.0.1:3000`.

Внешний bind для Vite можно включить явно:

```bash
PRINT_CALC_DEV_HOST=0.0.0.0 npm run dev
```

Для Windows PowerShell:

```powershell
$env:PRINT_CALC_DEV_HOST="0.0.0.0"
npm run dev
```

Не используйте development server как production server.

---

## JSON storage

JSON является локальным backend по умолчанию:

```text
DATA_BACKEND=json
```

Путь к данным можно изменить:

```text
PRINT_CALC_DATA_DIR=/path/to/data
```

JSON storage автоматически создаёт `database.json.bak` при сохранении и выполняет безопасную нормализацию схемы при загрузке (включая размеры рулонов и параметры люверсов). Перед обновлением кода сохраняйте всю папку `data/`.

Административный import/export базы сохраняет legacy aggregate format для совместимости. Перед импортом проверяйте backup и содержимое файла.

---

## MongoDB

MongoDB включается явно:

```text
DATA_BACKEND=mongo
MONGODB_URI=mongodb://user:password@host:27017/?tls=true
MONGODB_DATABASE=print_calculator
```

Mongo repository использует отдельные коллекции:

```text
settings
main_categories
categories
material_categories
items
products
users
orders
order_idempotency
rate_limits
counters
```

Основные Mongo-возможности:

- unique index для normalized user email;
- atomic counters для users/orders;
- indexes для users и orders;
- persisted idempotency records;
- TTL rate-limit/idempotency records;
- targeted operations для users и orders;
- JSON snapshot compatibility для migration/import/export.

### Dry-run миграции

Сначала проверьте структуру и counts без записи:

```bash
python backend/migrate_json_to_mongo.py \
  --data-dir data \
  --uri "mongodb://127.0.0.1:27017" \
  --database print_calculator \
  --dry-run
```

Миграция проверяет:

- наличие обязательных разделов;
- типы коллекций;
- duplicate IDs;
- duplicate normalized emails;
- количество записей.

### Live migration

Перед live migration:

1. создайте backup JSON;
2. создайте backup целевой MongoDB;
3. проверьте dry-run;
4. используйте staging database;
5. сравните counts и public catalog;
6. только потом выполняйте migration.

```bash
python backend/migrate_json_to_mongo.py \
  --data-dir data \
  --uri "mongodb://127.0.0.1:27017" \
  --database print_calculator
```

Для непустой базы destructive replacement требует явного `--replace`.

Откат выполняется переключением обратно на:

```text
DATA_BACKEND=json
```

Не запускайте миграцию автоматически при старте Flask.

---

## Роли и авторизация

Поддерживаемые роли:

- `client` — каталог, расчёты и собственные заказы;
- `production` — производственная CRM-роль;
- `manager` — CRM, скидки и коммерческие предложения;
- `admin` — каталог, база материалов, коэффициенты наценки, пользователи, настройки и CRM.

Для production задавайте PIN через защищённые переменные окружения или настройте их через admin workflow. Не храните PIN в frontend bundle, `localStorage` или `sessionStorage`.

`AUTH_SECRET_KEY` обязателен для подписанных auth tokens.

---

## Команды и тестирование

```bash
npm run dev       # Flask + Vite development
npm run lint      # Проверка типов TypeScript (tsc --noEmit)
npm run test      # Модульные тесты frontend (tsx --test)
npm run build     # Production-сборка фронтенда
npm run preview   # Предпросмотр production-сборки
npm run clean     # Очистка папки dist
```

Проверка синтаксиса и тесты backend:

```bash
python -m py_compile backend/*.py backend/routes/*.py
AUTH_SECRET_KEY="test-secret-key-with-at-least-32-characters-long" \
PYTHONPATH=backend python -m unittest backend/test_api_blueprints.py backend/test_repository.py -v
```

PowerShell:

```powershell
$env:AUTH_SECRET_KEY="test-secret-key-with-at-least-32-characters-long"
$env:PYTHONPATH="backend"
python -m unittest backend/test_api_blueprints.py backend/test_repository.py -v
```

---

## Live Mongo smoke test

Smoke test создаёт временную Mongo database и удаляет её после завершения. Он проверяет user/order/idempotency/rate-limit operations.

Bash:

```bash
MONGODB_TEST_URI="mongodb://127.0.0.1:27017" \
PYTHONPATH=backend python -m unittest backend/test_repository_mongo.py -v
```

PowerShell:

```powershell
$env:MONGODB_TEST_URI="mongodb://127.0.0.1:27017"
$env:PYTHONPATH="backend"
python -m unittest backend/test_repository_mongo.py -v
```

Если `MONGODB_TEST_URI` не задан, live smoke test пропускается. Это не означает, что подключение к Mongo было проверено.

---

## Frontend code splitting

Редко используемые разделы загружаются через lazy chunks:

- Auth;
- Admin;
- CRM;
- Client Orders.

Основной каталог и калькулятор загружаются сразу для быстрого первого экрана.

---

## Безопасность и строгий режим HTTPS

Для работы строго по HTTPS за reverse-proxy (Nginx, Caddy, Cloudflare, Cloud Run) задайте в окружении:

```bash
export PRINT_CALC_TRUST_PROXY_HOPS=1
export PRINT_CALC_FORCE_HTTPS=1
export PRINT_CALC_HSTS_MAX_AGE=31536000
export PRINT_CALC_ALLOWED_ORIGINS="https://your-domain.ru"
```

Что включает строгий режим HTTPS:

- `GET` / `HEAD` запросы без `Authorization` по открытому `http://` перенаправляются через `308 Permanent Redirect` на `https://` с защитой от Open Redirect и Host Header Injection;
- мутирующие запросы (`POST`, `PUT`, `PATCH`, `DELETE`) и любые запросы с заголовком `Authorization` по открытому `http://` отклоняются с кодом `403`;
- на всех HTTPS-ответах автоматически выставляются `Strict-Transport-Security: max-age=31536000; includeSubDomains` и `Content-Security-Policy: upgrade-insecure-requests`;
- нешифрованные внешние `http://` источники автоматически исключаются из `PRINT_CALC_ALLOWED_ORIGINS`, а внешние ссылки на макеты и изображения товаров принимаются только по `https://` (локальный трафик `localhost` / `127.0.0.1` сохранён для разработки).

Перед production-публикацией проверьте:

- `AUTH_SECRET_KEY` задан и имеет длину не менее 32 символов;
- `PRINT_CALC_FORCE_HTTPS=1` и `PRINT_CALC_TRUST_PROXY_HOPS` соответствуют числу доверенных прокси;
- credentials не находятся в исходниках или frontend bundle;
- `data/` не публикуется web server;
- ZIP с исходниками отсутствуют в `public/`;
- `PRINT_CALC_ALLOWED_ORIGINS` содержит только `https://`-домены;
- Mongo использует TLS и отдельного least-privilege пользователя;
- JSON/Mongo backups защищены;
- import files валидируются и ограничены по размеру;
- upload directory не позволяет исполнять загруженные файлы;
- Flask development server не используется в production (используйте `backend/wsgi.py` через Gunicorn / Waitress).

Проверка frontend dependencies:

```bash
npm audit --omit=dev
```

---

## Текущий статус

Проект поддерживает постепенную миграцию и эксплуатацию:

1. локальная разработка и fallback — JSON;
2. staging и production target — MongoDB;
3. миграция выполняется отдельной CLI-командой;
4. backend разделён на модульные Flask Blueprints с единым repository boundary;
5. frontend разделён на feature-хуки и покрытые unit-тестами расчётные утилиты (полиграфия, широкоформатные рулоны, люверсы, SVG-схемы);
6. live Mongo verification запускается отдельно через `MONGODB_TEST_URI`.

Перед production cutover обязательно выполните live Mongo smoke test, staging migration и проверку конкурентных сценариев создания пользователей, заказов и idempotency.
