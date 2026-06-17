import { useSession, signOut, signIn } from 'next-auth/react'
import { useEffect, useRef, useState, useCallback } from 'react'

const COUNTRIES = [
  'Казахстан','Россия','США','Германия','Франция','Великобритания','Китай','Япония',
  'Бразилия','Канада','Австралия','Индия','Италия','Испания','Нидерланды','Польша',
  'Швеция','Норвегия','Финляндия','Дания','Швейцария','Австрия','Украина','Беларусь',
  'Узбекистан','Кыргызстан','Азербайджан','Грузия','Армения','Молдова','Другая страна'
]

function useTimer() {
  const [time, setTime] = useState({ d:0, h:0, m:0, s:0, started:false })
  useEffect(() => {
    const target = new Date('2026-06-15T09:00:00')
    const tick = () => {
      const diff = target - new Date()
      if (diff <= 0) { setTime({ started: true }); return }
      setTime({
        d: Math.floor(diff/86400000),
        h: Math.floor((diff%86400000)/3600000),
        m: Math.floor((diff%3600000)/60000),
        s: Math.floor((diff%60000)/1000),
        started: false
      })
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const C_BLUE='#1D3557', C_GREEN='#2D6A4F', C_YELLOW='#E9C46A', C_RED='#D62828', C_MUTED='#888'

function bmiCategory(v) {
  if (!v) return ''
  if (v < 18.5) return 'Недостаточный вес'
  if (v < 25)   return 'Здоровый вес'
  if (v < 30)   return 'Избыточный вес'
  return 'Ожирение'
}
function bmiColor(v) {
  if (!v) return C_MUTED
  if (v < 18.5) return C_BLUE
  if (v < 25)   return C_GREEN
  if (v < 30)   return C_YELLOW
  return C_RED
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
  ctx.font='bold 13px Oswald'; ctx.fillStyle=bc; ctx.textAlign='center'
  ctx.fillText(gender==='Женский'?'♀':'♂',cx,h-5)
}

function drawGaugeOnCanvas(canvas, bmiVal) {
  if (!canvas) return
  const pw=(canvas.offsetWidth||400)-20
  canvas.width=canvas.offsetWidth||400; canvas.height=canvas.offsetHeight||56
  const ctx=canvas.getContext('2d'); ctx.clearRect(0,0,canvas.width,canvas.height)
  const gx=10,gy=14,gh=16
  const segs=[{color:C_BLUE,label:'Недостат.',w:.22},{color:C_GREEN,label:'Здоровый',w:.30},{color:C_YELLOW,label:'Избыточ.',w:.24},{color:C_RED,label:'Ожирение',w:.24}]
  let x=gx
  segs.forEach(s=>{
    const sw=pw*s.w
    ctx.fillStyle=s.color; ctx.fillRect(x,gy,sw,gh)
    ctx.fillStyle='#0A0A0A'; ctx.font='8px Inter'; ctx.textAlign='center'
    ctx.fillText(s.label,x+sw/2,gy+gh+10); x+=sw
  })
  if (bmiVal>0) {
    const norm=Math.min(Math.max((bmiVal-10)/30,0),1)
    const mx=gx+norm*pw
    ctx.fillStyle='#0A0A0A'; ctx.beginPath()
    ctx.moveTo(mx,gy-1); ctx.lineTo(mx-6,gy-10); ctx.lineTo(mx+6,gy-10); ctx.closePath(); ctx.fill()
  }
}

// ─── DESIGN TOKENS ────────────────────────────────────────────────
const T = {
  red: '#D62828',
  black: '#0A0A0A',
  cream: '#F5F0E8',
  paper: '#FFFDF8',
  ink: '#1A1A1A',
  gray: '#6B6B6B',
  lightgray: '#E0DAD0',
  blue: '#1D3557',
}

const inputS = {
  width:'100%',
  background:'#FFFDF8',
  border:'2px solid #1A1A1A',
  color:'#1A1A1A',
  borderRadius:0,
  padding:'0 10px',
  height:36,
  fontFamily:"'Inter', sans-serif",
  fontSize:13,
  outline:'none',
}
const selectS = {...inputS}

const btnRed = {
  cursor:'pointer',
  border:'2px solid #D62828',
  borderRadius:0,
  fontFamily:"'Oswald', sans-serif",
  fontSize:13,
  letterSpacing:1,
  textTransform:'uppercase',
  display:'inline-flex',
  alignItems:'center',
  gap:6,
  whiteSpace:'nowrap',
  background:'#D62828',
  color:'#FFFDF8',
  padding:'0 18px',
  height:38,
  fontWeight:600,
}
const btnOutline = {
  ...btnRed,
  background:'transparent',
  color:'#1A1A1A',
  border:'2px solid #1A1A1A',
}
const btnGhost = {
  ...btnRed,
  background:'transparent',
  color:'#D62828',
  border:'2px solid #D62828',
}
const btnBlack = {
  ...btnRed,
  background:'#0A0A0A',
  color:'#F5F0E8',
  border:'2px solid #0A0A0A',
}
const btnGreen = {...btnRed, background:'#2D6A4F', border:'2px solid #2D6A4F'}
const btnBlue2 = {...btnRed, background:'#1D3557', border:'2px solid #1D3557'}

// ─── TIMER BAR ────────────────────────────────────────────────────
function TimerBar() {
  const t = useTimer()
  if (t.started) return (
    <div style={{background:'#D62828',color:'#FFFDF8',height:48,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',cursive",fontSize:22,letterSpacing:3,flexShrink:0}}>
      МАРАФОН НАЧАЛСЯ — ВПЕРЁД!
    </div>
  )
  return (
    <div style={{background:'#0A0A0A',color:'#F5F0E8',height:48,display:'flex',alignItems:'center',justifyContent:'center',gap:32,flexShrink:0,flexWrap:'wrap',padding:'0 16px'}}>
      {[['ДН', t.d], ['ЧС', t.h], ['МН', t.m], ['СК', t.s]].map(([lbl,val])=>(
        <div key={lbl} style={{display:'flex',alignItems:'baseline',gap:5}}>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,letterSpacing:2,color:'#D62828',minWidth:36,textAlign:'center'}}>{String(val||0).padStart(2,'0')}</span>
          <span style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase'}}>{lbl}</span>
        </div>
      ))}
      <span style={{fontFamily:"'Oswald',sans-serif",fontSize:11,letterSpacing:2,color:'#888',textTransform:'uppercase'}}>до старта</span>
    </div>
  )
}

// ─── NAVBAR ───────────────────────────────────────────────────────
function Navbar({ onUsers, onRegister, onAdminLogin, session, isAdmin, onAdminLogout }) {
  return (
    <nav style={{background:'#FFFDF8',borderBottom:'3px solid #0A0A0A',height:64,display:'flex',alignItems:'center',padding:'0 24px',position:'sticky',top:0,zIndex:100,gap:12,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:0,cursor:'pointer'}} onClick={()=>{}}>
        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:3,color:'#D62828',lineHeight:1}}>MARATHON</span>
        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:3,color:'#0A0A0A',lineHeight:1,marginLeft:8}}>SKILLS</span>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#888',marginLeft:10,paddingLeft:10,borderLeft:'2px solid #E0DAD0',lineHeight:1}}>2026</span>
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
        {session?.user ? (
          <>
            {isAdmin && <span style={{background:'#0A0A0A',color:'#D62828',fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,padding:'3px 10px',textTransform:'uppercase'}}>ADMIN</span>}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {session.user.image && <img src={session.user.image} alt="" width={28} height={28} style={{borderRadius:0,border:'2px solid #0A0A0A'}}/>}
              <span style={{fontFamily:"'Oswald',sans-serif",fontSize:13,color:'#1A1A1A',letterSpacing:1}}>{session.user.name?.split(' ')[0]}</span>
            </div>
            <button style={btnOutline} onClick={onUsers}>УЧАСТНИКИ</button>
            <button style={btnRed} onClick={onRegister}>+ РЕГИСТРАЦИЯ</button>
            {isAdmin
              ? <button style={btnGhost} onClick={onAdminLogout}>ВЫЙТИ</button>
              : <button style={btnOutline} onClick={onAdminLogin}>АДМИН</button>
            }
            <button style={{...btnOutline,padding:'0 10px',color:'#888',border:'2px solid #E0DAD0'}} onClick={() => signOut({callbackUrl:'/'})}>✕</button>
          </>
        ) : (
          <button onClick={() => signIn('google', { callbackUrl: '/' })} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#0A0A0A',color:'#FFFDF8',border:'none',borderRadius:0,padding:'10px 20px',fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:1,cursor:'pointer',textTransform:'uppercase'}}>
            <svg width="16" height="16" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Войти
          </button>
        )}
      </div>
    </nav>
  )
}

