import { getSupabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { messages } = req.body
  if (!Array.isArray(messages) || messages.length === 0)
    return res.status(400).json({ error: 'No messages' })

  // Fetch live stats from DB
  let statsContext = ''
  try {
    const db = getSupabaseAdmin()
    const { data } = await db.from('participants').select('role, country, bmi, name, surname')
    if (data) {
      const total = data.length
      const runners = data.filter(p => p.role === 'Бегун').length
      const coords = data.filter(p => p.role === 'Координатор').length
      const bmis = data.map(p => p.bmi).filter(Boolean)
      const avgBmi = bmis.length ? (bmis.reduce((a,b) => a+b,0)/bmis.length).toFixed(1) : 'нет данных'
      const cc = {}
      data.forEach(p => { if (p.country) cc[p.country] = (cc[p.country]||0)+1 })
      const top3 = Object.entries(cc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([c,n])=>`${c}(${n})`).join(', ')
      statsContext = `\nТекущая статистика марафона: всего участников — ${total} (бегунов: ${runners}, координаторов: ${coords}). Топ-3 страны: ${top3}. Средний ИМТ: ${avgBmi}.`
    }
  } catch (e) { /* silent */ }

  const systemPrompt = `Ты — умный ИИ-ассистент марафона Marathon Skills 2026.
Марафон проходит 15 июня 2026 года в Алматы, дистанция 42,195 км.
Отвечай на русском языке, кратко и по делу.
Ты можешь отвечать на вопросы о марафоне, регистрации, подготовке к забегу, ИМТ, питании бегунов и другой полезной информации.
Регистрация доступна через сайт (кнопка "Зарегистрировать") или через Telegram-бота @martthon_bot.
${statsContext}
Не придумывай участников — только общая статистика выше.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: systemPrompt,
        messages: messages.slice(-10), // last 10 turns
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('Anthropic error:', data)
      return res.status(500).json({ error: data.error?.message || 'AI error' })
    }

    const text = data.content?.find(c => c.type === 'text')?.text || '...'
    return res.status(200).json({ reply: text })
  } catch (err) {
    console.error('AI chat error:', err)
    return res.status(500).json({ error: 'AI service unavailable' })
  }
}
