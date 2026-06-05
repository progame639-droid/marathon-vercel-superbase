import { getSupabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: true } }

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID

async function sendMessage(chatId, text, keyboard = null) {
  const body = { chat_id: chatId, text, parse_mode: 'HTML' }
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
      ['✚ Зарегистрироваться на марафон'],
      ['🔍 Найти по фамилии', '🔍 Найти по имени'],
      ['📊 Статистика', '⚖️ Калькулятор ИМТ'],
      ['❓ Что такое марафон?', '📋 Как зарегистрироваться?'],
      ['🌐 Открыть сайт'],
    ],
    resize_keyboard: true,
  }
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
  if (bmi < 18.5) { category = 'Недостаточный вес'; emoji = '⚠️' }
  else if (bmi < 25) { category = 'Норма'; emoji = '✅' }
  else if (bmi < 30) { category = 'Избыточный вес'; emoji = '⚠️' }
  else { category = 'Ожирение'; emoji = '🔴' }
  return { bmi: parseFloat(bmi.toFixed(1)), category, emoji }
}

// Состояния
const regState = {}   // регистрация
const waitingFor = {} // поиск
const bmiState = {}   // калькулятор ИМТ

// Шаги регистрации (без bmi — он опциональный)
const REG_STEPS = ['name', 'surname', 'email', 'gender', 'role', 'country', 'bmi_ask']

async function handleRegistration(chatId, text) {
  const state = regState[chatId]

  // Начало
  if (!state) {
    regState[chatId] = { step: 0, data: {} }
    await sendMessage(chatId,
      '📝 <b>Регистрация на марафон</b>\n\nШаг 1 из 7 — Введи своё <b>имя</b>:',
      cancelKeyboard()
    )
    return
  }

  const step = state.step
  const field = REG_STEPS[step]

  // Валидация email
  if (field === 'email' && !text.includes('@')) {
    await sendMessage(chatId, '❌ Неверный email. Попробуй ещё раз:', cancelKeyboard())
    return
  }

  // Шаг ИМТ — предлагаем рассчитать
  if (field === 'bmi_ask') {
    state.step++
    await sendMessage(chatId,
      `Шаг 7 из 7 — Хочешь рассчитать <b>ИМТ</b>?\n\n` +
      `Это поможет организаторам правильно распределить участников.`,
      { keyboard: [['📊 Рассчитать ИМТ', '⏭ Пропустить'], ['❌ Отмена']], resize_keyboard: true }
    )
    return
  }

  // Пропустить ИМТ
  if (state.step === REG_STEPS.length && text === '⏭ Пропустить') {
    state.data.bmi = null
    await showConfirmation(chatId, state.data)
    state.step = 'confirm'
    return
  }

  // Начать расчёт ИМТ
  if (state.step === REG_STEPS.length && text === '📊 Рассчитать ИМТ') {
    state.step = 'bmi_weight'
    await sendMessage(chatId, '⚖️ Введи свой <b>вес</b> в кг (например: <code>72</code>):', cancelKeyboard())
    return
  }

  // Ввод веса для ИМТ при регистрации
  if (state.step === 'bmi_weight') {
    const w = parseFloat(text)
    if (isNaN(w) || w < 30 || w > 300) {
      await sendMessage(chatId, '❌ Некорректный вес. Введи число, например <code>72</code>:', cancelKeyboard())
      return
    }
    state.data._weight = w
    state.step = 'bmi_height'
    await sendMessage(chatId, '📏 Введи свой <b>рост</b> в см (например: <code>175</code>):', cancelKeyboard())
    return
  }

  // Ввод роста для ИМТ при регистрации
  if (state.step === 'bmi_height') {
    const h = parseFloat(text)
    if (isNaN(h) || h < 100 || h > 250) {
      await sendMessage(chatId, '❌ Некорректный рост. Введи число, например <code>175</code>:', cancelKeyboard())
      return
    }
    const { bmi, category, emoji } = calcBMI(state.data._weight, h)
    state.data.bmi = bmi
    delete state.data._weight

    await sendMessage(chatId,
      `${emoji} Твой ИМТ: <b>${bmi}</b> — ${category}\n\nОтлично, добавлю в профиль!`
    )
    await showConfirmation(chatId, state.data)
    state.step = 'confirm'
    return
  }

  // Сохраняем обычные поля
  state.data[field] = text
  state.step++
  const next = REG_STEPS[state.step]

  if (next === 'gender') {
    await sendMessage(chatId,
      `Шаг ${state.step + 1} из 7 — Выбери <b>пол</b>:`,
      { keyboard: [['Мужской', 'Женский'], ['❌ Отмена']], resize_keyboard: true }
    )
  } else if (next === 'role') {
    await sendMessage(chatId,
      `Шаг ${state.step + 1} из 7 — Выбери <b>роль</b>:`,
      { keyboard: [['Бегун', 'Координатор'], ['❌ Отмена']], resize_keyboard: true }
    )
  } else if (next === 'country') {
    await sendMessage(chatId,
      `Шаг ${state.step + 1} из 7 — Введи <b>страну</b>:`,
      cancelKeyboard()
    )
  } else if (next === 'bmi_ask') {
    // Сохранили страну — теперь предлагаем ИМТ
    state.step++
    await sendMessage(chatId,
      `Шаг 7 из 7 — Хочешь рассчитать <b>ИМТ (индекс массы тела)</b>?\n\nЭто поможет организаторам.`,
      { keyboard: [['📊 Рассчитать ИМТ', '⏭ Пропустить'], ['❌ Отмена']], resize_keyboard: true }
    )
  } else {
    await sendMessage(chatId,
      `Шаг ${state.step + 1} из 7 — Введи <b>${
        next === 'surname' ? 'фамилию' : next === 'email' ? 'email' : next
      }</b>:`,
      cancelKeyboard()
    )
  }
}

