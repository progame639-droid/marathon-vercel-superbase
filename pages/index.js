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
      setTime(`⏱ До марафона: ${d}д ${h}ч ${m}м ${s}с`)
    }
    tick(); const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

const C_BLUE='#2196F3', C_GREEN='#4CAF50', C_YELLOW='#FF9800', C_RED='#E53935', C_MUTED='#8C8CA5'
function bmiCategory(v) {
  if (!v) return ''
  if (v < 18.5) return 'Недостаточный вес'
  if (v < 25)   return 'Здоровый вес ✓'
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
  ctx.font='bold 13px Segoe UI'; ctx.fillStyle=bc; ctx.textAlign='center'
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
    ctx.fillStyle='#fff'; ctx.font='8px Segoe UI'; ctx.textAlign='center'
    ctx.fillText(s.label,x+sw/2,gy+gh+10); x+=sw
  })
  if (bmiVal>0) {
    const norm=Math.min(Math.max((bmiVal-10)/30,0),1)
    const mx=gx+norm*pw
    ctx.fillStyle='#fff'; ctx.beginPath()
    ctx.moveTo(mx,gy-1); ctx.lineTo(mx-6,gy-10); ctx.lineTo(mx+6,gy-10); ctx.closePath(); ctx.fill()
  }
}

