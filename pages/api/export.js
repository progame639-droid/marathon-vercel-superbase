import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { getSupabaseAdmin } from '../../lib/supabase'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabaseAdmin()
  const { data, error } = await db
    .from('participants')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return res.status(500).json({ error: error.message })

  const fields = ['id','name','surname','email','gender','role','country','dob','bmi','created_at']
  const headers = ['ID','Имя','Фамилия','Email','Пол','Роль','Страна','Дата рождения','ИМТ','Дата регистрации']

  const escape = (v) => {
    if (v == null) return ''
    const s = String(v)
    if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  const rows = [
    headers.join(','),
    ...data.map(p => fields.map(f => escape(p[f])).join(','))
  ]

  const csv = '\uFEFF' + rows.join('\r\n') // BOM for Excel UTF-8

  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="marathon_participants_${new Date().toISOString().slice(0,10)}.csv"`)
  res.status(200).send(csv)
}