async function showConfirmation(chatId, d) {
  await sendMessage(chatId,
    `✅ <b>Проверь данные:</b>\n\n` +
    `👤 ${escapeHtml(d.name)} ${escapeHtml(d.surname)}\n` +
    `📧 ${escapeHtml(d.email)}\n` +
    `⚥ ${escapeHtml(d.gender)}\n` +
    `🎽 ${escapeHtml(d.role)}\n` +
    `🌍 ${escapeHtml(d.country)}\n` +
    `📊 ИМТ: ${d.bmi ? d.bmi : '—'}\n\n` +
    `Всё верно?`,
    { keyboard: [['✅ Подтвердить', '❌ Отмена']], resize_keyboard: true }
  )
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(200).json({ ok: true })

  try {
    // Уведомление с сайта
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

    const message = req.body?.message
    if (!message?.text) return res.status(200).json({ ok: true })

    const chatId = message.chat.id
    const text = message.text.trim()

    // ── Отмена ───────────────────────────────────────────────────
    if (text === '❌ Отмена') {
      delete regState[chatId]
      delete waitingFor[chatId]
      delete bmiState[chatId]
      await sendMessage(chatId, '↩️ Отменено.', mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    // ── Подтверждение регистрации ─────────────────────────────────
    if (text === '✅ Подтвердить' && regState[chatId]?.step === 'confirm') {
      const d = regState[chatId].data
      delete regState[chatId]

      const db = getSupabaseAdmin()
      const { data, error } = await db
        .from('participants')
        .insert({
          name: d.name,
          surname: d.surname,
          email: d.email,
          gender: d.gender,
          role: d.role,
          country: d.country,
          bmi: d.bmi || null,
          owner_id: `tg_${chatId}`,
          created_at: new Date().toISOString(),
        })
        .select().single()

      if (error) {
        await sendMessage(chatId, `❌ Ошибка: ${error.message}`, mainKeyboard())
        return res.status(200).json({ ok: true })
      }

      await sendMessage(chatId,
        `🎉 <b>Ты успешно зарегистрирован!</b>\n\n` +
        `👤 ${escapeHtml(d.surname)} ${escapeHtml(d.name)}\n` +
        `🎽 ${d.role} · 🌍 ${d.country}` +
        (d.bmi ? `\n📊 ИМТ: ${d.bmi}` : '') +
        `\n\nЖдём тебя <b>15 июня 2026</b> · 42.195 км 🏃`,
        mainKeyboard()
      )

      if (ADMIN_CHAT_ID && String(chatId) !== String(ADMIN_CHAT_ID)) {
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

    // ── Процесс регистрации ───────────────────────────────────────
    if (regState[chatId]) {
      await handleRegistration(chatId, text)
      return res.status(200).json({ ok: true })
    }

    // ── Калькулятор ИМТ (отдельная кнопка) ───────────────────────
    if (text === '⚖️ Калькулятор ИМТ') {
      bmiState[chatId] = { step: 'weight' }
      await sendMessage(chatId,
        '⚖️ <b>Калькулятор ИМТ</b>\n\nВведи свой <b>вес</b> в кг (например: <code>72</code>):',
        cancelKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (bmiState[chatId]?.step === 'weight') {
      const w = parseFloat(text)
      if (isNaN(w) || w < 30 || w > 300) {
        await sendMessage(chatId, '❌ Некорректный вес. Введи число, например <code>72</code>:', cancelKeyboard())
        return res.status(200).json({ ok: true })
      }
      bmiState[chatId] = { step: 'height', weight: w }
      await sendMessage(chatId, '📏 Введи свой <b>рост</b> в см (например: <code>175</code>):', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (bmiState[chatId]?.step === 'height') {
      const h = parseFloat(text)
      if (isNaN(h) || h < 100 || h > 250) {
        await sendMessage(chatId, '❌ Некорректный рост. Введи число, например <code>175</code>:', cancelKeyboard())
        return res.status(200).json({ ok: true })
      }
      const { bmi, category, emoji } = calcBMI(bmiState[chatId].weight, h)
      delete bmiState[chatId]

      const bar = bmi < 18.5 ? '🟦🟦⬜⬜⬜' : bmi < 25 ? '🟦🟦🟩🟩⬜' : bmi < 30 ? '🟦🟦🟩🟨🟨' : '🟦🟦🟩🟨🟥'
      await sendMessage(chatId,
        `${emoji} <b>Твой ИМТ: ${bmi}</b>\n` +
        `${bar}\n\n` +
        `📋 Категория: <b>${category}</b>\n\n` +
        `<i>Норма для бегуна: 18.5 – 24.9</i>\n\n` +
        `<b>Шкала ИМТ:</b>\n` +
        `🟦 &lt;18.5 — Недостаточный вес\n` +
        `🟩 18.5–24.9 — Норма ✅\n` +
        `🟨 25–29.9 — Избыточный вес\n` +
        `🟥 ≥30 — Ожирение`,
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    // ── Главное меню ──────────────────────────────────────────────
    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, '🏃 <b>Marathon Skills 2026</b>\n\nПривет! Выбери действие 👇', mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (text === '✚ Зарегистрироваться на марафон') {
      await handleRegistration(chatId, null)
      return res.status(200).json({ ok: true })
    }

    if (text === '🌐 Открыть сайт') {
      await sendMessage(chatId,
        '🌐 <a href="https://marathon-vercel-superbase.vercel.app">marathon-vercel-superbase.vercel.app</a>',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (text === '📋 Как зарегистрироваться?') {
      await sendMessage(chatId,
        '📋 <b>Способы регистрации:</b>\n\n' +
        '1️⃣ <b>Прямо здесь в боте</b> — нажми «✚ Зарегистрироваться на марафон»\n\n' +
        '2️⃣ <b>На сайте</b>:\n<a href="https://marathon-vercel-superbase.vercel.app">marathon-vercel-superbase.vercel.app</a>\n→ Войти через Google → ✚ Зарегистрировать',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (text === '❓ Что такое марафон?') {
      await sendMessage(chatId,
        '🏅 <b>Marathon Skills 2026</b>\n\nМарафон — забег на <b>42,195 км</b>\n\n📅 <b>15 июня 2026</b> · Алматы\n\n🏃 <b>Бегун</b> — участвует в забеге\n📋 <b>Координатор</b> — организует и помогает',
        mainKeyboard()
      )
      return res.status(200).json({ ok: true })
    }

    if (text === '📊 Статистика') {
      const db = getSupabaseAdmin()
      const { data, error } = await db.from('participants').select('role, country, bmi')
      if (error || !data) {
        await sendMessage(chatId, '❌ Не удалось получить статистику.', mainKeyboard())
        return res.status(200).json({ ok: true })
      }
      const total = data.length
      const runners = data.filter(p => p.role === 'Бегун').length
      const coords = data.filter(p => p.role === 'Координатор').length
      const countries = [...new Set(data.map(p => p.country).filter(Boolean))]
      const bmis = data.map(p => p.bmi).filter(Boolean)
      const avgBmi = bmis.length ? (bmis.reduce((a, b) => a + b, 0) / bmis.length).toFixed(1) : '—'
      const countryCount = {}
      data.forEach(p => { if (p.country) countryCount[p.country] = (countryCount[p.country] || 0) + 1 })
      const top = Object.entries(countryCount).sort((a, b) => b[1] - a[1]).slice(0, 3)

      let reply = `📊 <b>Статистика марафона</b>\n\n👥 Всего: <b>${total}</b>\n🏃 Бегунов: <b>${runners}</b>\n📋 Координаторов: <b>${coords}</b>\n🌍 Стран: <b>${countries.length}</b>\n📊 Средний ИМТ: <b>${avgBmi}</b>`
      if (top.length) { reply += `\n\n🏆 <b>Топ стран:</b>\n`; top.forEach(([c, n], i) => { reply += `${i+1}. ${c} — ${n} чел.\n` }) }
      await sendMessage(chatId, reply, mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (text === '🔍 Найти по фамилии') {
      waitingFor[chatId] = 'surname'
      await sendMessage(chatId, '✏️ Введи <b>фамилию</b>:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (text === '🔍 Найти по имени') {
      waitingFor[chatId] = 'name'
      await sendMessage(chatId, '✏️ Введи <b>имя</b>:', cancelKeyboard())
      return res.status(200).json({ ok: true })
    }

    if (text.startsWith('/delete_')) {
      if (String(chatId) !== String(ADMIN_CHAT_ID)) {
        await sendMessage(chatId, '❌ Нет прав.', mainKeyboard())
        return res.status(200).json({ ok: true })
      }
      const id = text.replace('/delete_', '').trim()
      const db = getSupabaseAdmin()
      const { error } = await db.from('participants').delete().eq('id', id)
      await sendMessage(chatId, error ? `❌ Ошибка: ${error.message}` : '✅ Участник удалён.', mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    // Поиск
    const searchMode = waitingFor[chatId] || 'surname'
    delete waitingFor[chatId]
    const db = getSupabaseAdmin()
    const field = searchMode === 'name' ? 'name' : 'surname'
    const { data, error } = await db
      .from('participants')
      .select('id, name, surname, role, country, bmi, gender')
      .ilike(field, `%${text}%`)
      .limit(5)

    if (error) { await sendMessage(chatId, '❌ Ошибка базы данных.', mainKeyboard()); return res.status(200).json({ ok: true }) }
    if (!data || data.length === 0) {
      await sendMessage(chatId, `❌ По запросу «<b>${escapeHtml(text)}</b>» никого не найдено.`, mainKeyboard())
      return res.status(200).json({ ok: true })
    }

    const isAdmin = String(chatId) === String(ADMIN_CHAT_ID)
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

    await sendMessage(chatId, reply.trim(), mainKeyboard())
    return res.status(200).json({ ok: true })

  } catch (err) {
    console.error('Webhook error:', err)
    return res.status(200).json({ ok: true })
  }
}
