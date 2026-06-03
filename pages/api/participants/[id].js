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

    const userId = session.user?.email
    const { id } = req.query

    // ======================
    // UPDATE
    // ======================
    if (req.method === 'PUT') {
      const body =
        typeof req.body === 'string'
          ? JSON.parse(req.body)
          : req.body

      const { data, error } = await db
        .from('participants')
        .update({
          email: body.email,
          name: body.name,
          surname: body.surname,
          gender: body.gender,
          role: body.role,
          country: body.country,
          dob: body.dob || null,
          bmi: body.bmi || null,
          photo: body.photo || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) {
        console.error('PUT ERROR:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json(data)
    }

    // ======================
    // DELETE
    // ======================
    if (req.method === 'DELETE') {
      const { error } = await db
        .from('participants')
        .delete()
        .eq('id', id)

      if (error) {
        console.error('DELETE ERROR:', error)
        return res.status(500).json({ error: error.message })
      }

      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err) {
    console.error('SERVER ERROR:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
