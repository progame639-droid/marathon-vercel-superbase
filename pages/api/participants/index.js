import { getServerSession } from 'next-auth/next'
import { authOptions } from '../auth/[...nextauth]'
import { getSupabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  try {
    const session = await getServerSession(req, res, authOptions)

    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const db = getSupabaseAdmin()

    // 🔥 СТАБИЛЬНЫЙ userId (email вместо id)
    const userId = session.user?.email

    if (!userId) {
      return res.status(400).json({ error: 'No user email in session' })
    }

    // ======================
    // GET PARTICIPANTS
    // ======================
    if (req.method === 'GET') {
      const { data, error } = await db
        .from('participants')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('GET ERROR:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json(data)
    }

    // ======================
    // CREATE PARTICIPANT
    // ======================
    if (req.method === 'POST') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body

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

      if (error) {
        console.error('POST ERROR:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(201).json(data)
    }

    return res.status(405).json({ error: 'Method not allowed' })

  } catch (err) {
    console.error('SERVER ERROR:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
