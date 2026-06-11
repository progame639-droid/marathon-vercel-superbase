import { getSupabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } }

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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

  const systemInstruction =
    `Ты — умный ИИ-ассистент марафона Marathon Skills 2026.\n` +
    `Марафон проходит 15 июня 2026 года в Алматы, дистанция 42,195 км.\n` +
    `Отвечай на русском языке, кратко и по делу.\n` +
    `Ты можешь отвечать на вопросы о марафоне, регистрации, подготовке к забегу, ИМТ, питании бегунов и другой полезной информации.\n` +
    `Регистрация доступна через сайт (кнопка "Зарегистрировать") или через Telegram-бота @martthon_bot.\n` +
    `${statsContext}\n` +
    `Не придумывай участников — только общая статистика выше.`

  // Convert messages to Gemini format
  // Gemini uses 'user' and 'model' roles (not 'assistant')
  const geminiContents = messages.slice(-10).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: geminiContents,
          generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
        }),
      }
    )

    const data = await response.json()
    if (!response.ok) {
      console.error('Gemini error:', data)
      return res.status(500).json({ error: data.error?.message || 'AI error' })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '...'
    return res.status(200).json({ reply: text })
  } catch (err) {
    console.error('AI chat error:', err)
    return res.status(500).json({ error: 'AI service unavailable' })
  }
}
