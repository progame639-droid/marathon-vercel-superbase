import { getSupabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: true } }

const TOKEN          = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID  = process.env.TELEGRAM_ADMIN_CHAT_ID
const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// ─── Telegram helpers ────────────────────────────────────────────────────────

async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (keyboard) body.reply_markup = keyboard
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  return r.json()
}

function mainKeyboard(isAdmin) {
  const rows = [
    ['✚ Зарегистрироваться на марафон'],
    ['🔍 Найти по фамилии', '🔍 Найти по имени'],
    ['📊 Статистика', '❓ Что такое марафон?'],
    ['📋 Как зарегистрироваться?', '🌐 Открыть сайт'],
    ['🤖 Спросить ИИ'],
  ]
  if (isAdmin) rows.push(['⚖️ Калькулятор ИМТ (Админ)', '📨 Статистика сейчас'])
  return { keyboard: rows, resize_keyboard: true }
}

function cancelKeyboard() {
  return { keyboard: [['❌ Отмена']], resize_keyboard: true }
}

function escapeHtml(str) {
  if (!str) return '—'
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function calcBMI(weight, height) {
  const bmi = weight / ((height / 100) ** 2)
  let category, emoji
  if (bmi < 18.5)      { category = 'Недостаточный вес'; emoji = '⚠️' }
  else if (bmi < 25)   { category = 'Норма';             emoji = '✅' }
  else if (bmi < 30)   { category = 'Избыточный вес';    emoji = '⚠️' }
  else                 { category = 'Ожирение';           emoji = '🔴' }
  return { bmi: parseFloat(bmi.toFixed(1)), category, emoji }
}

// ─── Persistent session state via Supabase ───────────────────────────────────
// Replaces in-memory objects (regState / waitingFor / bmiState / aiState)
// which reset on every Vercel cold start.
//
// Table DDL (run once in Supabase SQL Editor):
//   CREATE TABLE IF NOT EXISTS bot_sessions (
//     chat_id   TEXT PRIMARY KEY,
//     mode      TEXT,                 -- 'reg' | 'bmi' | 'ai' | 'surname' | 'name' | null
//     reg_step  TEXT,                 -- numeric step or named step string
//     reg_data  JSONB DEFAULT '{}',
//     bmi_data  JSONB DEFAULT '{}',
//     ai_msgs   JSONB DEFAULT '[]',   -- last N turns [{role,content}]
//     updated_at TIMESTAMPTZ DEFAULT NOW()
//   );

async function getSession(db, chatId) {
  const { data } = await db
    .from('bot_sessions')
    .select('*')
    .eq('chat_id', String(chatId))
    .single()
  return data || { chat_id: String(chatId), mode: null, reg_step: null, reg_data: {}, bmi_data: {}, ai_msgs: [] }
}

async function saveSession(db, chatId, patch) {
  const row = { chat_id: String(chatId), updated_at: new Date().toISOString(), ...patch }
  await db.from('bot_sessions').upsert(row, { onConflict: 'chat_id' })
}

async function clearSession(db, chatId) {
  await db.from('bot_sessions').upsert(
    { chat_id: String(chatId), mode: null, reg_step: null, reg_data: {}, bmi_data: {}, ai_msgs: [], updated_at: new Date().toISOString() },
    { onConflict: 'chat_id' }
  )
}

// ─── Registration flow ───────────────────────────────────────────────────────

const REG_STEPS = ['name', 'surname', 'email', 'gender', 'role', 'country']

async function startRegistration(db, chatId) {
  await saveSession(db, chatId, { mode: 'reg', reg_step: '0', reg_data: {} })
  await sendMessage(chatId,
    '📝 <b>Регистрация на марафон</b>\n\nШаг 1 из 6 — Введи своё <b>имя</b>:',
    cancelKeyboard()
  )
}

async function handleReg(db, chatId, text, sess, isAdmin) {
  let { reg_step, reg_data } = sess
  reg_data = reg_data || {}

  // Numeric steps 0-5
  const numStep = parseInt(reg_step, 10)
  if (!isNaN(numStep) && numStep < REG_STEPS.length) {
    const field = REG_STEPS[numStep]
    if (field === 'email' && !text.includes('@')) {
      await sendMessage(chatId, '❌ Неверный email. Попробуй ещё раз:', cancelKeyboard())
      return
    }
    reg_data[field] = text
    const nextStep = numStep + 1
    const next = REG_STEPS[nextStep]

    if (next === 'gender') {
      await saveSession(db, chatId, { reg_step: String(nextStep), reg_data })
      await sendMessage(chatId, `Шаг ${nextStep + 1} из 6 — Выбери <b>пол</b>:`,
        { keyboard: [['Мужской', 'Женский'], ['❌ Отмена']], resize_keyboard: true })
    } else if (next === 'role') {
      await saveSession(db, chatId, { reg_step: String(nextStep), reg_data })
      await sendMessage(chatId, `Шаг ${nextStep + 1} из 6 — Выбери <b>роль</b>:`,
        { keyboard: [['Бегун', 'Координатор'], ['❌ Отмена']], resize_keyboard: true })
    } else if (next === 'country') {
      await saveSession(db, chatId, { reg_step: String(nextStep), reg_data })
      await sendMessage(chatId, `Шаг ${nextStep + 1} из 6 — Введи <b>страну</b>:`, cancelKeyboard())
    } else if (!next) {
      await saveSession(db, chatId, { reg_step: 'bmi_ask', reg_data })
      await sendMessage(chatId,
        '📊 Хочешь рассчитать <b>ИМТ</b>? Это необязательно.',
        { keyboard: [['📊 Рассчитать ИМТ', '⏭ Пропустить'], ['❌ Отмена']], resize_keyboard: true }
      )
    } else {
      await saveSession(db, chatId, { reg_step: String(nextStep), reg_data })
      const label = next === 'surname' ? 'фамилию' : next === 'email' ? 'email' : next
      await sendMessage(chatId, `Шаг ${nextStep + 1} из 6 — Введи <b>${label}</b>:`, cancelKeyboard())
    }
    return
  }

  if (reg_step === 'bmi_ask') {
    if (text === '📊 Рассчитать ИМТ') {
      await saveSession(db, chatId, { reg_step: 'bmi_weight', reg_data })
      await sendMessage(chatId, '⚖️ Введи свой <b>вес</b> в кг (например: <code>72</code>):', cancelKeyboard())
    } else {
      reg_data.bmi = null
      await saveSession(db, chatId, { reg_step: 'confirm', reg_data })
      await showConfirm(chatId, reg_data)
    }
    return
  }

  if (reg_step === 'bmi_weight') {
    const w = parseFloat(text)
    if (isNaN(w) || w < 30 || w > 300) {
      await sendMessage(chatId, '❌ Некорректный вес:', cancelKeyboard()); return
    }
    reg_data._weight = w
    await saveSession(db, chatId, { reg_step: 'bmi_height', reg_data })
    await sendMessage(chatId, '📏 Введи свой <b>рост</b> в см:', cancelKeyboard())
    return
  }

  if (reg_step === 'bmi_height') {
    const h = parseFloat(text)
    if (isNaN(h) || h < 100 || h > 250) {
      await sendMessage(chatId, '❌ Некорректный рост:', cancelKeyboard()); return
    }
    const { bmi, category, emoji } = calcBMI(reg_data._weight, h)
    delete reg_data._weight
    reg_data.bmi = bmi
    await sendMessage(chatId, `${emoji} Твой ИМТ: <b>${bmi}</b> — ${category}`)
    await saveSession(db, chatId, { reg_step: 'confirm', reg_data })
    await showConfirm(chatId, reg_data)
    return
  }
}

async function showConfirm(chatId, d) {
  await sendMessage(chatId,
    `✅ <b>Проверь данные:</b>\n\n` +
    `👤 ${escapeHtml(d.name)} ${escapeHtml(d.surname)}\n` +
    `📧 ${escapeHtml(d.email)}\n` +
    `⚥ ${escapeHtml(d.gender)}\n` +
    `🎽 ${escapeHtml(d.role)}\n` +
    `🌍 ${escapeHtml(d.country)}\n` +
    `📊 ИМТ: ${d.bmi ?? '—'}\n\nВсё верно?`,
    { keyboard: [['✅ Подтвердить', '❌ Отмена']], resize_keyboard: true }
  )
}

// ─── AI Chat (Google Gemini) ──────────────────────────────────────────────────

async function askAI(db, chatId, userText, sess) {
  // Load history from session, append new user message
  const history = Array.isArray(sess.ai_msgs) ? sess.ai_msgs : []
  const newHistory = [...history, { role: 'user', content: userText }]

  // Get live stats
  let statsContext = ''
  try {
    const { data } = await db.from('participants').select('role, country, bmi')
    if (data) {
      const total = data.length
      const runners = data.filter(p => p.role === 'Бегун').length
      const coords  = data.filter(p => p.role === 'Координатор').length
      const bmis = data.map(p => p.bmi).filter(Boolean)
      const avg = bmis.length ? (bmis.reduce((a,b)=>a+b,0)/bmis.length).toFixed(1) : '—'
      statsContext = `Текущая статистика: всего ${total} участников (бегунов: ${runners}, координаторов: ${coords}), средний ИМТ: ${avg}.`
    }
  } catch (e) {}

  const systemInstruction =
    `Ты — ИИ-ассистент марафона Marathon Skills 2026 (Алматы, 15 июня 2026, 42,195 км).\n` +
    `Отвечай кратко, по делу, на русском языке. Ты знаешь всё о марафоне, подготовке, питании, ИМТ.\n` +
    `${statsContext}`

  // Convert to Gemini format: role 'assistant' → 'model'
  const geminiContents = newHistory.slice(-8).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 400, temperature: 0.7 },
        }),
      }
    )
    const data = await r.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || '...'

    // Save updated history (keep last 16 messages)
    const updatedHistory = [...newHistory, { role: 'assistant', content: reply }].slice(-16)
    await saveSession(db, chatId, { mode: 'ai', ai_msgs: updatedHistory })

    return reply
  } catch (e) {
    return '❌ ИИ временно недоступен. Попробуй позже.'
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    // ── Server-side notifications (from website / import) ─────────
    if (req.body?.type === 'new_participant') {
      if (ADMIN_CHAT_ID) {
        const p = req.body.participant
        await sendMessage(ADMIN_CHAT_ID,
          `🎉 <b>Новый участник с сайта!</b>\n\n` +
          `👤 <b>${escapeHtml(p.surname)} ${escapeHtml(p.name)}</b>\n` +
          `🎽 ${p.role || '—'} · 🌍 ${p.country || '—'}\n📧 ${p.email || '—'}`
        )
      }
      return res.status(200).json({ ok: true })
    }

    if (req.body?.type === 'bulk_import') {
      if (ADMIN_CHAT_ID) {
        await sendMessage(ADMIN_CHAT_ID,
          `📥 <b>Массовый импорт завершён!</b>\n\n` +
          `✅ Добавлено участников: <b>${req.body.count}</b>\n` +
          `👤 Импортировал: ${escapeHtml(req.body.user)}`
        )
      }
      return res.status(200).json({ ok: true })
    }

    // ── Supabase Database Webhook ─────────────────────────────────
    if (req.body?.type === 'INSERT' && req.body?.table === 'participants') {
      if (ADMIN_CHAT_ID) {
        const p = req.body.record
        await sendMessage(ADMIN_CHAT_ID,
          `🔔 <b>[Supabase Webhook] Новый участник!</b>\n\n` +
          `👤 <b>${escapeHtml(p?.surname)} ${escapeHtml(p?.name)}</b>\n` +
          `🎽 ${p?.role || '—'} · 🌍 ${p?.country || '—'}\n📧 ${p?.email || '—'}`
        )
      }
      return res.status(200).json({ ok: true })
    }

    // ── Telegram message ──────────────────────────────────────────
    const message = req.body?.message
    if (!message?.text) return res.status(200).json({ ok: true })

    const chatId  = message.chat.id
    const text    = message.text.trim()
    const isAdmin = String(chatId) === String(ADMIN_CHAT_ID)
    const db      = getSupabaseAdmin()

    // Load persistent session for this chat
    const sess = await getSession(db, chatId)

    // ── Cancel ────────────────────────────────────────────────────
    if (text === '❌ Отмена') {
      await clearSession(db, chatId)
      await sendMessage(chatId, '↩️ Отменено.', mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    // ── Confirm registration ──────────────────────────────────────
    if (text === '✅ Подтвердить' && sess.mode === 'reg' && sess.reg_step === 'confirm') {
      const d = sess.reg_data || {}
      await clearSession(db, chatId)

      const { data, error } = await db
        .from('participants')
        .insert({
          name: d.name, surname: d.surname, email: d.email,
          gender: d.gender, role: d.role, country: d.country,
          bmi: d.bmi ?? null, owner_id: `tg_${chatId}`,
          created_at: new Date().toISOString(),
        })
        .select().single()

      if (error) {
        await sendMessage(chatId, `❌ Ошибка сохранения: ${error.message}`, mainKeyboard(isAdmin))
        return res.status(200).json({ ok: true })
      }

      await sendMessage(chatId,
        `🎉 <b>Ты успешно зарегистрирован!</b>\n\n` +
        `👤 ${escapeHtml(d.surname)} ${escapeHtml(d.name)}\n` +
        `🎽 ${d.role} · 🌍 ${d.country}` +
        (d.bmi ? `\n📊 ИМТ: ${d.bmi}` : '') +
        `\n\nЖдём тебя <b>15 июня 2026</b> · 42.195 км 🏃`,
        mainKeyboard(isAdmin)
      )

      if (ADMIN_CHAT_ID && !isAdmin) {
        await sendMessage(ADMIN_CHAT_ID,
          `🎉 <b>Новый участник через бота!</b>\n\n` +
          `👤 <b>${escapeHtml(d.surname)} ${escapeHtml(d.name)}</b>\n` +
          `🎽 ${d.role} · 🌍 ${d.country}\n📧 ${d.email}` +
          (d.bmi ? `\n📊 ИМТ: ${d.bmi}` : '') +
          `\n🆔 @${message.from.username || chatId}`
        )
      }
      return res.status(200).json({ ok: true })
    }

    // ── Active registration flow ──────────────────────────────────
    if (sess.mode === 'reg') {
      await handleReg(db, chatId, text, sess, isAdmin)
      return res.status(200).json({ ok: true })
    }

    // ── AI Mode ───────────────────────────────────────────────────
    if (text === '🤖 Спросить ИИ') {
      await saveSession(db, chatId, { mode: 'ai', ai_msgs: [] })
      await sendMessage(chatId,
        '🤖 <b>ИИ-ассистент марафона</b>\n\nЗадай любой вопрос о марафоне, подготовке, питании или регистрации. Для выхода нажми «❌ Отмена».',
        cancelKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (sess.mode === 'ai') {
      await sendMessage(chatId, '💭 Думаю...')
      const reply = await askAI(db, chatId, text, sess)
      await sendMessage(chatId, `🤖 ${reply}`, cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    // ── BMI Calculator (admin) ────────────────────────────────────
    if (text === '⚖️ Калькулятор ИМТ (Админ)') {
      if (!isAdmin) { await sendMessage(chatId, '❌ Только для администратора.', mainKeyboard(isAdmin)); return res.status(200).json({ ok: true }) }
      await saveSession(db, chatId, { mode: 'bmi', bmi_data: { step: 'weight' } })
      await sendMessage(chatId, '⚖️ <b>Калькулятор ИМТ</b>\n\nВведи <b>вес</b> в кг:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (sess.mode === 'bmi' && sess.bmi_data?.step === 'weight') {
      const w = parseFloat(text)
      if (isNaN(w) || w < 30 || w > 300) { await sendMessage(chatId, '❌ Некорректный вес:', cancelKeyboard()); return res.status(200).json({ ok: true }) }
      await saveSession(db, chatId, { mode: 'bmi', bmi_data: { step: 'height', weight: w } })
      await sendMessage(chatId, '📏 Введи <b>рост</b> в см:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (sess.mode === 'bmi' && sess.bmi_data?.step === 'height') {
      const h = parseFloat(text)
      if (isNaN(h) || h < 100 || h > 250) { await sendMessage(chatId, '❌ Некорректный рост:', cancelKeyboard()); return res.status(200).json({ ok: true }) }
      const { bmi, category, emoji } = calcBMI(sess.bmi_data.weight, h)
      await clearSession(db, chatId)
      const bar = bmi < 18.5 ? '🟦⬜⬜⬜' : bmi < 25 ? '🟦🟩⬜⬜' : bmi < 30 ? '🟦🟩🟨⬜' : '🟦🟩🟨🟥'
      await sendMessage(chatId,
        `${emoji} <b>ИМТ: ${bmi}</b> — ${category}\n${bar}\n\n🟦 &lt;18.5 Недостаточный\n🟩 18.5–24.9 Норма ✅\n🟨 25–29.9 Избыточный\n🟥 ≥30 Ожирение`,
        mainKeyboard(isAdmin)
      )
      return res.status(200).json({ ok: true })
    }

    // ── Search (waiting mode) ─────────────────────────────────────
    if (text === '🔍 Найти по фамилии') {
      await saveSession(db, chatId, { mode: 'surname' })
      await sendMessage(chatId, '✏️ Введи <b>фамилию</b>:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (text === '🔍 Найти по имени') {
      await saveSession(db, chatId, { mode: 'name' })
      await sendMessage(chatId, '✏️ Введи <b>имя</b>:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (sess.mode === 'surname' || sess.mode === 'name') {
      const field = sess.mode === 'name' ? 'name' : 'surname'
      await clearSession(db, chatId)
      const { data, error } = await db
        .from('participants')
        .select('id, name, surname, role, country, bmi, gender')
        .ilike(field, `%${text}%`)
        .limit(5)

      if (error) { await sendMessage(chatId, '❌ Ошибка базы данных.', mainKeyboard(isAdmin)); return res.status(200).json({ ok: true }) }
      if (!data || data.length === 0) {
        await sendMessage(chatId, `❌ По запросу «<b>${escapeHtml(text)}</b>» никого не найдено.`, mainKeyboard(isAdmin))
        return res.status(200).json({ ok: true })
      }

      let reply = `✅ Найдено: <b>${data.length}</b> участник(ов)\n\n`
      data.forEach(p => {
        const g = p.gender === 'Женский' ? '👩' : '👨'
        reply += `${g} <b>${escapeHtml(p.surname)} ${escapeHtml(p.name)}</b>\n`
        reply += `   🎽 ${p.role || '—'} · 🌍 ${p.country || '—'}`
        if (p.bmi) reply += ` · 📊 ${p.bmi}`
        reply += '\n'
        if (isAdmin) reply += `   🗑 /delete_${p.id}\n`
        reply += '\n'
      })
      await sendMessage(chatId, reply.trim(), mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    // ── Admin: send stats now ─────────────────────────────────────
    if (text === '📨 Статистика сейчас' && isAdmin) {
      try {
        const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`
        await fetch(`${baseUrl}/api/cron-daily-stats`, {
          headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }
        })
        await sendMessage(chatId, '✅ Статистика отправлена!', mainKeyboard(isAdmin))
      } catch (e) {
        await sendMessage(chatId, '❌ Ошибка отправки статистики', mainKeyboard(isAdmin))
      }
      return res.status(200).json({ ok: true })
    }

    // ── Admin: delete participant ─────────────────────────────────
    if (text.startsWith('/delete_')) {
      if (!isAdmin) { await sendMessage(chatId, '❌ Нет прав.', mainKeyboard(isAdmin)); return res.status(200).json({ ok: true }) }
      const id = text.replace('/delete_', '').trim()
      const { error } = await db.from('participants').delete().eq('id', id)
      await sendMessage(chatId, error ? `❌ Ошибка: ${error.message}` : '✅ Участник удалён.', mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    // ── Menu static commands ──────────────────────────────────────
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, '🏃 <b>Marathon Skills 2026</b>\n\nПривет! Выбери действие 👇', mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    if (text === '✚ Зарегистрироваться на марафон') {
      await startRegistration(db, chatId); return res.status(200).json({ ok: true })
    }

    if (text === '🌐 Открыть сайт') {
      await sendMessage(chatId, '🌐 <a href="https://marathon-vercel-superbase.vercel.app">marathon-vercel-superbase.vercel.app</a>', mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    if (text === '📋 Как зарегистрироваться?') {
      await sendMessage(chatId,
        '📋 <b>Способы регистрации:</b>\n\n' +
        '1️⃣ <b>Прямо здесь в боте</b> — нажми «✚ Зарегистрироваться»\n\n' +
        '2️⃣ <b>На сайте</b>:\n<a href="https://marathon-vercel-superbase.vercel.app">marathon-vercel-superbase.vercel.app</a>\n→ Войти через Google → ✚ Зарегистрировать',
        mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    if (text === '❓ Что такое марафон?') {
      await sendMessage(chatId,
        '🏅 <b>Marathon Skills 2026</b>\n\nМарафон — забег на <b>42,195 км</b>\n\n📅 <b>15 июня 2026</b> · Алматы\n\n🏃 <b>Бегун</b> — участвует в забеге\n📋 <b>Координатор</b> — организует и помогает',
        mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    if (text === '📊 Статистика') {
      const { data, error } = await db.from('participants').select('role, country, bmi')
      if (error || !data) {
        await sendMessage(chatId, '❌ Не удалось получить статистику.', mainKeyboard(isAdmin))
        return res.status(200).json({ ok: true })
      }
      const total   = data.length
      const runners = data.filter(p => p.role === 'Бегун').length
      const coords  = data.filter(p => p.role === 'Координатор').length
      const countries = [...new Set(data.map(p => p.country).filter(Boolean))]
      const bmis = data.map(p => p.bmi).filter(Boolean)
      const avgBmi = bmis.length ? (bmis.reduce((a,b)=>a+b,0)/bmis.length).toFixed(1) : '—'
      const cc = {}; data.forEach(p => { if (p.country) cc[p.country] = (cc[p.country]||0)+1 })
      const top = Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,3)
      let reply = `📊 <b>Статистика марафона</b>\n\n👥 Всего: <b>${total}</b>\n🏃 Бегунов: <b>${runners}</b>\n📋 Координаторов: <b>${coords}</b>\n🌍 Стран: <b>${countries.length}</b>\n📊 Средний ИМТ: <b>${avgBmi}</b>`
      if (top.length) { reply += '\n\n🏆 <b>Топ стран:</b>\n'; top.forEach(([c,n],i) => { reply += `${i+1}. ${c} — ${n} чел.\n` }) }
      await sendMessage(chatId, reply, mainKeyboard(isAdmin))
      return res.status(200).json({ ok: true })
    }

    // ── Fallback ──────────────────────────────────────────────────
    await sendMessage(chatId, '👇 Выбери действие из меню:', mainKeyboard(isAdmin))
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(200).json({ ok: true })
  }
}
