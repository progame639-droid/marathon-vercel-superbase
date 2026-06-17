import { signIn, useSession } from 'next-auth/react'
import { useEffect } from 'react'
import { useRouter } from 'next/router'

export default function LoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') router.replace('/')
  }, [status, router])

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Archivo', system-ui, sans-serif",
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'repeating-linear-gradient(90deg, var(--line) 0 2px, transparent 2px 64px)',
        opacity: .5,
      }}/>
      <div style={{
        background: '#fff',
        border: '3px solid var(--ink)',
        boxShadow: '10px 10px 0 var(--ink)',
        padding: '52px 48px',
        width: 'min(440px, 92vw)',
        textAlign: 'center',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: -18, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--lime)', border: '3px solid var(--ink)', padding: '4px 16px',
          fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 700,
          letterSpacing: '0.08em',
        }}>BIB #2026</div>

        <div style={{ fontFamily: "'Archivo Black', sans-serif", fontSize: 38, lineHeight: 1, marginTop: 12, marginBottom: 6, letterSpacing: '-0.02em' }}>
          MARATHON<br/>SKILLS
        </div>
        <div style={{ display: 'inline-block', background: 'var(--coral)', color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 13, padding: '3px 10px', marginBottom: 18, transform: 'rotate(-1deg)' }}>
          15.06.2026 · 42.195 KM
        </div>
        <div style={{ fontSize: 14, color: 'var(--ink-soft)', marginBottom: 32, lineHeight: 1.5 }}>
          Войдите, чтобы управлять участниками марафона
        </div>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--ink)',
            color: '#fff',
            border: '3px solid var(--ink)',
            borderRadius: 0,
            padding: '14px 28px',
            fontSize: 15,
            fontWeight: 700,
            cursor: 'pointer',
            transition: '.12s',
            width: '100%',
            justifyContent: 'center',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'var(--lime)'; e.currentTarget.style.color = 'var(--ink)' }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--ink)'; e.currentTarget.style.color = '#fff' }}
        >
          <svg width="20" height="20" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            <path fill="none" d="M0 0h48v48H0z"/>
          </svg>
          Войти через Google
        </button>

        <div style={{ marginTop: 26, fontSize: 11, color: 'var(--mute)', fontFamily: "'JetBrains Mono', monospace", letterSpacing: '0.05em' }}>
          АЛМАТЫ · СТАРТ 09:00
        </div>
      </div>
    </div>
  )
}