const inputStyle={width:'100%',background:'#23233E',border:'1px solid #35355A',color:'#E8E8F5',borderRadius:3,padding:'0 10px',height:30,fontFamily:'inherit',fontSize:11}
const selectStyle={...inputStyle}
const btnOrange={cursor:'pointer',border:'none',borderRadius:4,fontFamily:'inherit',fontSize:11,display:'inline-flex',alignItems:'center',gap:5,whiteSpace:'nowrap',background:'#E85D04',color:'#fff',padding:'0 14px',height:34,fontWeight:600}
const btnNav={...btnOrange,background:'#252540',fontWeight:400,border:'1px solid #35355A'}
const btnDark={...btnNav}
const btnGreen={...btnOrange,background:'#2E7D32'}
const btnBlue={...btnOrange,background:'#1565C0'}

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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.65)',display:'flex',alignItems:'flex-end',justifyContent:'flex-end',zIndex:300,padding:'0 20px 80px 0'}}
      onClick={e => e.target===e.currentTarget && onClose()}>
      <div style={{background:'#14142A',border:'1px solid #2D2D46',borderRadius:12,width:'min(420px,95vw)',height:'min(600px,80vh)',display:'flex',flexDirection:'column',boxShadow:'0 8px 40px rgba(0,0,0,.5)'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#1C1C33,#252548)',borderBottom:'2px solid #E85D04',borderRadius:'12px 12px 0 0',padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:'linear-gradient(135deg,#E85D04,#F4A33C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🤖</div>
          <div>
            <div style={{fontWeight:700,fontSize:13}}>ИИ-ассистент</div>
            <div style={{fontSize:9,color:'#4CAF50'}}>● Онлайн · Marathon Skills 2026</div>
          </div>
          <button style={{...btnDark,marginLeft:'auto',height:28,padding:'0 10px',fontSize:11}} onClick={onClose}>✕</button>
        </div>

        {/* Messages */}
        <div style={{flex:1,overflowY:'auto',padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
          {messages.map((m,i) => (
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start'}}>
              <div style={{
                maxWidth:'82%',padding:'8px 12px',borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',
                background:m.role==='user'?'#E85D04':'#1E1E36',border:m.role==='user'?'none':'1px solid #2D2D46',
                fontSize:12,lineHeight:1.5,color:'#E8E8F5'
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{display:'flex',justifyContent:'flex-start'}}>
              <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:'14px 14px 14px 4px',padding:'8px 14px',fontSize:12,color:'#8C8CA5'}}>
                💭 Думаю...
              </div>
            </div>
          )}
          <div ref={bottomRef}/>
        </div>

        {/* Suggestions */}
        {messages.length <= 2 && (
          <div style={{padding:'0 12px 6px',display:'flex',flexWrap:'wrap',gap:4,flexShrink:0}}>
            {suggestions.map(s => (
              <button key={s} style={{background:'#23233E',border:'1px solid #35355A',borderRadius:12,padding:'4px 10px',fontSize:10,color:'#8C8CA5',cursor:'pointer',fontFamily:'inherit'}}
                onClick={() => { setInput(s) }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{padding:'10px 12px',borderTop:'1px solid #2D2D46',display:'flex',gap:8,flexShrink:0}}>
          <input
            style={{...inputStyle,flex:1,borderRadius:20,height:36,padding:'0 14px'}}
            placeholder="Задай вопрос о марафоне..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key==='Enter' && send()}
            disabled={loading}
          />
          <button style={{...btnOrange,height:36,width:36,padding:0,borderRadius:'50%',justifyContent:'center'}} onClick={send} disabled={loading}>
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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:250}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#14142A',border:'1px solid #2D2D46',borderRadius:8,width:'min(480px,92vw)',padding:28}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:6}}>📥 Импорт из CSV</div>
        <div style={{fontSize:10,color:'#8C8CA5',marginBottom:16,lineHeight:1.6}}>
          Файл должен содержать колонки: <b>email, name (Имя), surname (Фамилия)</b> — обязательные.<br/>
          Опциональные: gender (Пол), role (Роль), country (Страна), dob (Дата рождения), bmi (ИМТ).<br/>
          Первая строка — заголовки. Кодировка UTF-8.
        </div>
        <div style={{background:'#1E1E36',border:'1px dashed #35355A',borderRadius:6,padding:'20px',textAlign:'center',cursor:'pointer',marginBottom:14}}
          onClick={() => fileRef.current?.click()}>
          <div style={{fontSize:28,marginBottom:6}}>📁</div>
          <div style={{fontSize:12,color:'#8C8CA5'}}>Нажмите для выбора CSV-файла</div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{display:'none'}} onChange={handleFile}/>
        </div>
        {loading && <div style={{textAlign:'center',color:'#F4A33C',fontSize:11,marginBottom:10}}>⏳ Импортируем...</div>}
        {status && <div style={{background:'rgba(76,175,80,.15)',border:'1px solid #4CAF50',borderRadius:4,padding:'8px 12px',fontSize:11,color:'#4CAF50',marginBottom:10}}>{status}</div>}
        {error && <div style={{background:'rgba(232,93,4,.15)',border:'1px solid #E85D04',borderRadius:4,padding:'8px 12px',fontSize:11,color:'#E85D04',marginBottom:10}}>{error}</div>}
        <div style={{display:'flex',justifyContent:'flex-end',gap:8}}>
          <button style={{...btnDark,height:34}} onClick={onClose}>Закрыть</button>
        </div>
      </div>
    </div>
  )
}

// ── NAVBAR ────────────────────────────────────────────────────────
function Navbar({ onUsers, onRegister, onAdminLogin, session, isAdmin, onAdminLogout }) {
  return (
    <nav style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:58,display:'flex',alignItems:'center',padding:'0 14px',position:'sticky',top:0,zIndex:100,gap:10,flexShrink:0}}>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:24}}>🏃</span>
        <div>
          <div style={{fontSize:13,fontWeight:700}}>MARATHON SKILLS</div>
          <div style={{fontSize:9,color:'#E85D04'}}>2026</div>
        </div>
      </div>
      <div style={{marginLeft:'auto',display:'flex',gap:8,alignItems:'center'}}>
        {session?.user ? (
          <>
            {isAdmin && <span style={{background:'#2D1F00',border:'1px solid #E85D04',borderRadius:4,padding:'3px 8px',fontSize:9,fontWeight:700,color:'#E85D04'}}>🔑 АДМИНИСТРАТОР</span>}
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              {session.user.image && <img src={session.user.image} alt="" width={28} height={28} style={{borderRadius:'50%',border:'2px solid #E85D04'}}/>}
              <span style={{fontSize:10,color:'#E8E8F5',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{session.user.name?.split(' ')[0]}</span>
            </div>
            <button style={btnNav} onClick={onUsers}>👥 &nbsp;Участники</button>
            <button style={btnOrange} onClick={onRegister}>✚ &nbsp;Регистрация</button>
            {isAdmin
              ? <button style={{...btnNav,color:'#F4A33C'}} onClick={onAdminLogout}>🚪 &nbsp;Выйти из адм.</button>
              : <button style={btnNav} onClick={onAdminLogin}>🔒 &nbsp;Админ</button>
            }
            <button style={{...btnNav,color:'#8C8CA5'}} onClick={() => signOut({callbackUrl:'/'})}>⏻</button>
          </>
        ) : (
          <button onClick={() => signIn('google', { callbackUrl: '/' })} style={{display:'inline-flex',alignItems:'center',gap:8,background:'#fff',color:'#1a1a2e',border:'none',borderRadius:6,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'}}>
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
    <div style={{background:'#11111F',borderTop:'2px solid #E85D04',height:40,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#E85D04',flexShrink:0}}>
      {time}
    </div>
  )
}

// ── REGISTER MODAL ────────────────────────────────────────────────
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
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#14142A',border:'1px solid #2D2D46',borderRadius:8,width:'min(860px,95vw)',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:52,display:'flex',alignItems:'center',padding:'0 14px',gap:10,flexShrink:0}}>
          <button style={btnNav} onClick={onClose}>← Назад</button>
          <span style={{fontSize:12,fontWeight:700}}>MARATHON SKILLS 2026</span>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 30px 20px'}}>
          <div style={{fontSize:20,fontWeight:700,color:'#F4A33C',textAlign:'center',marginBottom:4}}>{isEdit?'Редактирование':'Регистрация участника'}</div>
          <div style={{fontSize:10,color:'#8C8CA5',textAlign:'center',marginBottom:14}}>Заполните все поля для регистрации участника марафона</div>
          <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,padding:'20px'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 220px',gap:20}}>
              <div style={{display:'grid',gridTemplateColumns:'130px 1fr',gap:8,alignItems:'center'}}>
                <label style={{color:'#8C8CA5'}}>Email:</label>
                <input style={inputStyle} value={form.email} onChange={e=>set('email',e.target.value)} placeholder="user@example.com"/>
                {!isEdit && <>
                  <label style={{color:'#8C8CA5'}}>Пароль:</label>
                  <input style={inputStyle} type="password" value={form.password} onChange={e=>set('password',e.target.value)} placeholder="Минимум 6 символов"/>
                  <label style={{color:'#8C8CA5'}}>Повтор пароля:</label>
                  <input style={inputStyle} type="password" value={form.password2} onChange={e=>set('password2',e.target.value)}/>
                </>}
                <label style={{color:'#8C8CA5'}}>Имя:</label>
                <input style={inputStyle} value={form.name} onChange={e=>set('name',e.target.value)}/>
                <label style={{color:'#8C8CA5'}}>Фамилия:</label>
                <input style={inputStyle} value={form.surname} onChange={e=>set('surname',e.target.value)}/>
                <label style={{color:'#8C8CA5'}}>Пол:</label>
                <select style={selectStyle} value={form.gender} onChange={e=>set('gender',e.target.value)}><option>Мужской</option><option>Женский</option></select>
                <label style={{color:'#8C8CA5'}}>Роль:</label>
                <select style={selectStyle} value={form.role} onChange={e=>set('role',e.target.value)}><option>Бегун</option><option>Координатор</option></select>
              </div>
              <div>
                <div style={{background:'#23233E',border:'1px solid #3C3C5A',height:120,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',borderRadius:4,overflow:'hidden'}} onClick={()=>document.getElementById('photoFileInput').click()}>
                  {form.photo ? <img src={form.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{textAlign:'center'}}><div style={{fontSize:26}}>📷</div><div style={{fontSize:9,color:'#8C8CA5'}}>Нажмите для выбора</div></div>}
                </div>
                <input type="file" id="photoFileInput" accept="image/*" style={{display:'none'}} onChange={onPhoto}/>
                <div style={{marginTop:6,display:'flex',gap:5}}>
                  <input style={{...inputStyle,height:26,fontSize:9,color:'#8C8CA5'}} readOnly value={form.photoName}/>
                  <button style={{...btnDark,height:26,padding:'0 8px',fontSize:13}} onClick={()=>document.getElementById('photoFileInput').click()}>📁</button>
                </div>
                <label style={{color:'#8C8CA5',display:'block',marginBottom:4,fontSize:10,marginTop:12}}>Дата рождения:</label>
                <input style={inputStyle} type="date" value={form.dob} onChange={e=>set('dob',e.target.value)}/>
                <label style={{color:'#8C8CA5',display:'block',marginBottom:4,fontSize:10,marginTop:10}}>Страна:</label>
                <select style={selectStyle} value={form.country} onChange={e=>set('country',e.target.value)}>{COUNTRIES.map(c=><option key={c}>{c}</option>)}</select>
              </div>
            </div>
          </div>
          {msg.text && <div style={{textAlign:'center',fontWeight:700,fontSize:11,padding:8,borderRadius:4,margin:'10px 0',background:msg.ok?'rgba(76,175,80,.15)':'rgba(232,93,4,.15)',color:msg.ok?'#4CAF50':'#E85D04'}}>{msg.text}</div>}
          <div style={{display:'flex',gap:10,justifyContent:'center',marginTop:4}}>
            <button style={{...btnOrange,height:40,fontSize:12,padding:'0 22px'}} onClick={submit}>✔ &nbsp;{isEdit?'Сохранить':'Зарегистрироваться'}</button>
            <button style={{...btnDark,height:40,fontSize:11,padding:'0 18px'}} onClick={onClose}>Отмена</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── PROFILE MODAL ─────────────────────────────────────────────────
function ProfileModal({ open, onClose, participant, isAdmin, onEdit, onBMI }) {
  if (!open||!participant) return null
  const p = participant
  const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря']
  const formatDate=(dob)=>{ if(!dob)return'—'; const[y,m,d]=dob.split('-'); return`${parseInt(d)} ${months[parseInt(m)-1]} ${y}` }
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:'#14142A',border:'1px solid #2D2D46',borderRadius:8,width:'min(600px,95vw)',maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
        <div style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:52,display:'flex',alignItems:'center',padding:'0 14px',gap:10}}>
          <button style={btnNav} onClick={onClose}>← Закрыть</button>
          <span style={{fontSize:12,fontWeight:700}}>ПРОФИЛЬ УЧАСТНИКА</span>
          {isAdmin && <button style={{...btnOrange,height:32,padding:'0 12px',marginLeft:'auto'}} onClick={()=>onEdit(p)}>✏️ &nbsp;Редактировать</button>}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'16px 30px 20px'}}>
          <div style={{display:'flex',alignItems:'center',gap:16,marginBottom:20}}>
            <div style={{width:80,height:80,background:'#23233E',borderRadius:'50%',border:'2px solid #2D2D46',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,overflow:'hidden',flexShrink:0}}>
              {p.photo?<img src={p.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{p.gender==='Женский'?'👩':'👨'}</span>}
            </div>
            <div>
              <div style={{fontSize:22,fontWeight:700}}>{p.name} {p.surname}</div>
              <div style={{fontSize:13,fontWeight:600,color:p.role==='Бегун'?'rgb(120,200,255)':'#6C63FF'}}>{p.role}</div>
              <div style={{fontSize:11,color:'#8C8CA5'}}>{p.email}</div>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:16}}>
            {[['📧 Email',p.email],['⚧ Пол',p.gender],['🎂 Дата рождения',formatDate(p.dob)],['🌍 Страна',p.country||'—'],['📊 ИМТ',p.bmi?p.bmi.toFixed(1):'—'],['🏷 Роль',p.role],['📅 Зарегистрирован',p.created_at?new Date(p.created_at).toLocaleDateString('ru'):'—']].map(([lbl,val])=>(
              <div key={lbl} style={{background:'#23233E',borderRadius:4,padding:'10px 12px'}}>
                <div style={{fontSize:9,color:'#8C8CA5',marginBottom:2}}>{lbl}</div>
                <div style={{fontSize:12,fontWeight:500}}>{val}</div>
              </div>
            ))}
          </div>
          {isAdmin && <div style={{display:'flex',gap:10,justifyContent:'center'}}><button style={{...btnOrange,height:36}} onClick={()=>onBMI(p)}>📊 &nbsp;Рассчитать ИМТ</button></div>}
        </div>
      </div>
    </div>
  )
}

function ConfirmModal({ open, name, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.7)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}}>
      <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:8,padding:'28px 36px',textAlign:'center',width:'min(400px,90vw)'}}>
        <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>Удалить участника?</div>
        <div style={{fontSize:11,color:'#8C8CA5',marginBottom:24}}>{name}</div>
        <div style={{display:'flex',gap:10,justifyContent:'center'}}>
          <button style={{...btnOrange,background:'#B71C1C',height:36}} onClick={onConfirm}>🗑 Удалить</button>
          <button style={{...btnDark,height:36}} onClick={onCancel}>Отмена</button>
        </div>
      </div>
    </div>
  )
}

