# Marathon Skills 2026 — Next.js + Google Auth + Supabase

## Структура проекта

```
marathon-app/
├── pages/
│   ├── _app.js                      # SessionProvider
│   ├── index.js                     # Главная страница (весь UI)
│   ├── login.js                     # Страница входа через Google
│   └── api/
│       ├── auth/[...nextauth].js    # NextAuth (Google OAuth)
│       └── participants/
│           ├── index.js             # GET (список) + POST (создание)
│           └── [id].js              # PUT (редактирование) + DELETE
├── lib/
│   └── supabase.js                  # Supabase клиент
├── styles/
│   └── globals.css
├── supabase_schema.sql              # SQL для создания таблиц
├── package.json
└── next.config.js
```

---

## Шаг 1 — Supabase

1. Зайди на [supabase.com](https://supabase.com), создай **новый проект**
2. В разделе **SQL Editor** выполни содержимое файла `supabase_schema.sql`
3. В разделе **Settings → API** скопируй:
   - `Project URL` → это `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → это `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → это `SUPABASE_SERVICE_ROLE_KEY`

---

## Шаг 2 — Google OAuth

1. Зайди в [Google Cloud Console](https://console.cloud.google.com/)
2. Создай проект → **APIs & Services → Credentials**
3. **Create Credentials → OAuth 2.0 Client ID**
4. Application type: **Web application**
5. Добавь Authorized redirect URIs:
   ```
   https://ВАШ_ДОМЕН.vercel.app/api/auth/callback/google
   http://localhost:3000/api/auth/callback/google
   ```
6. Скопируй `Client ID` и `Client Secret`

---

## Шаг 3 — Переменные окружения в Vercel

В Vercel → твой проект → **Settings → Environment Variables** добавь:

| Имя переменной | Значение |
|---|---|
| `DATABASE_URL` | `postgresql://...` (из Supabase Settings → Database) |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon ключ Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role ключ Supabase |
| `GOOGLE_CLIENT_ID` | Client ID из Google Console |
| `GOOGLE_CLIENT_SECRET` | Client Secret из Google Console |
| `NEXTAUTH_SECRET` | Случайная строка (генерируй: `openssl rand -base64 32`) |
| `NEXTAUTH_URL` | `https://ВАШ_ДОМЕН.vercel.app` |

---

## Шаг 4 — Деплой

### Вариант A: через GitHub
```bash
git init
git add .
git commit -m "Marathon Skills 2026"
git remote add origin https://github.com/ТВО_НИК/marathon-skills.git
git push -u origin main
```
Затем в Vercel: **New Project → Import from GitHub**

### Вариант B: через Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

---

## Локальная разработка

Создай файл `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
NEXTAUTH_SECRET=любая_случайная_строка
NEXTAUTH_URL=http://localhost:3000
```

```bash
npm install
npm run dev
```

---

## Функциональность

- ✅ Вход только через Google (OAuth 2.0)
- ✅ Имя и фото пользователя в шапке
- ✅ Защищённые маршруты (без авторизации → /login)
- ✅ Supabase PostgreSQL как база данных
- ✅ API через Vercel Serverless Functions (`/api/participants`)
- ✅ Все запросы к БД проверяют `user_id` из сессии
- ✅ CRUD участников: создание, просмотр, редактирование, удаление
- ✅ ИМТ калькулятор с сохранением в БД
- ✅ Фильтрация, поиск, сортировка, пагинация
- ✅ Роли: Бегун / Координатор
- ✅ Admin-панель (логин: admin / пароль: admin123)
- ✅ Таймер обратного отсчёта до марафона
- ✅ Загрузка фото участников

---

## Таблица participants в Supabase

| Поле | Тип | Описание |
|---|---|---|
| id | UUID | Первичный ключ |
| owner_id | TEXT | Google user ID (привязка к пользователю) |
| email | TEXT | Email участника |
| name | TEXT | Имя |
| surname | TEXT | Фамилия |
| gender | TEXT | Пол |
| role | TEXT | Бегун / Координатор |
| country | TEXT | Страна |
| dob | DATE | Дата рождения |
| bmi | NUMERIC | Индекс массы тела |
| photo | TEXT | Фото (base64) |
| created_at | TIMESTAMPTZ | Дата создания |
| updated_at | TIMESTAMPTZ | Дата изменения |

---

## Шаг 5 — Telegram-бот + ИИ

### Переменные окружения (добавить в Vercel)

| Имя переменной | Где взять |
|---|---|
| `TELEGRAM_BOT_TOKEN` | @BotFather → `/newbot` |
| `TELEGRAM_ADMIN_CHAT_ID` | Написать боту `/start`, затем `https://api.telegram.org/bot<TOKEN>/getUpdates` |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `CRON_SECRET` | Любая случайная строка (необязательно) |

### Таблица bot_sessions в Supabase

Выполни в SQL Editor (уже добавлено в `supabase_schema.sql`):

```sql
CREATE TABLE IF NOT EXISTS bot_sessions (
  chat_id    TEXT PRIMARY KEY,
  mode       TEXT,
  reg_step   TEXT,
  reg_data   JSONB DEFAULT '{}',
  bmi_data   JSONB DEFAULT '{}',
  ai_msgs    JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Почему это нужно:** Vercel — serverless, каждый запрос может попасть в новый контейнер.
Состояния регистрации, ИИ-диалога, поиска хранились в памяти (`const regState = {}`),
поэтому между сообщениями они сбрасывались. Теперь состояния хранятся в Supabase.

### Регистрация webhook

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://ВАШ_ДОМЕН.vercel.app/api/telegram-webhook"}'
```

### Supabase Database Webhook (уведомления в реальном времени)

1. Supabase → **Database → Webhooks → Create a new hook**
2. Name: `notify_new_participant`
3. Table: `participants`, Event: `INSERT`
4. HTTP POST URL: `https://ВАШ_ДОМЕН.vercel.app/api/telegram-webhook`
5. HTTP Headers: `Content-Type: application/json`

### Ежедневная статистика

Настроена в `vercel.json` — каждый день в 09:00 UTC вызывает `/api/cron-daily-stats`.
Требует план Vercel **Hobby** (бесплатный поддерживает cron).
