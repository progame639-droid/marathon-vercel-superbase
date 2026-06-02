import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { getSupabaseAdmin } from '../../../lib/supabase'

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user }) {
      // Upsert user into Supabase on every login
      try {
        const db = getSupabaseAdmin()
        const { error } = await db.from('auth_users').upsert(
          {
            google_id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'google_id' }
        )
        if (error) console.error('Supabase upsert error:', error)
      } catch (e) {
        console.error('signIn callback error:', e)
      }
      return true
    },
    async session({ session, token }) {
      session.user.id = token.sub
      return session
    },
    async jwt({ token }) {
      return token
    },
  },
  pages: {
    signIn: '/login',
  },
}

export default NextAuth(authOptions)
