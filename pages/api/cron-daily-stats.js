/**
 * GET /api/cron-daily-stats
 * Call this via Vercel Cron Job (vercel.json) or external scheduler daily.
 * Sends daily statistics to the Telegram admin.
 */
import { getSupabaseAdmin } from '../../lib/supabase'

const TOKEN = process.env.TELEGRAM_BOT_TOKEN
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
const CRON_SECRET = process.env.CRON_SECRET // optional protection

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
}

export default async function handler(req, res) {
  // Protect with secret if set
  if (CRON_SECRET && req.headers['x-cron-secret'] !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (!ADMIN_CHAT_ID || !TOKEN) {
    return res.status(400).json({ error: 'Missing env vars' })
  }

  const db = getSupabaseAdmin()
  const { data, error } = await db.from('participants').select('role, country, bmi, surname, created_at')

  if (error) return res.status(500).json({ error: error.message })

  const total = data.length
  const runners = data.filter(p => p.role === 'Бегун').length
  const coords = data.filter(p => p.role === 'Координатор').length

  const bmis = data.map(p => p.bmi).filter(Boolean)
  const avgBmi = bmis.length ? (bmis.reduce((a,b)=>a+b,0)/bmis.length).toFixed(1) : '—'

  // Top countries
  const cc = {}
  data.forEach(p => { if (p.country) cc[p.country] = (cc[p.country]||0)+1 })
  const top3 = Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,3)

  // New today
  const today = new Date().toISOString().slice(0,10)
  const newToday = data.filter(p => p.created_at?.startsWith(today)).length

  // Searched surnames (we track in a separate table if exists — skip if not)
  let topSurnames = ''
  try {
    const { data: searches } = await db
      .from('search_log')
      .select('query')
      .gte('created_at', today)
      .limit(100)
    if (searches?.length) {
      const sq = {}
      searches.forEach(s => { sq[s.query] = (sq[s.query]||0)+1 })
      const top = Object.entries(sq).sort((a,b)=>b[1]-a[1]).slice(0,5)
      topSurnames = '\n\n🔍 <b>Топ поисков сегодня:</b>\n' + top.map(([q,n])=>`  • ${q} — ${n} раз`).join('\n')
    }
  } catch (e) { /* table may not exist */ }

  let msg = `📊 <b>Ежедневная статистика — Marathon Skills 2026</b>\n`
  msg += `📅 ${new Date().toLocaleDateString('ru-RU', {day:'numeric',month:'long',year:'numeric'})}\n\n`
  msg += `👥 Всего участников: <b>${total}</b>\n`
  msg += `🆕 Новых сегодня: <b>${newToday}</b>\n`
  msg += `🏃 Бегунов: <b>${runners}</b>\n`
  msg += `📋 Координаторов: <b>${coords}</b>\n`
  msg += `📊 Средний ИМТ: <b>${avgBmi}</b>\n`

  if (top3.length) {
    msg += `\n🌍 <b>Топ стран:</b>\n`
    top3.forEach(([c,n],i) => { msg += `  ${i+1}. ${c} — ${n} чел.\n` })
  }

  msg += topSurnames

  await sendMessage(ADMIN_CHAT_ID, msg)
  return res.status(200).json({ ok: true, sent: true })
}
