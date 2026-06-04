import { getSupabaseAdmin } from '../../lib/supabase'

export const config = {
  api: { bodyParser: true },
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN

async function sendMessage(chatId, text, keyboard = null) {
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
  }
  if (keyboard) body.reply_markup = keyboard

  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mainKeyboard() {
  return {
    keyboard: [
      ['🔍 Найти по фамилии', '🔍 Найти по имени'],
      ['📋 Как зарегистрироваться?', '❓ Что такое марафон?'],
      ['🌐 Открыть сайт марафона'],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  }
}

function escapeHtml(str) {
  if (!str) return '—'
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Хранилище ожидания ввода (в памяти, для serverless достаточно)
// Используем глобальный объект — живёт пока жив инстанс
const waitingFor = {}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    const message = req.body?.message
    if (!message?.text) return res.status(200).json({ ok: true })

    const chatId = message.chat.id
    const text = message.text.trim()

    // ── /start ──────────────────────────────────────────────────
    if (text === '/start' || text === '/help') {
      delete waitingFor[chatId]
      await sendMessage(
        chatId,
        '🏃 <b>Marathon Skills 2026</b>\n\n' +
        'Привет! Я помогу найти участника марафона или ответить на вопросы.\n\n' +
        'Выбери действие на клавиатуре ниже 👇',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    // ── Кнопка: Сайт ────────────────────────────────────────────
    if (text === '🌐 Открыть сайт марафона') {
      await sendMessage(
        chatId,
        '🌐 Сайт марафона:\nhttps://marathon-vercel-superbase.vercel.app',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    // ── Кнопка: Как зарегистрироваться ──────────────────────────
    if (text === '📋 Как зарегистрироваться?') {
      delete waitingFor[chatId]
      await sendMessage(
        chatId,
        '📋 <b>Как зарегистрироваться на марафон:</b>\n\n' +
        '1. Перейди на сайт:\n<a href="https://marathon-vercel-superbase.vercel.app">marathon-vercel-superbase.vercel.app</a>\n\n' +
        '2. Нажми кнопку <b>«Войти через Google»</b>\n\n' +
        '3. Войди через свой Google-аккаунт\n\n' +
        '4. Нажми кнопку <b>«✚ Зарегистрировать»</b>\n\n' +
        '5. Заполни форму: имя, фамилия, пол, роль (Бегун / Координатор), страна\n\n' +
        '6. Нажми <b>«Зарегистрироваться»</b> — готово! ✅\n\n' +
        '<i>Марафон пройдёт 15 июня 2026 года · 42.195 км</i>',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    // ── Кнопка: Что такое марафон ────────────────────────────────
    if (text === '❓ Что такое марафон?') {
      delete waitingFor[chatId]
      await sendMessage(
        chatId,
        '🏅 <b>Marathon Skills 2026</b>\n\n' +
        'Марафон — забег на дистанцию <b>42,195 км</b>.\n\n' +
        '📅 Дата: <b>15 июня 2026</b>\n' +
        '📍 Место: Алматы\n\n' +
        '<b>Роли участников:</b>\n' +
        '🏃 <b>Бегун</b> — непосредственно участвует в забеге\n' +
        '📋 <b>Координатор</b> — организует и помогает участникам\n\n' +
        'Для участия нужно зарегистрироваться на сайте через Google-аккаунт.',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    // ── Кнопка: Найти по фамилии ─────────────────────────────────
    if (text === '🔍 Найти по фамилии') {
      waitingFor[chatId] = 'surname'
      await sendMessage(chatId, '✏️ Введи <b>фамилию</b> участника:', { remove_keyboard: true })
      return res.status(200).json({ ok: true })
    }

    // ── Кнопка: Найти по имени ───────────────────────────────────
    if (text === '🔍 Найти по имени') {
      waitingFor[chatId] = 'name'
      await sendMessage(chatId, '✏️ Введи <b>имя</b> участника:', { remove_keyboard: true })
      return res.status(200).json({ ok: true })
    }

    // ── Обработка поиска ─────────────────────────────────────────
    const searchMode = waitingFor[chatId] || 'surname' // по умолчанию ищем по фамилии
    delete waitingFor[chatId]

    const db = getSupabaseAdmin()
    const field = searchMode === 'name' ? 'name' : 'surname'

    const { data, error } = await db
      .from('participants')
      .select('name, surname, role, country, bmi, gender')
      .ilike(field, `%${text}%`)
      .limit(5)

    if (error) {
      console.error('Supabase error:', error)
      await sendMessage(chatId, '❌ Ошибка базы данных. Попробуй позже.', mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (!data || data.length === 0) {
      await sendMessage(
        chatId,
        `❌ По запросу «<b>${escapeHtml(text)}</b>» никого не найдено.\n\n` +
        'Проверь правильность написания.',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    let reply = `✅ Найдено: <b>${data.length}</b> участник(ов)\n\n`
    data.forEach((p) => {
      const gender = p.gender === 'Женский' ? '👩' : '👨'
      reply += `${gender} <b>${escapeHtml(p.surname)} ${escapeHtml(p.name)}</b>\n`
      reply += `   🎽 ${p.role || '—'} · 🌍 ${p.country || '—'}`
      if (p.bmi) reply += ` · 📊 ИМТ: ${p.bmi}`
      reply += '\n\n'
    })

    await sendMessage(chatId, reply.trim(), mainKeyboard())
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(200).json({ ok: true })
  }
}