// ─── AI CHAT WIDGET ───────────────────────────────────────────────
function AIChatWidget({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Привет! Я ИИ-ассистент Marathon Skills 2026. Спроси о подготовке, питании или регистрации.' }
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
        body: JSON.stringify({ messages: newMsgs.slice(1).map(m => ({ role: m.role, content: m.content })) })
      })
      const data = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || '...' }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Ошибка соединения. Попробуй ещё раз.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  const suggestions = ['Как подготовиться к марафону?', 'Что такое «стена» на 35 км?', 'Как рассчитать ИМТ?', 'Сколько пить воды?']

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,10,10,.7)',display:'flex',alignItems:'flex-end',justifyContent:'flex-end',zIndex:300,padding:'0 24px 24px 0'}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{background:'#FFFDF8',border:'3px solid #0A0A0A',width:'min(420px,95vw)',height:'min(580px,80vh)',display:'flex',flexDirection:'column',boxShadow:'6px 6px 0 #D62828'}}>
        <div style={{background:'#D62828',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:'#FFFDF8'}}>ИИ-АССИСТЕНТ</span>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'rgba(255,255,255,.6)',marginLeft:'auto',background:'rgba(0,0,0,.2)',padding:'2px 6px'}}>ONLINE</span>
          <button style={{background:'transparent',border:'1px solid rgba(255,255,255,.4)',color:'#FFFDF8',cursor:'pointer',width:26,height:26,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'inherit',fontSize:12}} onClick={onClose}>✕</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'14px',display:'flex',flexDirection:'column',gap:10,background:'#F5F0E8'}}>
          {messages.map((m,i) => (
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{
                maxWidth:'82%',padding:'8px 12px',
                background:m.role==='user'?'#0A0A0A':'#FFFDF8',
                border:'2px solid #0A0A0A',
                fontSize:12,lineHeight:1.5,
                color:m.role==='user'?'#FFFDF8':'#1A1A1A',
                fontFamily:"'Inter', sans-serif",
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{background:'#FFFDF8',border:'2px solid #E0DAD0',padding:'8px 14px',fontSize:12,color:'#888',fontFamily:"'JetBrains Mono',monospace"}}>...</div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>
        {messages.length <= 2 && (
          <div style={{padding:'0 12px 8px',display:'flex',flexWrap:'wrap',gap:4,flexShrink:0,background:'#F5F0E8'}}>
            {suggestions.map(s => (
              <button key={s} style={{background:'transparent',border:'1px solid #E0DAD0',padding:'4px 10px',fontSize:10,color:'#6B6B6B',cursor:'pointer',fontFamily:"'Inter',sans-serif"}}
                onClick={() => setInput(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{padding:'10px 12px',borderTop:'2px solid #0A0A0A',display:'flex',gap:8,flexShrink:0,background:'#FFFDF8'}}>
          <input
            style={{...inputS,flex:1,height:38}}
            placeholder="Задайте вопрос..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && send()}
            disabled={loading}
          />
          <button style={btnRed} onClick={send} disabled={loading}>→</button>
        </div>
      </div>
    </div>
  )
}

// ─── IMPORT MODAL ─────────────────────────────────────────────────
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
      setStatus(`Импортировано: ${data.imported} участников${data.skipped ? `, пропущено: ${data.skipped}` : ''}`)
      onImported()
    } catch (e) {
      setError('Ошибка импорта: ' + e.message)
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,10,10,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:250}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#FFFDF8',border:'3px solid #0A0A0A',width:'min(480px,92vw)',padding:28,boxShadow:'6px 6px 0 #D62828'}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:22,letterSpacing:2,marginBottom:6,color:'#0A0A0A'}}>ИМПОРТ ИЗ CSV</div>
        <div style={{fontSize:11,color:'#888',marginBottom:16,lineHeight:1.7,fontFamily:"'Inter',sans-serif"}}>
          Обязательные колонки: <strong style={{color:'#1A1A1A'}}>email, name, surname</strong><br/>
          Опциональные: gender, role, country, dob, bmi. Кодировка UTF-8.
        </div>
        <div style={{background:'#F5F0E8',border:'2px dashed #E0DAD0',padding:'24px',textAlign:'center',cursor:'pointer',marginBottom:14}}
          onClick={() => fileRef.current?.click()}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:2,color:'#E0DAD0',marginBottom:6}}>CSV</div>
          <div style={{fontSize:12,color:'#888',fontFamily:"'Inter',sans-serif"}}>Нажмите для выбора файла</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={handleFile}/>
        </div>
        {loading && <div style={{textAlign:'center',color:'#888',fontSize:11,marginBottom:10,fontFamily:"'JetBrains Mono',monospace"}}>загрузка...</div>}
        {status && <div style={{background:'#F0FFF4',border:'2px solid #2D6A4F',padding:'8px 12px',fontSize:11,color:'#2D6A4F',marginBottom:10,fontFamily:"'Inter',sans-serif"}}>{status}</div>}
        {error && <div style={{background:'#FFF0F0',border:'2px solid #D62828',padding:'8px 12px',fontSize:11,color:'#D62828',marginBottom:10,fontFamily:"'Inter',sans-serif"}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button style={btnOutline} onClick={onClose}>ЗАКРЫТЬ</button>
        </div>
      </div>
    </div>
  )
}

// ─── REGISTER MODAL ───────────────────────────────────────────────
function RegisterModal({ open, onClose, onSave, editData }) {
  const isEdit = !!editData
  const [form, setForm] = useState({email:'',password:'',password2:'',name:'',surname:'',gender:'Мужской',role:'Бегун',country:'Казахстан',dob:'1990-01-01',photo:'',photoName:''})
  const [msg, setMsg] = useState({text:'',ok:false})

  useEffect(() => {
    if (editData) {
      setForm({email:editData.email||'',password:'',password2:'',name:editData.name||'',surname:editData.surname||'',gender:editData.gender||'Мужской',role:editData.role||'Бегун',country:editData.country||'Казахстан',dob:editData.dob||'1990-01-01',photo:editData.photo||'',photoName:editData.photo?'фото загружено':''})
    } else {
      setForm({email:'',password:'',password2:'',name:'',surname:'',gender:'Мужской',role:'Бегун',country:'Казахстан',dob:'1990-01-01',photo:'',photoName:''})
    }
    setMsg({text:'',ok:false})
  }, [editData, open])

  const set = (k,v) => setForm(f => ({...f,[k]:v}))
  const onPhoto = (e) => { const file=e.target.files[0]; if(!file)return; const r=new FileReader(); r.onload=ev=>set('photo',ev.target.result); r.readAsDataURL(file); set('photoName',file.name) }

  const submit = async () => {
    if (!form.email||!form.name||!form.surname) { setMsg({text:'Заполните все обязательные поля.',ok:false}); return }
    if (!isEdit&&form.password.length<6) { setMsg({text:'Пароль минимум 6 символов.',ok:false}); return }
    if (!isEdit&&form.password!==form.password2) { setMsg({text:'Пароли не совпадают.',ok:false}); return }
    await onSave({email:form.email,name:form.name,surname:form.surname,gender:form.gender,role:form.role,country:form.country,dob:form.dob,photo:form.photo}, editData?.id)
    setMsg({text:isEdit?'Данные обновлены!':'Участник зарегистрирован!',ok:true})
    setTimeout(() => { onClose(); setMsg({text:'',ok:false}) }, 900)
  }

  if (!open) return null
  const Label = ({children}) => <label style={{color:'#888',fontFamily:"'Oswald',sans-serif",fontSize:11,letterSpacing:1,textTransform:'uppercase',display:'block',marginBottom:4}}>{children}</label>
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,10,10,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#FFFDF8',border:'3px solid #0A0A0A',width:'min(860px,95vw)',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'8px 8px 0 #D62828'}}>
        <div style={{background:'#0A0A0A',height:52,display:'flex',alignItems:'center',padding:'0 20px',gap:10,flexShrink:0}}>
          <button style={{...btnGhost,height:30,padding:'0 12px',fontSize:11,border:'1px solid #D62828'}} onClick={onClose}>← НАЗАД</button>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:3,color:'#FFFDF8',marginLeft:8}}>{isEdit?'РЕДАКТИРОВАНИЕ':'РЕГИСТРАЦИЯ УЧАСТНИКА'}</span>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 30px 24px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:24}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr',gap:12}}>
              <div>
                <Label>Email</Label>
                <input style={inputS} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="user@example.com"/>
              </div>
              {!isEdit && <>
                <div>
                  <Label>Пароль</Label>
                  <input style={inputS} type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Минимум 6 символов"/>
                </div>
                <div>
                  <Label>Повтор пароля</Label>
                  <input style={inputS} type="password" value={form.password2} onChange={e=>set('password2',e.target.value)}/>
                </div>
              </>}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <Label>Имя</Label>
                  <input style={inputS} value={form.name} onChange={e=>set('name',e.target.value)}/>
                </div>
                <div>
                  <Label>Фамилия</Label>
                  <input style={inputS} value={form.surname} onChange={e=>set('surname',e.target.value)}/>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div>
                  <Label>Пол</Label>
                  <select style={selectS} value={form.gender} onChange={e=>set('gender',e.target.value)}><option>Мужской</option><option>Женский</option></select>
                </div>
                <div>
                  <Label>Роль</Label>
                  <select style={selectS} value={form.role} onChange={e=>set('role',e.target.value)}><option>Бегун</option><option>Координатор</option></select>
                </div>
              </div>
            </div>
            <div>
              <Label>Фото</Label>
              <div style={{background:'#F5F0E8',border:'2px solid #E0DAD0',height:120,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',marginBottom:8}} onClick={()=>document.getElementById('photoFileInput').click()}>
                {form.photo ? <img src={form.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{textAlign:'center'}}><div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,color:'#E0DAD0',letterSpacing:2}}>ФОТО</div><div style={{fontSize:9,color:'#888',fontFamily:"'Inter',sans-serif"}}>нажмите для выбора</div></div>}
              </div>
              <input type="file" id="photoFileInput" accept="image/*" style={{display:'none'}} onChange={onPhoto}/>
              <div>
                <Label>Дата рождения</Label>
                <input style={inputS} type="date" value={form.dob} onChange={e=>set('dob',e.target.value)}/>
              </div>
              <div style={{marginTop:12}}>
                <Label>Страна</Label>
                <select style={selectS} value={form.country} onChange={e=>set('country',e.target.value)}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
              </div>
            </div>
          </div>
          {msg.text && <div style={{textAlign:'center',fontWeight:600,fontSize:12,padding:'10px',margin:'14px 0 0',background:msg.ok?'#F0FFF4':'#FFF0F0',border:`2px solid ${msg.ok?'#2D6A4F':'#D62828'}`,color:msg.ok?'#2D6A4F':'#D62828',fontFamily:"'Inter',sans-serif"}}>{msg.text}</div>}
          <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:16}}>
            <button style={{...btnRed,height:42,fontSize:13,padding:'0 28px'}} onClick={submit}>{isEdit?'СОХРАНИТЬ':'ЗАРЕГИСТРИРОВАТЬСЯ'}</button>
            <button style={{...btnOutline,height:42}} onClick={onClose}>ОТМЕНА</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── PROFILE MODAL ────────────────────────────────────────────────
