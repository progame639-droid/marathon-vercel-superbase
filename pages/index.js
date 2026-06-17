import { useSession, signOut, signIn } from 'next-auth/react'
import { useEffect, useRef, useState, useCallback } from 'react'

const COUNTRIES = [
  'Казахстан','Россия','США','Германия','Франция','Великобритания','Китай','Япония',
  'Бразилия','Канада','Австралия','Индия','Италия','Испания','Нидерланды','Польша',
  'Швеция','Норвегия','Финляндия','Дания','Швейцария','Австрия','Украина','Беларусь',
  'Узбекистан','Кыргызстан','Азербайджан','Грузия','Армения','Молдова','Другая страна'
]

function useTimer() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const target = new Date('2026-06-15T09:00:00')
    const tick = () => {
      const diff = target - new Date()
      if (diff <= 0) { setTime('МАРАФОН НАЧАЛСЯ! 🏃'); return }
      const d = Math.floor(diff/86400000)
      const h = Math.floor((diff%86400000)/3600000)
      const m = Math.floor((diff%3600000)/60000)
      const s = Math.floor((diff%60000)/1000)
      setTime(`${d}д ${h}ч ${m}м ${s}с — ДО СТАРТА`)
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// ── DESIGN TOKENS ───────────────────────────────────────────────
const INK='#16140F', PAPER='#F7F4EC', CARD='#FFFFFF', MUTE='#6B6655'
const LIME='#C8FF3D', ROAD='#E2231A', BLUE='#2B5FE0', GREEN='#1F8A3B', AMBER='#E07A00'
const DISPLAY="'Anton', sans-serif"
const MONO="'JetBrains Mono', monospace"
const SANS="'Inter', system-ui, sans-serif"

function bmiCategory(v) {
  if (!v) return ''
  if (v < 18.5) return 'Недостаточный вес'
  if (v < 25)   return 'Здоровый вес ✓'
  if (v < 30)   return 'Избыточный вес'
  return 'Ожирение'
}
function bmiColor(v) {
  if (!v) return MUTE
  if (v < 18.5) return BLUE
  if (v < 25)   return GREEN
  if (v < 30)   return AMBER
  return ROAD
}

function drawFigureOnCanvas(canvas, bmiVal, gender) {
  if (!canvas) return
  const w = canvas.offsetWidth||400, h = canvas.offsetHeight||160
  canvas.width=w; canvas.height=h
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0,0,w,h)
  const bc = bmiColor(bmiVal)
  const cx=w/2, cy=h/2-8
  const bw = bmiVal===0?22:bmiVal<18.5?15:bmiVal<25?22:bmiVal<30?30:40
  ctx.fillStyle=bc
  ctx.beginPath(); ctx.arc(cx,cy-48,18,0,Math.PI*2); ctx.fill()
  ctx.fillRect(cx-bw,cy-29,bw*2,52)
  ctx.fillRect(cx-bw-14,cy-29,13,40)
  ctx.fillRect(cx+bw+1,cy-29,13,40)
  ctx.fillRect(cx-bw+4,cy+23,bw-8,44)
  ctx.fillRect(cx+4,cy+23,bw-8,44)
  ctx.font='bold 13px Inter'; ctx.fillStyle=bc; ctx.textAlign='center'
  ctx.fillText(gender==='Женский'?'♀':'♂',cx,h-5)
}

function drawGaugeOnCanvas(canvas, bmiVal) {
  if (!canvas) return
  const pw=(canvas.offsetWidth||400)-20
  canvas.width=canvas.offsetWidth||400; canvas.height=canvas.offsetHeight||56
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height)
  const gx=10,gy=14,gh=16
  const segs=[{color:BLUE,label:'Недостат.',w:.22},{color:GREEN,label:'Здоровый',w:.30},{color:AMBER,label:'Избыточ.',w:.24},{color:ROAD,label:'Ожирение',w:.24}]
  let x=gx
  segs.forEach(s=>{
    const sw=pw*s.w
    ctx.fillStyle=s.color; ctx.fillRect(x,gy,sw,gh)
    ctx.fillStyle='#fff'; ctx.font='8px Inter'; ctx.textAlign='center'
    ctx.fillText(s.label,x+sw/2,gy+gh+10); x+=sw
  })
  if (bmiVal>0) {
    const norm=Math.min(Math.max((bmiVal-10)/30,0),1)
    const mx=gx+norm*pw
    ctx.fillStyle=INK; ctx.beginPath()
    ctx.moveTo(mx,gy-1); ctx.lineTo(mx-6,gy-10); ctx.lineTo(mx+6,gy-10); ctx.closePath(); ctx.fill()
  }
}

