import { getSupabaseAdmin } from '../../lib/supabase'

// Отключаем bodyParser — Telegram шлёт JSON, Next.js сам справится
export const config = {
  api: {
    bodyParser: true,
  },
}

async function sendMessage(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  const url = `https://api.telegram.org/bot${token}/sendMessage`

  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  })
}

export default async function handler(req, res) {
  // Telegram шлёт только POST
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true })
  }

  try {
    const body = req.body
    const message = body?.message

    // Игнорируем всё кроме текстовых сообщений
    if (!message?.text) {
      return res.status(200).json({ ok: true })
    }

    const chatId = message.chat.id
    const text = message.text.trim()

    // Команда /start — приветствие
    if (text === '/start') {
      await sendMessage(
        chatId,
        '🏃 <b>Marathon Skills 2026</b>\n\n' +
        'Привет! Я бот марафона.\n\n' +
        'Отправь мне <b>фамилию</b> участника — и я найду его в базе.\n\n' +
        '<i>Например:</i> <code>Иванов</code>'
      )
      return res.status(200).json({ ok: true })
    }

    // Команда /help
    if (text === '/help') {
      await sendMessage(
        chatId,
        '📋 <b>Как пользоваться ботом:</b>\n\n' +
        '1. Отправь фамилию участника\n' +
        '2. Я найду его в базе данных марафона\n' +
        '3. Покажу имя, роль, страну и ИМТ\n\n' +
        '<i>Регистр не важен: «иванов» = «Иванов»</i>'
      )
      return res.status(200).json({ ok: true })
    }

    // Поиск по фамилии в Supabase
    const db = getSupabaseAdmin()

    const { data, error } = await db
      .from('participants')
      .select('name, surname, role, country, bmi, email')
      .ilike('surname', text)  // ilike = регистронезависимый поиск
      .limit(5)

    if (error) {
      console.error('Supabase error:', error)
      await sendMessage(chatId, '❌ Ошибка базы данных. Попробуй позже.')
      return res.status(200).json({ ok: true })
    }

    if (!data || data.length === 0) {
      await sendMessage(
        chatId,
        `❌ Фамилия «<b>${escapeHtml(text)}</b>» не найдена в базе.\n\n` +
        'Проверь правильность написания или попробуй другую фамилию.'
      )
      return res.status(200).json({ ok: true })
    }

    // Найдено — формируем ответ
    let reply = `✅ Найдено участников: <b>${data.length}</b>\n\n`

    data.forEach((p, i) => {
      reply += `👤 <b>${escapeHtml(p.surname)} ${escapeHtml(p.name)}</b>\n`
      reply += `   🎽 Роль: ${p.role || '—'}\n`
      reply += `   🌍 Страна: ${p.country || '—'}\n`
      if (p.bmi) reply += `   📊 ИМТ: ${p.bmi}\n`
      if (i < data.length - 1) reply += '\n'
    })

    await sendMessage(chatId, reply)
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('Webhook error:', err)
    // Всегда возвращаем 200 — иначе Telegram будет повторять запросы
    return res.status(200).json({ ok: true })
  }
}

function escapeHtml(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