function ProfileModal({ open, onClose, participant, isAdmin, onEdit, onBMI }) {
  if (!open||!participant) return null
  const p = participant
  const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const formatDate=(dob)=>{ if(!dob)return'—'; const[y,m,d]=dob.split('-'); return`${parseInt(d)} ${months[parseInt(m)-1]} ${y}` }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,10,10,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#FFFDF8',border:'3px solid #0A0A0A',width:'min(560px,95vw)',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'8px 8px 0 #D62828'}}>
        <div style={{background:'#0A0A0A',height:52,display:'flex',alignItems:'center',padding:'0 20px',gap:10}}>
          <button style={{...btnGhost,height:30,padding:'0 12px',fontSize:11,border:'1px solid #D62828'}} onClick={onClose}>← ЗАКРЫТЬ</button>
          <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:3,color:'#FFFDF8',marginLeft:8}}>ПРОФИЛЬ</span>
          {isAdmin && <button style={{...btnRed,height:30,padding:'0 12px',fontSize:11,marginLeft:'auto'}} onClick={()=>onEdit(p)}>РЕДАКТИРОВАТЬ</button>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'24px 28px'}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20,paddingBottom:20,borderBottom:'2px solid #E0DAD0'}}>
            <div style={{width:80,height:80,background:'#F5F0E8',border:'2px solid #E0DAD0',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,overflow:'hidden',flexShrink:0}}>
              {p.photo?<img src={p.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{p.gender==='Женский'?'♀':'♂'}</span>}
            </div>
            <div>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:2,color:'#0A0A0A',lineHeight:1}}>{p.name} {p.surname}</div>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:12,letterSpacing:2,color:'#D62828',textTransform:'uppercase',marginTop:4}}>{p.role}</div>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#888',marginTop:2}}>{p.email}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
            {[['Пол',p.gender],['Дата рождения',formatDate(p.dob)],['Страна',p.country||'—'],['ИМТ',p.bmi?p.bmi.toFixed(1):'—'],['Роль',p.role],['Зарегистрирован',p.created_at?new Date(p.created_at).toLocaleDateString('ru'):'—']].map(([lbl,val])=>(
              <div key={lbl} style={{background:'#F5F0E8',border:'1px solid #E0DAD0',padding:'10px 14px'}}>
                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>{lbl}</div>
                <div style={{fontFamily:"'Inter',sans-serif",fontSize:13,fontWeight:500,color:'#1A1A1A'}}>{val}</div>
              </div>
            ))}
          </div>
          {isAdmin && <div style={{display:'flex',gap:10,justifyContent:'center'}}><button style={btnRed} onClick={()=>onBMI(p)}>РАССЧИТАТЬ ИМТ</button></div>}
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ open, name, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(10,10,10,.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}}>
      <div style={{background:'#FFFDF8',border:'3px solid #D62828',padding:'32px 40px',textAlign:'center',width:'min(380px,90vw)',boxShadow:'6px 6px 0 #0A0A0A'}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:24,letterSpacing:2,marginBottom:8,color:'#D62828'}}>УДАЛИТЬ УЧАСТНИКА?</div>
        <div style={{fontSize:13,color:'#888',marginBottom:24,fontFamily:"'Inter',sans-serif"}}>{name}</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button style={{...btnRed,background:'#D62828'}} onClick={onConfirm}>УДАЛИТЬ</button>
          <button style={btnOutline} onClick={onCancel}>ОТМЕНА</button>
        </div>
      </div>
    </div>
  )
}