const inputStyle={width:'100%',background:'#FFFFFF',border:'2px solid '+INK,color:INK,borderRadius:0,padding:'0 12px',height:36,fontFamily:SANS,fontSize:13,outline:'none'}
const selectStyle={...inputStyle,cursor:'pointer'}
const btnLime={cursor:'pointer',border:'2px solid '+INK,borderRadius:0,fontFamily:SANS,fontSize:12,fontWeight:700,display:'inline-flex',alignItems:'center',gap:6,whiteSpace:'nowrap',background:LIME,color:INK,padding:'0 16px',height:38,textTransform:'uppercase',letterSpacing:0.3}
const btnNav={...btnLime,background:'#fff',fontWeight:600,textTransform:'none',letterSpacing:0}
const btnDark={...btnLime,background:INK,color:'#fff'}
const btnGreen={...btnLime,background:GREEN,color:'#fff'}
const btnBlue={...btnLime,background:BLUE,color:'#fff'}
const btnRoad={...btnLime,background:ROAD,color:'#fff'}

const cardBox={background:CARD,border:'2px solid '+INK}

// ── AI CHAT WIDGET ────────────────────────────────────────────────
function AIChatWidget({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '👋 Привет! Я ИИ-ассистент марафона Marathon Skills 2026. Спроси меня о марафоне, подготовке, питании или регистрации!' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  const send = async () => {
    const txt = input.trim()
    if (!txt || loading) return
    setInput('')
    const newMsgs = [...messages, { role: 'user', content: txt }]
    setMessages(newMsgs)
    setLoading(true)
    try {
      const r = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMsgs.slice(1).map(m => ({ role: m.role, content: m.content }))
        })
      })
      const data = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || '...' }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: '❌ Ошибка соединения. Попробуй ещё раз.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const suggestions = ['Как подготовиться к марафону?', 'Что такое "стена" на 35 км?', 'Как рассчитать ИМТ?', 'Сколько пить воды во время забега?']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(22,20,15,.5)',display:'flex',alignItems:'flex-end',justifyContent:'flex-end',zIndex:300,padding:'0 20px 80px 0'}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{background:PAPER,border:'3px solid '+INK,boxShadow:'8px 8px 0 '+INK,width:'min(420px,95vw)',height:'min(600px,80vh)',display:'flex',flexDirection:'column'}}>
        {/* Header */}
        <div style={{background:INK,borderBottom:'3px solid '+LIME,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:LIME,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,border:'2px solid '+INK}}>🤖</div>
          <div>
            <div style={{fontWeight:800,fontSize:13,color:'#fff',fontFamily:DISPLAY,letterSpacing:0.5}}>ИИ-АССИСТЕНТ</div>
            <div style={{fontSize:9,color:LIME,fontFamily:MONO}}>● ОНЛАЙН · MARATHON SKILLS 2026</div>
          </div>
          <button style={{...btnNav,marginLeft:'auto',height:28,padding:'0 10px',fontSize:11,background:'transparent',color:'#fff',border:'2px solid #fff'}} onClick={onClose}>✕</button>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
          {messages.map((m,i) => (
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{
                maxWidth:'82%',padding:'9px 13px',
                background:m.role==='user'?LIME:CARD,border:'2px solid '+INK,
                fontSize:12,lineHeight:1.5,color:INK
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{background:CARD,border:'2px solid '+INK,padding:'8px 14px',fontSize:12,color:MUTE,fontFamily:MONO}}>
                ДУМАЮ...
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div style={{padding:'0 12px 6px',display:'flex',flexWrap:'wrap',gap:6,flexShrink:0}}>
            {suggestions.map(s => (
              <button key={s} style={{background:'#fff',border:'2px solid '+INK,borderRadius:0,padding:'4px 10px',fontSize:10,color:INK,cursor:'pointer',fontFamily:SANS}}
                onClick={() => { setInput(s) }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{padding:'10px 12px',borderTop:'2px solid '+INK,display:'flex',gap:8,flexShrink:0,background:'#fff'}}>
          <input
            style={{...inputStyle,flex:1,height:38,padding:'0 14px'}}
            placeholder="Задай вопрос о марафоне..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && send()}
            disabled={loading}
          />
          <button style={{...btnDark,height:38,width:38,padding:0,justifyContent:'center'}} onClick={send} disabled={loading}>
            ➤
          </button>
        </div>
      </div>
    </div>
  )
}

// ── IMPORT MODAL ──────────────────────────────────────────────────
function ImportModal({ open, onClose, onImported }) {
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef(null)

  const parseCSV = (text) => {
    const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h => h.replace(/"/g,'').trim())
    return lines.slice(1).map(line => {
      const vals = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch==='"') { inQ=!inQ } else if (ch===',' && !inQ) { vals.push(cur.trim()); cur='' } else cur+=ch
      }
      vals.push(cur.trim())
      const obj = {}
      headers.forEach((h,i) => { obj[h] = vals[i] || '' })
      return obj
    })
  }

  const handleFile = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setError(''); setStatus('')
    const text = await file.text()
    const rows = parseCSV(text)
    if (rows.length === 0) { setError('Файл пуст или неверный формат'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      })
      const data = await r.json()
      if (!r.ok) { setError(data.error); return }
      setStatus(`✅ Импортировано: ${data.imported} участников${data.skipped ? `, пропущено: ${data.skipped}` : ''}`)
      onImported()
    } catch (e) {
      setError('Ошибка импорта: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(22,20,15,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:250}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:PAPER,border:'3px solid '+INK,boxShadow:'8px 8px 0 '+INK,width:'min(480px,92vw)',padding:30}}>
        <div style={{fontSize:20,fontWeight:400,marginBottom:8,fontFamily:DISPLAY,letterSpacing:0.5}}>ИМПОРТ ИЗ CSV</div>
        <div style={{fontSize:11,color:MUTE,marginBottom:18,lineHeight:1.7}}>
          Файл должен содержать колонки: <b style={{color:INK}}>email, name (Имя), surname (Фамилия)</b> — обязательные.<br/>
          Опциональные: gender (Пол), role (Роль), country (Страна), dob (Дата рождения), bmi (ИМТ).
        </div>
        <input type="file" accept=".csv" ref={fileRef} onChange={handleFile} disabled={loading} style={{...inputStyle,height:38,padding:8,marginBottom:14}}/>
        {loading && <div style={{fontSize:11,color:MUTE,marginBottom:10,fontFamily:MONO}}>ЗАГРУЗКА...</div>}
        {status && <div style={{background:'#fff',border:'2px solid '+GREEN,padding:'8px 12px',fontSize:11,color:GREEN,marginBottom:10,fontWeight:600}}>{status}</div>}
        {error && <div style={{background:'#fff',border:'2px solid '+ROAD,padding:'8px 12px',fontSize:11,color:ROAD,marginBottom:10,fontWeight:600}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button style={{...btnNav,height:36}} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

// ── NAVBAR ────────────────────────────────────────────────────────
function Navbar({ onUsers, onRegister, onAdminLogin, session, isAdmin, onAdminLogout }) {
  return (
    <nav style={{background:INK,borderBottom:'3px solid '+LIME,height:64,display:'flex',alignItems:'center',padding:'0 18px',position:'sticky',top:0,zIndex:100,gap:12,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <div style={{width:38,height:38,background:LIME,border:'2px solid '+LIME,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,transform:'rotate(-4deg)'}}>🏃</div>
        <div>
          <div style={{fontSize:17,fontWeight:400,color:'#fff',fontFamily:DISPLAY,letterSpacing:0.5,lineHeight:1}}>MARATHON SKILLS</div>
          <div style={{fontSize:9,color:LIME,fontFamily:MONO,letterSpacing:1}}>2026 EDITION</div>
        </div>
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
        {session?.user ? (
          <>
            {isAdmin && <span style={{background:LIME,border:'2px solid '+LIME,padding:'4px 10px',fontSize:9,fontWeight:800,color:INK,fontFamily:MONO,letterSpacing:0.5}}>🔑 АДМИН</span>}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {session.user.image && <img src={session.user.image} alt="" width={30} height={30} style={{borderRadius:'50%',border:'2px solid '+LIME}}/>}
              <span style={{fontSize:11,color:'#fff',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.name?.split(' ')[0]}</span>
            </div>
            <button style={btnNav} onClick={onUsers}>👥 Участники</button>
            <button style={btnLime} onClick={onRegister}>✚ Регистрация</button>
            {isAdmin
              ? <button style={{...btnNav,color:ROAD}} onClick={onAdminLogout}>🚪 Выйти из адм.</button>
              : <button style={btnNav} onClick={onAdminLogin}>🔒 Админ</button>
            }
            <button style={{...btnNav,background:'transparent',color:'#fff',border:'2px solid #fff'}} onClick={() => signOut({callbackUrl:'/'})}>⏻</button>
          </>
        ) : (
          <button onClick={() => signIn('google', { callbackUrl: '/' })} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',color:INK,border:'2px solid #fff',borderRadius:0,padding:'8px 18px',fontSize:12,fontWeight:700,cursor:'pointer'}}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Войти через Google
          </button>
        )}
      </div>
    </nav>
  )
}

function TimerBar() {
  const time = useTimer()
  return (
    <div style={{background:INK,borderTop:'3px solid '+LIME,height:44,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:LIME,flexShrink:0,fontFamily:MONO,letterSpacing:1,overflow:'hidden'}}>
      ⏱ {time}
    </div>
  )
}

// ── ГЛАВНАЯ СТРАНИЦА (ЭКСПОРТ ПО УМОЛЧАНИЮ) ───────────────────────
export default function HomePage() {
  const { data: session } = useSession()
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)

  // Временные функции-заглушки для демонстрации кнопок
  const handleUsersClick = () => alert('Открытие списка участников...')
  const handleRegisterClick = () => alert('Открытие формы регистрации...')
  const handleAdminLogin = () => { setIsAdmin(true); alert('Вы вошли как админ!') }
  const handleAdminLogout = () => { setIsAdmin(false); alert('Вы вышли из режима админа') }
  const handleImported = () => alert('Импорт успешно завершен!')

  return (
    <div style={{ background: '#F7F4EC', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#16140F', fontFamily: "'Inter', sans-serif" }}>
      {/* Шапка сайта */}
      <Navbar 
        session={session} 
        isAdmin={isAdmin}
        onUsers={handleUsersClick}
        onRegister={handleRegisterClick}
        onAdminLogin={handleAdminLogin}
        onAdminLogout={handleAdminLogout}
      />

      {/* Основной контент */}
      <main style={{ flex: 1, padding: '40px 20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div style={{ background: '#FFFFFF', border: '2px solid #16140F', padding: '30px', boxShadow: '8px 8px 0 #16140F' }}>
          <h1 style={{ fontFamily: "'Anton', sans-serif", fontSize: '32px', marginBottom: '16px', letterSpacing: '0.5px' }}>
            ДОБРО ПОЖАЛОВАТЬ НА MARATHON SKILLS 2026!
          </h1>
          <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '24px', color: '#6B6655' }}>
            Готовьтесь к самому масштабному беговому событию года. Используйте навигацию выше для регистрации или просмотра участников.
          </p>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button style={{ ...btnDark, height: '40px' }} onClick={() => setIsChatOpen(true)}>
              🤖 Открыть ИИ-ассистента
            </button>
            {isAdmin && (
              <button style={{ ...btnLime, height: '40px' }} onClick={() => setIsImportOpen(true)}>
                📥 Импорт участников (CSV)
              </button>
            )}
          </div>
        </div>
      </main>

      {/* Виджет чата */}
      <AIChatWidget open={isChatOpen} onClose={() => setIsChatOpen(false)} />

      {/* Модальное окно импорта */}
      <ImportModal open={isImportOpen} onClose={() => setIsImportOpen(false)} onImported={handleImported} />

      {/* Подвал с таймером обратно отсчета */}
      <TimerBar />
    </div>
  )
}