// ── BMI PAGE ──────────────────────────────────────────────────────
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
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <nav style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:52,display:'flex',alignItems:'center',padding:'0 14px',gap:10,flexShrink:0}}>
        <button style={{...btnNav,height:36}} onClick={onBack}>← Назад</button>
        <span style={{fontSize:12,fontWeight:700,margin:'0 auto'}}>ИМТ КАЛЬКУЛЯТОР</span>
        <button style={{...btnOrange,height:36,width:140}} onClick={()=>{ if(!bmiVal){alert('Сначала рассчитайте ИМТ.');return} onSave(bmiVal) }}>💾 &nbsp;Сохранить</button>
      </nav>
      <div style={{flex:1,overflowY:'auto',padding:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,height:'calc(100% - 20px)'}}>
          <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,padding:18}}>
            <p style={{fontSize:10,color:'#8C8CA5',marginBottom:18,lineHeight:1.5}}>ИМТ = вес (кг) / рост² (м)</p>
            <div style={{marginBottom:14}}>
              <span style={{color:'#8C8CA5'}}>Пол:&nbsp;</span>
              {['Мужской','Женский'].map(g=>(<label key={g} style={{color:'#E8E8F5',cursor:'pointer',marginRight:16,display:'inline-flex',alignItems:'center',gap:6}}><input type="radio" name="bmiGender" value={g} checked={gender===g} onChange={()=>setGender(g)}/> {g==='Мужской'?'♂':'♀'} {g}</label>))}
            </div>
            {[['Рост','bmiH',height,setHeight,'см'],['Вес','bmiW',weight,setWeight,'кг']].map(([lbl,id,val,setter,unit])=>(
              <div key={id} style={{display:'grid',gridTemplateColumns:'100px 90px auto',alignItems:'center',gap:8,marginBottom:14}}>
                <label style={{color:'#8C8CA5'}}>{lbl}:</label>
                <input style={{...inputStyle,height:32}} value={val} onChange={e=>setter(e.target.value.replace(/[^\d]/g,''))}/>
                <span style={{color:'#8C8CA5',fontSize:11}}>{unit}</span>
              </div>
            ))}
            <div style={{display:'flex',gap:10}}>
              <button style={{...btnOrange,height:40,fontSize:11}} onClick={calc}>▶ &nbsp;Рассчитать</button>
              <button style={{...btnDark,height:40,fontSize:11}} onClick={()=>setBmiVal(0)}>Сброс</button>
            </div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,height:160,overflow:'hidden'}}><canvas ref={figRef} style={{width:'100%',height:'100%'}}/></div>
            <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,height:90,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:12}}>
              <div style={{fontSize:30,fontWeight:700,color:bmiVal?color:'#E8E8F5'}}>{bmiVal?bmiVal.toFixed(1):'—'}</div>
              <div style={{fontSize:15,fontWeight:700,color}}>{cat}</div>
            </div>
            <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,height:72,overflow:'hidden',padding:'8px 12px'}}><canvas ref={gaugeRef} style={{width:'100%',height:'100%'}}/></div>
          </div>
        </div>
      </div>
      <div style={{background:'#1C1C33',borderTop:'1px solid #E85D04',height:44,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
        <span style={{fontSize:11,fontWeight:600}}>👤 {runner?`${runner.name} ${runner.surname}`:'...'}</span>
      </div>
    </div>
  )
}