// ─── BMI PAGE ─────────────────────────────────────────────────────
function BMIPage({ runner, onBack, onSave }) {
  const [height, setHeight] = useState('170')
  const [weight, setWeight] = useState('70')
  const [gender, setGender] = useState('Мужской')
  const [bmiVal, setBmiVal] = useState(0)
  const figRef = useRef(null), gaugeRef = useRef(null)

  useEffect(() => { if (runner) setGender(runner.gender||'Мужской'); setBmiVal(0) }, [runner])
  useEffect(() => { drawFigureOnCanvas(figRef.current,bmiVal,gender); drawGaugeOnCanvas(gaugeRef.current,bmiVal) }, [bmiVal,gender])

  const calc = () => { const h=parseFloat(height),w=parseFloat(weight); if(!h||!w)return; setBmiVal(Math.round(w/((h/100)**2)*10)/10) }
  const color=bmiColor(bmiVal), cat=bmiCategory(bmiVal)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F5F0E8'}}>
      <nav style={{background:'#0A0A0A',height:52,display:'flex',alignItems:'center',padding:'0 20px',gap:10,flexShrink:0}}>
        <button style={{...btnGhost,height:30,padding:'0 12px',fontSize:11,border:'1px solid #D62828'}} onClick={onBack}>← НАЗАД</button>
        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:3,color:'#FFFDF8',margin:'0 auto'}}>ИМТ КАЛЬКУЛЯТОР</span>
        <button style={{...btnRed,height:30,width:140,fontSize:11}} onClick={()=>{ if(!bmiVal){alert('Сначала рассчитайте ИМТ.');return} onSave(bmiVal) }}>СОХРАНИТЬ</button>
      </nav>
      <div style={{flex:1,overflowY:'auto',padding:24}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,height:'calc(100% - 20px)'}}>
          <div style={{background:'#FFFDF8',border:'2px solid #E0DAD0',padding:20}}>
            <p style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#888',marginBottom:18,lineHeight:1.6}}>ИМТ = масса (кг) / рост² (м)</p>
            <div style={{marginBottom:16}}>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:8}}>Пол</div>
              {['Мужской','Женский'].map(g=>(<label key={g} style={{color:'#1A1A1A',cursor:'pointer',marginRight:20,display:'inline-flex',alignItems:'center',gap:6,fontFamily:"'Inter',sans-serif",fontSize:13}}><input type="radio" name="bmiGender" value={g} checked={gender===g} onChange={()=>setGender(g)}/> {g}</label>))}
            </div>
            {[['Рост',height,setHeight,'см'],['Вес',weight,setWeight,'кг']].map(([lbl,val,setter,unit])=>(
              <div key={lbl} style={{marginBottom:14}}>
                <div style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>{lbl} ({unit})</div>
                <input style={inputS} value={val} onChange={e=>setter(e.target.value.replace(/[^\d]/g,''))}/>
              </div>
            ))}
            <div style={{display:'flex',gap:10}}>
              <button style={btnRed} onClick={calc}>РАССЧИТАТЬ</button>
              <button style={btnOutline} onClick={()=>setBmiVal(0)}>СБРОС</button>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            <div style={{background:'#FFFDF8',border:'2px solid #E0DAD0',height:160,overflow:'hidden'}}><canvas ref={figRef} style={{width:'100%',height:'100%'}}/></div>
            <div style={{background:'#FFFDF8',border:'2px solid #E0DAD0',height:90,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:12}}>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:42,color:bmiVal?color:'#E0DAD0',letterSpacing:2,lineHeight:1}}>{bmiVal?bmiVal.toFixed(1):'--.-'}</div>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:13,color,letterSpacing:1,textTransform:'uppercase'}}>{cat||'введите данные'}</div>
            </div>
            <div style={{background:'#FFFDF8',border:'2px solid #E0DAD0',height:72,overflow:'hidden',padding:'8px 12px'}}><canvas ref={gaugeRef} style={{width:'100%',height:'100%'}}/></div>
          </div>
        </div>
      </div>
      <div style={{background:'#0A0A0A',height:44,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <span style={{fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:2,color:'#F5F0E8',textTransform:'uppercase'}}>{runner?`${runner.name} ${runner.surname}`:'...'}</span>
      </div>
    </div>
  )
}

