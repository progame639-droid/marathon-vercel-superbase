import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { getSupabaseAdmin } from '../../lib/supabase'

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const { rows } = req.body
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ error: 'No rows provided' })

  const db = getSupabaseAdmin()
  const toInsert = rows.map(r => ({
    owner_id: session.user?.email || 'import',
    email:    (r.email || r.Email || '').trim(),
    name:     (r.name || r.Имя || r['Имя'] || '').trim(),
    surname:  (r.surname || r.Фамилия || r['Фамилия'] || '').trim(),
    gender:   r.gender || r.Пол || 'Мужской',
    role:     r.role || r.Роль || 'Бегун',
    country:  r.country || r.Страна || null,
    dob:      r.dob || r['Дата рождения'] || null,
    bmi:      parseFloat(r.bmi || r['ИМТ']) || null,
  })).filter(r => r.email && r.name && r.surname)

  if (toInsert.length === 0)
    return res.status(400).json({ error: 'No valid rows (need email, name, surname)' })

  const { data, error } = await db
    .from('participants')
    .insert(toInsert)
    .select()

  if (error) return res.status(500).json({ error: error.message })

  // Notify Telegram about bulk import
  try {
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.host}`
    await fetch(`${baseUrl}/api/telegram-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'bulk_import',
        count: data.length,
        user: session.user?.email,
      }),
    })
  } catch (e) { /* silent */ }

  return res.status(200).json({ imported: data.length, skipped: rows.length - toInsert.length })
}