function AdminLoginPage({ onBack, onLogin }) {
  const [login, setLogin] = useState(''), [pass, setPass] = useState(''), [err, setErr] = useState('')
  const doLogin = () => { if(login==='admin'&&pass==='admin123'){onLogin();setErr('')} else setErr('Неверный логин или пароль') }
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <nav style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:58,display:'flex',alignItems:'center',padding:'0 14px',gap:10}}>
        <button style={btnNav} onClick={onBack}>← Назад</button>
        <span style={{fontSize:12,fontWeight:700,marginLeft:16}}>MARATHON SKILLS 2026</span>
      </nav>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,width:'min(420px,90vw)',padding:'36px 36px 32px'}}>
          <div style={{fontSize:20,fontWeight:700,color:'#F4A33C',textAlign:'center',marginBottom:10}}>Форма авторизации</div>
          <div style={{fontSize:10,color:'#8C8CA5',textAlign:'center',marginBottom:24}}>Пожалуйста, авторизуйтесь в системе.</div>
          {[['Login',login,setLogin,'text'],['Password',pass,setPass,'password']].map(([lbl,val,setter,type])=>(
            <div key={lbl} style={{display:'grid',gridTemplateColumns:'100px 1fr',alignItems:'center',gap:8,marginBottom:12}}>
              <label style={{color:'#8C8CA5',textAlign:'right',paddingRight:12}}>{lbl}:</label>
              <input style={{...inputStyle,height:32}} type={type} value={val} onChange={e=>setter(e.target.value)} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            </div>
          ))}
          {err && <div style={{color:'#E85D04',fontSize:11,textAlign:'center',marginBottom:12}}>{err}</div>}
          <div style={{display:'flex',gap:10,justifyContent:'center'}}>
            <button style={{...btnOrange,height:36,padding:'0 24px'}} onClick={doLogin}>Login</button>
            <button style={{...btnDark,height:36,padding:'0 20px'}} onClick={onBack}>Cancel</button>
          </div>
        </div>
      </div>
      <TimerBar/>
    </div>
  )
}