// ─── ADMIN LOGIN PAGE ─────────────────────────────────────────────
function AdminLoginPage({ onBack, onLogin }) {
  const [login, setLogin] = useState(''), [pass, setPass] = useState(''), [err, setErr] = useState('')
  const doLogin = () => { if(login==='admin'&&pass==='admin123'){onLogin();setErr('')} else setErr('Неверный логин или пароль') }
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F5F0E8'}}>
      <nav style={{background:'#0A0A0A',height:58,display:'flex',alignItems:'center',padding:'0 20px',gap:10}}>
        <button style={{...btnGhost,border:'1px solid #D62828',height:30,padding:'0 12px',fontSize:11}} onClick={onBack}>← НАЗАД</button>
        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,letterSpacing:3,color:'#FFFDF8',marginLeft:8}}>MARATHON SKILLS 2026</span>
      </nav>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'#FFFDF8',border:'3px solid #0A0A0A',width:'min(380px,90vw)',padding:'36px 36px 32px',boxShadow:'8px 8px 0 #D62828'}}>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:26,letterSpacing:2,color:'#0A0A0A',textAlign:'center',marginBottom:4}}>ВХОД ДЛЯ АДМИНИСТРАТОРА</div>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'#888',textAlign:'center',marginBottom:24,letterSpacing:1}}>ОГРАНИЧЕННЫЙ ДОСТУП</div>
          {[['Логин',login,setLogin,'text'],['Пароль',pass,setPass,'password']].map(([lbl,val,setter,type])=>(
            <div key={lbl} style={{marginBottom:14}}>
              <div style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>{lbl}</div>
              <input style={inputS} type={type} value={val} onChange={e=>setter(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            </div>
          ))}
          {err && <div style={{color:'#D62828',fontSize:12,textAlign:'center',marginBottom:12,fontFamily:"'Inter',sans-serif"}}>{err}</div>}
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button style={{...btnRed,height:42,padding:'0 28px'}} onClick={doLogin}>ВОЙТИ</button>
            <button style={{...btnOutline,height:42,padding:'0 20px'}} onClick={onBack}>ОТМЕНА</button>
          </div>
        </div>
      </div>
      <TimerBar/>
    </div>
  )
}

