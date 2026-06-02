import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions)
  if (!session) return res.status(401).json({ error: 'Unauthorized' })

  const db = getSupabaseAdmin()
  const userId = session.user.id

  if (req.method === 'GET') {
    const { data, error } = await db
      .from('participants')
      .select('*')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json(data)
  }

  if (req.method === 'POST') {
    const body = req.body
    const { data, error } = await db
      .from('participants')
      .insert({
        owner_id: userId,
        email: body.email,
        name: body.name,
        surname: body.surname,
        gender: body.gender,
        role: body.role,
        country: body.country,
        dob: body.dob || null,
        bmi: body.bmi || null,
        photo: body.photo || null,
      })
      .select()
      .single()

    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json(data)
  }

  res.status(405).json({ error: 'Method not allowed' })
}