// ── USERS TABLE ───────────────────────────────────────────────────
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
    <div style={{display:'flex',flexDirection:'column',height:'100vh'}}>
      <nav style={{background:'#1C1C33',borderBottom:'2px solid #E85D04',height:58,display:'flex',alignItems:'center',padding:'0 14px',gap:8,flexShrink:0,flexWrap:'wrap'}}>
        <button style={btnNav} onClick={onBack}>← Назад</button>
        <span style={{fontSize:12,fontWeight:700,marginLeft:6}}>MARATHON SKILLS 2026</span>
        <div style={{marginLeft:'auto',display:'flex',gap:6}}>
          {isAdmin && <>
            <button style={{...btnGreen,height:32,fontSize:10}} onClick={onExport}>⬇ CSV</button>
            <button style={{...btnBlue,height:32,fontSize:10}} onClick={onImport}>⬆ Импорт</button>
            <button style={{...btnOrange,height:32,fontSize:11}} onClick={()=>onEdit(null)}>✚ Добавить</button>
          </>}
        </div>
      </nav>

      <div style={{background:'#1E1E36',borderBottom:'2px solid #E85D04',padding:16}}>
        <div style={{fontSize:17,fontWeight:700,color:'#F4A33C',marginBottom:10}}>Список зарегистрированных участников</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
          <span style={{color:'#8C8CA5'}}>Роль:</span>
          <select style={{...selectStyle,width:'auto',height:28,padding:'0 8px'}} value={roleFilter} onChange={e=>{setRoleFilter(e.target.value);setPage(1)}}><option>Все роли</option><option>Бегун</option><option>Координатор</option></select>
          <span style={{color:'#8C8CA5'}}>Сортировка:</span>
          <select style={{...selectStyle,width:'auto',height:28,padding:'0 8px'}} value={sort} onChange={e=>setSort(e.target.value)}>{['По имени','По фамилии','По Email','По роли','По стране'].map(o=><option key={o}>{o}</option>)}</select>
          <span style={{color:'#8C8CA5'}}>Поиск:</span>
          <input style={{...inputStyle,width:180,height:28}} placeholder="Поиск по имени, email..." value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/>
        </div>
      </div>

      <div style={{flex:1,overflowY:'auto'}}>
        {loading ? <div style={{textAlign:'center',padding:40,color:'#8C8CA5'}}>Загрузка...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>{['#','Имя','Фамилия','Email','Страна','ИМТ','Роль'].map(h=>(
                <th key={h} style={{background:'#18183A',color:'#8C8CA5',fontWeight:600,fontSize:10,padding:'8px 10px',textAlign:'left',position:'sticky',top:0,borderBottom:'2px solid #2D2D46'}}>{h}</th>
              ))}
              {isAdmin && <><th style={{background:'#18183A',width:46,position:'sticky',top:0,borderBottom:'2px solid #2D2D46'}}/><th style={{background:'#18183A',width:46,position:'sticky',top:0,borderBottom:'2px solid #2D2D46'}}/></>}
              </tr>
            </thead>
            <tbody>
              {paged.map((p,i)=>(
                <tr key={p.id} style={{borderBottom:'1px solid #1E1E3A',cursor:'pointer'}} onClick={()=>onProfile(p)}>
                  <td style={{padding:'7px 10px',fontSize:11,color:'#8C8CA5'}}>{(page-1)*PER_PAGE+i+1}</td>
                  <td style={{padding:'7px 10px',fontSize:11}}>{p.name}</td>
                  <td style={{padding:'7px 10px',fontSize:11}}>{p.surname}</td>
                  <td style={{padding:'7px 10px',fontSize:11,color:'#2196F3'}}>{p.email}</td>
                  <td style={{padding:'7px 10px',fontSize:11}}>{p.country||'—'}</td>
                  <td style={{padding:'7px 10px',fontSize:11,color:p.bmi?bmiColor(p.bmi):'#8C8CA5'}}>{p.bmi?p.bmi.toFixed(1):'—'}</td>
                  <td style={{padding:'7px 10px',fontSize:11,color:p.role==='Бегун'?'rgb(120,200,255)':'#6C63FF'}}>{p.role}</td>
                  {isAdmin && <>
                    <td style={{padding:'7px 4px'}} onClick={e=>{e.stopPropagation();onEdit(p)}}><button style={{background:'#23233E',color:'#fff',border:'none',borderRadius:3,height:22,padding:'0 6px',cursor:'pointer',fontSize:11}}>✏</button></td>
                    <td style={{padding:'7px 4px'}} onClick={e=>{e.stopPropagation();onDelete(p)}}><button style={{background:'#3C1919',color:'#fff',border:'none',borderRadius:3,height:22,padding:'0 6px',cursor:'pointer',fontSize:11}}>🗑</button></td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{background:'#1E1E36',borderTop:'1px solid #23233E',height:42,display:'flex',alignItems:'center',padding:'0 12px',flexShrink:0}}>
        <span style={{color:'#8C8CA5',fontSize:10}}>Всего: {list.length} участников</span>
        <div style={{display:'flex',alignItems:'center',gap:8,margin:'0 auto'}}>
          <button style={{...btnDark,width:56,height:26,fontSize:11}} disabled={page<=1} onClick={()=>setPage(p=>p-1)}>◀</button>
          <span style={{color:'#8C8CA5',fontSize:10,minWidth:80,textAlign:'center'}}>Стр. {page} / {pages}</span>
          <button style={{...btnDark,width:56,height:26,fontSize:11}} disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>▶</button>
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

  if (status==='loading') return <div style={{background:'#14142A',color:'#E8E8F5',minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center'}}>Загрузка...</div>

  // ── PUBLIC LANDING ────────────────────────────────────────────
  if (!session) {
    return (
      <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#14142A',fontFamily:"'Segoe UI', system-ui, sans-serif",color:'#E8E8F5'}}>
        <Navbar session={null} isAdmin={false} onUsers={()=>{}} onRegister={()=>{}} onAdminLogin={()=>{}} onAdminLogout={()=>{}}/>
        <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 24px',textAlign:'center'}}>
          <div style={{fontSize:64,marginBottom:16}}>🏃</div>
          <div style={{fontSize:32,fontWeight:800,marginBottom:8,letterSpacing:1}}>MARATHON SKILLS</div>
          <div style={{fontSize:16,color:'#E85D04',fontWeight:700,marginBottom:8}}>2026</div>
          <div style={{fontSize:14,color:'#8C8CA5',marginBottom:4}}>42.195 КМ · 15 ИЮНЯ 2026 · АЛМАТЫ</div>
          <div style={{fontSize:12,color:'#8C8CA5',marginBottom:40}}>Войдите через Google, чтобы зарегистрироваться на марафон</div>
          <button onClick={()=>signIn('google',{callbackUrl:'/'})} style={{display:'inline-flex',alignItems:'center',gap:12,background:'#fff',color:'#1a1a2e',border:'none',borderRadius:8,padding:'14px 32px',fontSize:15,fontWeight:600,cursor:'pointer',boxShadow:'0 4px 20px rgba(0,0,0,0.4)',marginBottom:48}}>
            <svg width="22" height="22" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Войти через Google
          </button>

          {/* AI Chat Button */}
          <button onClick={()=>setAiChatOpen(true)} style={{display:'flex',alignItems:'center',gap:14,background:'linear-gradient(135deg,#1a1a3e,#252548)',border:'1px solid #E85D04',borderRadius:10,padding:'14px 18px',marginBottom:14,cursor:'pointer',maxWidth:700,width:'100%',textDecoration:'none'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'linear-gradient(135deg,#E85D04,#F4A33C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🤖</div>
            <div style={{flex:1,textAlign:'left'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#E8E8F5',marginBottom:3}}>Спроси ИИ-ассистента о марафоне</div>
              <div style={{fontSize:10,color:'#8C8CA5'}}>Подготовка · Питание · ИМТ · Регистрация · Любые вопросы</div>
            </div>
            <div style={{background:'#E85D04',color:'#fff',borderRadius:6,padding:'6px 14px',fontSize:11,fontWeight:700,flexShrink:0}}>Чат →</div>
          </button>

          <a href="https://t.me/martthon_bot" target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:14,background:'linear-gradient(135deg,#0d1f3c,#1a3a5c)',border:'1px solid #2196F3',borderRadius:10,padding:'14px 18px',marginBottom:20,textDecoration:'none',cursor:'pointer',maxWidth:700,width:'100%'}}>
            <div style={{width:44,height:44,borderRadius:'50%',background:'#2196F3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>✈️</div>
            <div style={{flex:1,textAlign:'left'}}>
              <div style={{fontSize:13,fontWeight:700,color:'#E8E8F5',marginBottom:3}}>Telegram-бот с ИИ-ассистентом</div>
              <div style={{fontSize:10,color:'#8C8CA5'}}>Найди участника · Статистика · Зарегистрируйся · Спроси ИИ</div>
            </div>
            <div style={{background:'#2196F3',color:'#fff',borderRadius:6,padding:'6px 14px',fontSize:11,fontWeight:700,flexShrink:0}}>Открыть →</div>
          </a>

          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:12,maxWidth:700,width:'100%'}}>
            {[['#E85D04','🏃 Марафон — испытание воли','Дистанция 42,195 км объединяет профессионалов и любителей в едином порыве выносливости.'],['#2196F3','💪 «Стена» на 30–35 км','В этот момент запасы гликогена истощаются. Преодоление — вопрос чистого упрямства.'],['#4CAF50','🌆 Города без машин','Уникальный шанс увидеть город иначе: пробежать по мостам под крики болельщиков.']].map(([color,title,desc])=>(
              <div key={title} style={{display:'flex',alignItems:'stretch',background:'#1E1E36',border:'1px solid #28283E',borderRadius:8,overflow:'hidden',textAlign:'left'}}>
                <div style={{width:4,flexShrink:0,background:color}}/>
                <div style={{padding:'12px 14px'}}>
                  <div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{title}</div>
                  <div style={{fontSize:10,color:'#8C8CA5',lineHeight:1.5}}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
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

  // ── MAIN VIEW ─────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',minHeight:'100vh',background:'#14142A',fontFamily:"'Segoe UI', system-ui, sans-serif",color:'#E8E8F5'}}>
      <Navbar onUsers={()=>setView('users')} onRegister={()=>{setEditTarget(null);setRegisterOpen(true)}} onAdminLogin={()=>setView('adminLogin')} session={session} isAdmin={isAdmin} onAdminLogout={()=>setIsAdmin(false)}/>

      <div style={{flex:1,overflowY:'auto',padding:'16px 24px'}}>
        <div style={{fontSize:20,fontWeight:700,color:'#F4A33C',textAlign:'center',marginBottom:14}}>Добро пожаловать в Marathon Skills 2026</div>

        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,height:96,marginBottom:12}}>
          {[['🏃',runners,'#E85D04','Бегунов'],['📋',coords,'#6C63FF','Координаторов'],['📊',avgBMI,'#4CAF50','Средний ИМТ'],['🌍',topCountry,'#2196F3','Топ страна'],['👥',participants.length,'#9C27B0','Всего участников']].map(([icon,val,color,lbl])=>(
            <div key={lbl} style={{background:'#1E1E36',border:'1px solid #2D2D46',borderRadius:6,position:'relative',overflow:'hidden',display:'flex',alignItems:'center',padding:'0 12px',gap:8}}>
              <span style={{fontSize:20}}>{icon}</span>
              <div><div style={{fontSize:18,fontWeight:700,color}}>{val}</div><div style={{fontSize:9,color:'#8C8CA5'}}>{lbl}</div></div>
              <div style={{position:'absolute',bottom:0,left:8,right:8,height:3,borderRadius:'0 0 6px 6px',background:color}}/>
            </div>
          ))}
        </div>

        <div style={{height:140,borderRadius:10,overflow:'hidden',position:'relative',background:'linear-gradient(to right, rgba(232,93,4,.19), rgba(33,150,243,.06))',marginBottom:12}}>
          <div style={{display:'flex',gap:0,position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-60%)',justifyContent:'center'}}>
            {['🏃','🏅','🌍','🎽','⏱'].map(e=>(<div key={e} style={{background:'rgba(255,255,255,.08)',borderRadius:'50%',width:56,height:56,display:'flex',alignItems:'center',justifyContent:'center',fontSize:30,margin:'0 10px',border:'2px solid rgba(255,255,255,.15)'}}>{e}</div>))}
          </div>
          <div style={{position:'absolute',bottom:12,left:20,fontSize:16,fontWeight:700,opacity:.9}}>42.195 КМ &nbsp;·&nbsp; 15 ИЮНЯ 2026</div>
        </div>

        <div style={{display:'flex',gap:10,justifyContent:'center',marginBottom:12,flexWrap:'wrap'}}>
          <button style={{...btnOrange,height:40,fontSize:12}} onClick={()=>{setEditTarget(null);setRegisterOpen(true)}}>✚ &nbsp;Зарегистрировать</button>
          <button style={{...btnNav,height:40,fontSize:12}} onClick={()=>setView('users')}>👥 &nbsp;Все участники</button>
          {isAdmin && <>
            <button style={{...btnGreen,height:40,fontSize:12}} onClick={handleExport}>⬇ &nbsp;Выгрузить CSV</button>
            <button style={{...btnBlue,height:40,fontSize:12}} onClick={()=>setImportOpen(true)}>⬆ &nbsp;Импорт CSV</button>
          </>}
          <button style={{...btnOrange,height:40,fontSize:12,background:'linear-gradient(135deg,#8B00FF,#E85D04)'}} onClick={()=>setAiChatOpen(true)}>🤖 &nbsp;ИИ-ассистент</button>
        </div>

        {/* AI Chat Banner */}
        <button onClick={()=>setAiChatOpen(true)} style={{display:'flex',alignItems:'center',gap:14,background:'linear-gradient(135deg,#1a1a3e,#252548)',border:'1px solid #E85D04',borderRadius:10,padding:'14px 18px',marginBottom:10,cursor:'pointer',width:'100%',textAlign:'left'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:'linear-gradient(135deg,#E85D04,#F4A33C)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>🤖</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:'#E8E8F5',marginBottom:2}}>ИИ-ассистент марафона</div>
            <div style={{fontSize:10,color:'#8C8CA5'}}>Задай вопрос о подготовке, питании, ИМТ или регистрации</div>
          </div>
          <div style={{background:'#E85D04',color:'#fff',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:700,flexShrink:0}}>Открыть →</div>
        </button>

        <a href="https://t.me/martthon_bot" target="_blank" rel="noopener noreferrer" style={{display:'flex',alignItems:'center',gap:14,background:'linear-gradient(135deg,#0d1f3c,#1a3a5c)',border:'1px solid #2196F3',borderRadius:10,padding:'14px 18px',marginBottom:10,textDecoration:'none',cursor:'pointer'}}>
          <div style={{width:40,height:40,borderRadius:'50%',background:'#2196F3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>✈️</div>
          <div style={{flex:1}}>
            <div style={{fontSize:12,fontWeight:700,color:'#E8E8F5',marginBottom:2}}>Telegram-бот с ИИ · @martthon_bot</div>
            <div style={{fontSize:10,color:'#8C8CA5'}}>Найди участника · Статистика · Зарегистрируйся · Спроси ИИ</div>
          </div>
          <div style={{background:'#2196F3',color:'#fff',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:700,flexShrink:0}}>Открыть →</div>
        </a>

        {[['#E85D04','🏃 Марафон — испытание воли','Дистанция 42,195 км объединяет профессионалов и любителей в едином порыве выносливости.'],['#2196F3','💪 «Стена» на 30–35 км','В этот момент запасы гликогена истощаются. Преодоление — вопрос чистого упрямства.'],['#4CAF50','🌆 Города без машин','Уникальный шанс увидеть город иначе: пробежать по мостам под крики болельщиков.']].map(([color,title,desc])=>(
          <div key={title} style={{display:'flex',alignItems:'stretch',background:'#1E1E36',border:'1px solid #28283E',marginBottom:6}}>
            <div style={{width:4,flexShrink:0,background:color}}/>
            <div style={{padding:'10px 12px'}}><div style={{fontSize:12,fontWeight:700,marginBottom:4}}>{title}</div><div style={{fontSize:10,color:'#8C8CA5',lineHeight:1.4}}>{desc}</div></div>
          </div>
        ))}
      </div>

      <TimerBar/>

      <RegisterModal open={registerOpen} onClose={()=>{setRegisterOpen(false);setEditTarget(null)}} onSave={saveParticipant} editData={editTarget}/>
      <ImportModal open={importOpen} onClose={()=>setImportOpen(false)} onImported={fetchParticipants}/>
      <AIChatWidget open={aiChatOpen} onClose={()=>setAiChatOpen(false)}/>
    </div>
  )
}