// ─── USERS TABLE ──────────────────────────────────────────────────
function UsersPage({ participants, isAdmin, onBack, onProfile, onEdit, onDelete, onBMI, onExport, onImport, loading }) {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('Все роли')
  const [sort, setSort] = useState('По имени')
  const [page, setPage] = useState(1)
  const PER_PAGE = 15

  let list = [...participants]
  if (roleFilter !== 'Все роли') list = list.filter(p => p.role === roleFilter)
  if (search) { const q=search.toLowerCase(); list=list.filter(p=>`${p.name} ${p.surname} ${p.email}`.toLowerCase().includes(q)) }
  list.sort((a,b)=>{
    if (sort==='По имени')   return (a.name||'').localeCompare(b.name||'')
    if (sort==='По фамилии') return (a.surname||'').localeCompare(b.surname||'')
    if (sort==='По Email')   return (a.email||'').localeCompare(b.email||'')
    if (sort==='По роли')    return (a.role||'').localeCompare(b.role||'')
    if (sort==='По стране')  return (a.country||'').localeCompare(b.country||'')
    return 0
  })
  const pages = Math.max(1,Math.ceil(list.length/PER_PAGE))
  const paged = list.slice((page-1)*PER_PAGE, page*PER_PAGE)

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:'#F5F0E8'}}>
      <nav style={{background:'#0A0A0A',height:58,display:'flex',alignItems:'center',padding:'0 20px',gap:10,flexShrink:0,flexWrap:'wrap'}}>
        <button style={{...btnGhost,height:30,padding:'0 12px',fontSize:11,border:'1px solid #D62828'}} onClick={onBack}>← НАЗАД</button>
        <span style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:3,color:'#FFFDF8',marginLeft:8}}>MARATHON SKILLS 2026</span>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          {isAdmin && <>
            <button style={{...btnGreen,height:30,fontSize:11}} onClick={onExport}>↓ CSV</button>
            <button style={{...btnBlue2,height:30,fontSize:11}} onClick={onImport}>↑ ИМПОРТ</button>
            <button style={{...btnRed,height:30,fontSize:11}} onClick={()=>onEdit(null)}>+ ДОБАВИТЬ</button>
          </>}
        </div>
      </nav>

      <div style={{background:'#FFFDF8',borderBottom:'2px solid #E0DAD0',padding:'14px 20px'}}>
        <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,letterSpacing:2,color:'#0A0A0A',marginBottom:10}}>
          СПИСОК УЧАСТНИКОВ
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
          <div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>Роль</div>
            <select style={{...selectS,width:'auto',height:32,padding:'0 8px'}} value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(1)}}>
              <option>Все роли</option><option>Бегун</option><option>Координатор</option>
            </select>
          </div>
          <div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>Сортировка</div>
            <select style={{...selectS,width:'auto',height:32,padding:'0 8px'}} value={sort} onChange={e=>setSort(e.target.value)}>
              {['По имени','По фамилии','По Email','По роли','По стране'].map(o=><option key={o}>{o}</option>)}
            </select>
          </div>
          <div style={{flex:1,minWidth:200}}>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:2,color:'#888',textTransform:'uppercase',marginBottom:4}}>Поиск</div>
            <input style={{...inputS,height:32}} placeholder="Имя, фамилия, email..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
          </div>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {loading ? <div style={{textAlign:'center',padding:40,color:'#888',fontFamily:"'Oswald',sans-serif",letterSpacing:2}}>ЗАГРУЗКА...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{background:'#0A0A0A'}}>
                {['#','Имя','Фамилия','Email','Страна','ИМТ','Роль'].map(h=>(
                  <th key={h} style={{color:'#888',fontFamily:"'Oswald',sans-serif",fontWeight:400,fontSize:10,letterSpacing:2,textTransform:'uppercase',padding:'10px 14px',textAlign:'left',borderBottom:'none'}}>{h}</th>
                ))}
                {isAdmin && <><th style={{background:'#0A0A0A',width:44}}/><th style={{background:'#0A0A0A',width:44}}/></>}
              </tr>
            </thead>
            <tbody>
              {paged.map((p,i)=>(
                <tr key={p.id} style={{borderBottom:'1px solid #E0DAD0',cursor:'pointer',background:i%2===0?'#FFFDF8':'#F5F0E8'}}
                  onMouseEnter={e=>e.currentTarget.style.background='#EDE7DA'}
                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?'#FFFDF8':'#F5F0E8'}
                  onClick={()=>onProfile(p)}>
                  <td style={{padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#888'}}>{(page-1)*PER_PAGE+i+1}</td>
                  <td style={{padding:'9px 14px',fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:600,letterSpacing:0.5}}>{p.name}</td>
                  <td style={{padding:'9px 14px',fontFamily:"'Oswald',sans-serif",fontSize:13,fontWeight:600,letterSpacing:0.5}}>{p.surname}</td>
                  <td style={{padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'#1D3557'}}>{p.email}</td>
                  <td style={{padding:'9px 14px',fontFamily:"'Inter',sans-serif",fontSize:12}}>{p.country||'—'}</td>
                  <td style={{padding:'9px 14px',fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:p.bmi?bmiColor(p.bmi):'#E0DAD0',fontWeight:700}}>{p.bmi?p.bmi.toFixed(1):'—'}</td>
                  <td style={{padding:'9px 14px'}}>
                    <span style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:1,textTransform:'uppercase',color:p.role==='Бегун'?'#1D3557':'#6B3FA0',background:p.role==='Бегун'?'#E8F0F8':'#F3EDFF',padding:'2px 8px'}}>{p.role}</span>
                  </td>
                  {isAdmin && <>
                    <td style={{padding:'6px 4px'}} onClick={e=>{e.stopPropagation();onEdit(p)}}><button style={{background:'#F5F0E8',color:'#1A1A1A',border:'1px solid #E0DAD0',height:26,padding:'0 8px',cursor:'pointer',fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:1}}>РЕД</button></td>
                    <td style={{padding:'6px 4px'}} onClick={e=>{e.stopPropagation();onDelete(p)}}><button style={{background:'#FFF0F0',color:'#D62828',border:'1px solid #FFCDD2',height:26,padding:'0 8px',cursor:'pointer',fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:1}}>УДЛ</button></td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{background:'#FFFDF8',borderTop:'2px solid #0A0A0A',height:48,display:'flex',alignItems:'center',padding:'0 20px',flexShrink:0}}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#888'}}>ВСЕГО: {list.length}</span>
        <div style={{display:'flex',alignItems:'center',gap:10,margin:'0 auto'}}>
          <button style={{...btnOutline,width:60,height:30,fontSize:11,padding:0,justifyContent:'center'}} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>◀</button>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'#888',minWidth:80,textAlign:'center'}}>{page} / {pages}</span>
          <button style={{...btnOutline,width:60,height:30,fontSize:11,padding:0,justifyContent:'center'}} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>▶</button>
        </div>
      </div>
      <TimerBar/>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ══════════════════════════════════════════════════════════════════
export default function Home() {
  const { data: session, status } = useSession()

  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState('main')
  const [isAdmin, setIsAdmin] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profileTarget, setProfileTarget] = useState(null)
  const [bmiTarget, setBmiTarget] = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [aiChatOpen, setAiChatOpen] = useState(false)

  useEffect(() => { if (status==='authenticated') fetchParticipants() }, [status])

  const fetchParticipants = async () => {
    setLoading(true)
    try { const r=await fetch('/api/participants'); if(r.ok) setParticipants(await r.json()) }
    finally { setLoading(false) }
  }

  const saveParticipant = async (data, id) => {
    if (id) {
      const r=await fetch(`/api/participants/${id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      if(r.ok){const u=await r.json();setParticipants(ps=>ps.map(p=>p.id===id?u:p))}
    } else {
      const r=await fetch('/api/participants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      if(r.ok){const c=await r.json();setParticipants(ps=>[c,...ps])}
    }
  }

  const deleteParticipant = async (id) => {
    await fetch(`/api/participants/${id}`,{method:'DELETE'})
    setParticipants(ps=>ps.filter(p=>p.id!==id)); setConfirmTarget(null)
  }

  const saveBMI = async (bmiVal) => {
    if (!bmiTarget) return
    const r=await fetch(`/api/participants/${bmiTarget.id}`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...bmiTarget,bmi:bmiVal})})
    if(r.ok){const u=await r.json();setParticipants(ps=>ps.map(p=>p.id===bmiTarget.id?u:p))}
    setBmiTarget(null); setView('users')
  }

  const handleExport = () => { window.open('/api/export', '_blank') }

  const runners = participants.filter(p=>p.role==='Бегун').length
  const coords  = participants.filter(p=>p.role==='Координатор').length
  const bmis    = participants.filter(p=>p.bmi).map(p=>p.bmi)
  const avgBMI  = bmis.length?(bmis.reduce((a,b)=>a+b,0)/bmis.length).toFixed(1):'—'
  const topCountry = (()=>{ const c={}; participants.forEach(p=>{if(p.country)c[p.country]=(c[p.country]||0)+1}); return Object.entries(c).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—' })()

  if (status==='loading') return <div style={{background:'#F5F0E8',color:'#0A0A0A',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Bebas Neue',cursive",fontSize:28,letterSpacing:4}}>ЗАГРУЗКА...</div>

  // ── PUBLIC LANDING ───────────────────────────────────────────
  if (!session) {
    return (
      <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#F5F0E8'}}>
        <Navbar session={null} isAdmin={false} onUsers={()=>{}} onRegister={()=>{}} onAdminLogin={()=>{}} onAdminLogout={()=>{}}/>

        {/* HERO */}
        <div style={{background:'#0A0A0A',padding:'80px 24px 60px',textAlign:'center',position:'relative',overflow:'hidden'}}>
          {/* Decorative number */}
          <div style={{position:'absolute',right:'-5%',top:'50%',transform:'translateY(-50%)',fontFamily:"'Bebas Neue',cursive",fontSize:'clamp(120px,20vw,260px)',color:'rgba(214,40,40,0.08)',lineHeight:1,userSelect:'none',pointerEvents:'none'}}>42</div>
          <div style={{position:'relative',zIndex:1}}>
            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,letterSpacing:4,color:'#D62828',textTransform:'uppercase',marginBottom:16}}>АЛМАТЫ · 15 ИЮНЯ 2026</div>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:'clamp(52px,10vw,110px)',color:'#FFFDF8',lineHeight:.9,letterSpacing:4}}>MARATHON</div>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:'clamp(52px,10vw,110px)',color:'#D62828',lineHeight:.9,letterSpacing:4}}>SKILLS</div>
            <div style={{width:60,height:4,background:'#D62828',margin:'24px auto 24px'}}/>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:14,color:'#888',letterSpacing:2,textTransform:'uppercase'}}>42.195 КМ · ИСПЫТАНИЕ ВОЛИ И ДУХА</div>
          </div>
        </div>

        {/* SIGN IN CTA */}
        <div style={{background:'#D62828',padding:'28px 24px',textAlign:'center'}}>
          <div style={{fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:3,color:'rgba(255,255,255,.7)',textTransform:'uppercase',marginBottom:16}}>Войдите, чтобы зарегистрироваться</div>
          <button onClick={()=>signIn('google',{callbackUrl:'/'})} style={{display:'inline-flex',alignItems:'center',gap:10,background:'#FFFDF8',color:'#0A0A0A',border:'none',padding:'14px 32px',fontFamily:"'Oswald',sans-serif",fontSize:15,letterSpacing:2,cursor:'pointer',textTransform:'uppercase',boxShadow:'4px 4px 0 rgba(0,0,0,.3)'}}>
            <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Войти через Google
          </button>
        </div>

        {/* TOOLS */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',maxWidth:800,margin:'0 auto',width:'100%',borderBottom:'2px solid #E0DAD0'}}>
          <button onClick={()=>setAiChatOpen(true)} style={{background:'#FFFDF8',border:'none',borderRight:'2px solid #E0DAD0',padding:'28px 24px',cursor:'pointer',textAlign:'left'}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,letterSpacing:2,color:'#0A0A0A',marginBottom:6}}>ИИ-АССИСТЕНТ</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.6}}>Подготовка, питание, ИМТ, вопросы о марафоне</div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:11,letterSpacing:2,color:'#D62828',marginTop:10,textTransform:'uppercase'}}>Открыть чат →</div>
          </button>
          <a href="https://t.me/martthon_bot" target="_blank" rel="noopener noreferrer" style={{background:'#FFFDF8',padding:'28px 24px',textDecoration:'none',display:'block'}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:20,letterSpacing:2,color:'#0A0A0A',marginBottom:6}}>TELEGRAM БОТ</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.6}}>@martthon_bot · поиск участников, статистика, ИИ</div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:11,letterSpacing:2,color:'#1D3557',marginTop:10,textTransform:'uppercase'}}>@martthon_bot →</div>
          </a>
        </div>

        {/* INFO CARDS */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',maxWidth:800,margin:'0 auto',width:'100%'}}>
          {[
            ['01','ДИСТАНЦИЯ','42,195 км объединяют профессионалов и любителей в едином порыве. Алматы открывает свои улицы для бегунов.'],
            ['02','«СТЕНА»','На 30–35 км запасы гликогена истощаются. Здесь марафон только начинается — вопрос чистого упрямства.'],
            ['03','ФИНИШ','Пересечь черту — значит победить себя. Это помнят всю жизнь.'],
          ].map(([num,title,desc])=>(
            <div key={num} style={{borderRight:'1px solid #E0DAD0',borderBottom:'1px solid #E0DAD0',padding:'28px 24px',background:'#FFFDF8'}}>
              <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,color:'#D62828',letterSpacing:2,marginBottom:8}}>{num}</div>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:'#0A0A0A',marginBottom:8}}>{title}</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.7}}>{desc}</div>
            </div>
          ))}
        </div>

        <TimerBar/>
        <AIChatWidget open={aiChatOpen} onClose={()=>setAiChatOpen(false)}/>
      </div>
    )
  }

  if (view==='bmi') return <BMIPage runner={bmiTarget} onBack={()=>{setBmiTarget(null);setView('users')}} onSave={saveBMI}/>
  if (view==='adminLogin') return <AdminLoginPage onBack={()=>setView('main')} onLogin={()=>{setIsAdmin(true);setView('users')}}/>

  if (view==='users') {
    return (
      <>
        <UsersPage
          participants={participants} isAdmin={isAdmin} loading={loading}
          onBack={()=>setView('main')}
          onProfile={p=>{setProfileTarget(p);setProfileOpen(true)}}
          onEdit={p=>{setEditTarget(p);setRegisterOpen(true)}}
          onDelete={p=>setConfirmTarget(p)}
          onBMI={p=>{setBmiTarget(p);setView('bmi')}}
          onExport={handleExport}
          onImport={()=>setImportOpen(true)}
        />
        <RegisterModal open={registerOpen} onClose={()=>{setRegisterOpen(false);setEditTarget(null)}} onSave={saveParticipant} editData={editTarget}/>
        <ProfileModal open={profileOpen} participant={profileTarget} isAdmin={isAdmin}
          onClose={()=>{setProfileOpen(false);setProfileTarget(null)}}
          onEdit={p=>{setProfileOpen(false);setEditTarget(p);setRegisterOpen(true)}}
          onBMI={p=>{setProfileOpen(false);setBmiTarget(p);setView('bmi')}}/>
        <ConfirmModal open={!!confirmTarget} name={confirmTarget?`${confirmTarget.name} ${confirmTarget.surname}`:''}
          onConfirm={()=>deleteParticipant(confirmTarget.id)} onCancel={()=>setConfirmTarget(null)}/>
        <ImportModal open={importOpen} onClose={()=>setImportOpen(false)} onImported={fetchParticipants}/>
      </>
    )
  }

  // ── MAIN VIEW (authenticated) ────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#F5F0E8'}}>
      <Navbar onUsers={()=>setView('users')} onRegister={()=>{setEditTarget(null);setRegisterOpen(true)}} onAdminLogin={()=>setView('adminLogin')} session={session} isAdmin={isAdmin} onAdminLogout={()=>setIsAdmin(false)}/>

      {/* STATS STRIP */}
      <div style={{background:'#0A0A0A',display:'grid',gridTemplateColumns:'repeat(5,1fr)',borderBottom:'3px solid #D62828'}}>
        {[
          [runners,'БЕГУНОВ'],
          [coords,'КООРДИНАТОРОВ'],
          [avgBMI,'СРЕДНИЙ ИМТ'],
          [topCountry,'ТОП СТРАНА'],
          [participants.length,'ВСЕГО'],
        ].map(([val,lbl],i)=>(
          <div key={lbl} style={{padding:'14px 16px',borderRight:i<4?'1px solid #1A1A1A':undefined,textAlign:'center'}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:28,color:'#FFFDF8',letterSpacing:2,lineHeight:1}}>{val}</div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:2,color:'#888',textTransform:'uppercase',marginTop:4}}>{lbl}</div>
          </div>
        ))}
      </div>

      <div style={{flex:1,overflowY:'auto',padding:'28px 24px',maxWidth:900,margin:'0 auto',width:'100%'}}>

        {/* Page title */}
        <div style={{marginBottom:24,paddingBottom:16,borderBottom:'2px solid #E0DAD0'}}>
          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9,letterSpacing:3,color:'#D62828',textTransform:'uppercase',marginBottom:8}}>ПАНЕЛЬ УПРАВЛЕНИЯ</div>
          <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:36,letterSpacing:3,color:'#0A0A0A',lineHeight:1}}>MARATHON SKILLS 2026</div>
        </div>

        {/* Action buttons */}
        <div style={{display:'flex',gap:10,marginBottom:24,flexWrap:'wrap'}}>
          <button style={{...btnRed,height:44,fontSize:13,padding:'0 24px'}} onClick={()=>{setEditTarget(null);setRegisterOpen(true)}}>+ ЗАРЕГИСТРИРОВАТЬ</button>
          <button style={{...btnOutline,height:44,fontSize:13,padding:'0 20px'}} onClick={()=>setView('users')}>ВСЕ УЧАСТНИКИ</button>
          {isAdmin && <>
            <button style={{...btnGreen,height:44,fontSize:13}} onClick={handleExport}>↓ ВЫГРУЗИТЬ CSV</button>
            <button style={{...btnBlue2,height:44,fontSize:13}} onClick={()=>setImportOpen(true)}>↑ ИМПОРТ CSV</button>
          </>}
          <button style={{...btnBlack,height:44,fontSize:13}} onClick={()=>setAiChatOpen(true)}>ИИ-АССИСТЕНТ</button>
        </div>

        {/* Info cards grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:0,border:'2px solid #E0DAD0',marginBottom:20}}>
          {/* AI Chat */}
          <button onClick={()=>setAiChatOpen(true)} style={{background:'#FFFDF8',border:'none',borderRight:'1px solid #E0DAD0',borderBottom:'1px solid #E0DAD0',padding:'22px 20px',cursor:'pointer',textAlign:'left'}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:'#0A0A0A',marginBottom:6}}>ИИ-АССИСТЕНТ</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.6}}>Вопросы о подготовке, питании, ИМТ и регистрации</div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#D62828',marginTop:8,textTransform:'uppercase'}}>ОТКРЫТЬ ЧАТ →</div>
          </button>
          {/* Telegram */}
          <a href="https://t.me/martthon_bot" target="_blank" rel="noopener noreferrer" style={{background:'#FFFDF8',borderBottom:'1px solid #E0DAD0',padding:'22px 20px',textDecoration:'none',display:'block'}}>
            <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:18,letterSpacing:2,color:'#0A0A0A',marginBottom:6}}>TELEGRAM БОТ</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.6}}>@martthon_bot · поиск, статистика, ИИ</div>
            <div style={{fontFamily:"'Oswald',sans-serif",fontSize:10,letterSpacing:2,color:'#1D3557',marginTop:8,textTransform:'uppercase'}}>@MARTTHON_BOT →</div>
          </a>
          {/* Marathon facts */}
          {[
            ['МАРАФОН — ИСПЫТАНИЕ ВОЛИ','42,195 км — дистанция, которая объединяет профессионалов и любителей. Алматы открывает свои улицы.'],
            ['«СТЕНА» НА 30–35 КМ','Запасы гликогена истощаются. Дальше — только сила духа и тренировки.'],
          ].map(([title,desc],i)=>(
            <div key={title} style={{background:'#FFFDF8',padding:'22px 20px',borderRight:i===0?'1px solid #E0DAD0':undefined}}>
              <div style={{fontFamily:"'Bebas Neue',cursive",fontSize:16,letterSpacing:1.5,color:'#0A0A0A',marginBottom:6}}>{title}</div>
              <div style={{fontFamily:"'Inter',sans-serif",fontSize:12,color:'#888',lineHeight:1.6}}>{desc}</div>
            </div>
          ))}
        </div>

      </div>

      <TimerBar/>

      <RegisterModal open={registerOpen} onClose={()=>{setRegisterOpen(false);setEditTarget(null)}} onSave={saveParticipant} editData={editTarget}/>
      <ImportModal open={importOpen} onClose={()=>setImportOpen(false)} onImported={fetchParticipants}/>
      <AIChatWidget open={aiChatOpen} onClose={()=>setAiChatOpen(false)}/>
    </div>
  )
}
