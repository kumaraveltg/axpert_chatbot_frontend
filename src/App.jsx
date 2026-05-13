import { useState, useEffect } from 'react';
import ChatPage          from './pages/ChatPage';
import Dashboard         from './pages/Dashboard';
import SyncManager       from './pages/SyncManager';
import FieldInstructions from './pages/FieldInstructions';
import BasicKnowledge    from './pages/BasicKnowledge';
import LoginPage         from './pages/LoginPage';
import './App.css';

// ── Nav config ────────────────────────────────────────────────
const NAV_ADMIN = [
  { id:'chat',   label:'Chat',                   icon:'ti-message-circle',   section:'User'  },
  { id:'dash',   label:'Dashboard',              icon:'ti-layout-dashboard', section:'Admin' },
  { id:'sync',   label:'Sync Manager',           icon:'ti-refresh',          section:'Admin' },
  { id:'fields', label:'Form/Field Instructions',icon:'ti-forms',            section:'Admin' },
  { id:'basics', label:'Basic Knowledge',        icon:'ti-books',            section:'Admin' },
];

const NAV_USER = [
  { id:'chat',     label:'Chat',            icon:'ti-message-circle', section:'User' },
  { id:'profile',  label:'Schema Info',     icon:'ti-info-circle',    section:'User' },
  { id:'password', label:'Change Password', icon:'ti-lock',           section:'User' },
];

const TITLES = {
  chat:     'Chat',
  dash:     'Dashboard',
  sync:     'Sync Manager',
  fields:   'Form/Field Instructions',
  basics:   'Basic Knowledge',
  profile:  'Schema Info',
  password: 'Change Password',
};

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:8007"

// ── Session expired popup ─────────────────────────────────────
function SessionExpiredPopup({ onClose }) {
  return (
    <div style={sp.overlay}>
      <div style={sp.box}>
        <div style={sp.icon}>⏱</div>
        <div style={sp.title}>Session Expired</div>
        <div style={sp.msg}>Your session has expired. Please login again.</div>
        <button style={sp.btn} onClick={onClose}>Go to Login</button>
      </div>
    </div>
  )
}

const sp = {
  overlay: {
    position:'fixed', inset:0,
    background:'rgba(0,0,0,0.5)',
    display:'flex', alignItems:'center',
    justifyContent:'center', zIndex:9999
  },
  box: {
    background:'#fff', borderRadius:12,
    padding:'2rem', width:320,
    textAlign:'center',
    boxShadow:'0 4px 24px rgba(0,0,0,0.15)'
  },
  icon:  { fontSize:40, marginBottom:12 },
  title: { fontWeight:700, fontSize:18, color:'#111', marginBottom:8 },
  msg:   { fontSize:14, color:'#666', marginBottom:24 },
  btn: {
    padding:'10px 24px', background:'#1a1a2e',
    color:'#fff', border:'none', borderRadius:8,
    fontSize:14, fontWeight:600, cursor:'pointer'
  }
}

// ── Change Password page ──────────────────────────────────────
function ChangePasswordPage({ token, onExpired }) {
  const [oldPass, setOldPass] = useState("")
  const [newPass, setNewPass] = useState("")
  const [confirm, setConfirm] = useState("")
  const [msg,     setMsg]     = useState("")
  const [err,     setErr]     = useState("")
  const [loading, setLoading] = useState(false)

  async function handleChange() {
    setErr(""); setMsg("")
    if (!oldPass || !newPass || !confirm) { setErr("All fields required."); return }
    if (newPass !== confirm) { setErr("New passwords do not match."); return }
    if (newPass.length < 6)  { setErr("Password must be at least 6 characters."); return }

    setLoading(true)
    try {
      const res = await fetch(`${ADMIN_URL}/auth/change-password`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ old_password: oldPass, new_password: newPass })
      })
      const data = await res.json()
      if (res.status === 401) { onExpired(); return }
      if (!res.ok) { setErr(data.detail || "Failed"); setLoading(false); return }
      setMsg("Password changed successfully ✅")
      setOldPass(""); setNewPass(""); setConfirm("")
    } catch { setErr("Cannot connect to server.") }
    setLoading(false)
  }

  return (
    <div style={{ maxWidth:400, margin:'2rem auto' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:'2rem', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        <h3 style={{ margin:'0 0 1.5rem', color:'#111' }}>Change Password</h3>
        {['Current Password','New Password','Confirm New Password'].map((lbl, i) => (
          <div key={i} style={{ marginBottom:'1rem' }}>
            <label style={{ display:'block', fontSize:12, color:'#555', marginBottom:5, fontWeight:500 }}>{lbl}</label>
            <input
              type="password"
              style={{ width:'100%', padding:'9px 12px', border:'1px solid #e0e0e0', borderRadius:8, fontSize:14, boxSizing:'border-box' }}
              value={[oldPass,newPass,confirm][i]}
              onChange={e => [setOldPass,setNewPass,setConfirm][i](e.target.value)}
            />
          </div>
        ))}
        {err && <div style={{ color:'#c0392b', fontSize:13, marginBottom:'1rem', padding:'8px 12px', background:'#fff0f0', borderRadius:8 }}>{err}</div>}
        {msg && <div style={{ color:'#27ae60', fontSize:13, marginBottom:'1rem', padding:'8px 12px', background:'#f0fff4', borderRadius:8 }}>{msg}</div>}
        <button
          onClick={handleChange}
          disabled={loading}
          style={{ width:'100%', padding:'10px', background:'#1a1a2e', color:'#fff', border:'none', borderRadius:8, fontSize:14, fontWeight:600, cursor:'pointer', opacity: loading ? 0.6 : 1 }}
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  )
}

// ── Schema Info page (end user only) ─────────────────────────
function SchemaInfoPage({ username, schema_name }) {
  return (
    <div style={{ maxWidth:400, margin:'2rem auto' }}>
      <div style={{ background:'#fff', borderRadius:12, padding:'2rem', boxShadow:'0 2px 12px rgba(0,0,0,0.07)' }}>
        <h3 style={{ margin:'0 0 1.5rem', color:'#111' }}>Your Account Info</h3>
        {[['Username', username], ['Schema', schema_name], ['Role', 'End User']].map(([k,v]) => (
          <div key={k} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid #f0f0f0' }}>
            <span style={{ fontSize:13, color:'#888' }}>{k}</span>
            <span style={{ fontSize:13, fontWeight:600, color:'#111' }}>{v || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main App ──────────────────────────────────────────────────
export default function App() {
  const [page,           setPage]           = useState('chat');
  const [auth,           setAuth]           = useState(null);
  const [sessionExpired, setSessionExpired] = useState(false);

  function handleLogout() {
    localStorage.removeItem("axpert_token")
    localStorage.removeItem("axpert_role")
    localStorage.removeItem("axpert_user")
    localStorage.removeItem("axpert_schema")
    setAuth(null)
    setPage('chat')
    setSessionExpired(false)
  }

  function handleExpired() {
    setSessionExpired(true)
  }

  // Check localStorage on load
  useEffect(() => {
  const token  = localStorage.getItem("axpert_token")
  const role   = localStorage.getItem("axpert_role")
  const user   = localStorage.getItem("axpert_user")
  const schema = localStorage.getItem("axpert_schema")

  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now     = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        handleExpired()
        return
      }
    } catch {
      handleLogout()
      return
    }
    setAuth({ token, role, username: user, schema_name: schema })
    setPage('chat')
  }

  // ── Check every 30 seconds if token expired ──
  const interval = setInterval(() => {
    const t = localStorage.getItem("axpert_token")
    if (!t) return
    try {
      const payload = JSON.parse(atob(t.split('.')[1]))
      const now     = Math.floor(Date.now() / 1000)
      if (payload.exp < now) {
        clearInterval(interval)
        handleExpired()
      }
    } catch {
      clearInterval(interval)
      handleLogout()
    }
  }, 30000) // check every 30 seconds

  return () => clearInterval(interval) // cleanup on unmount

}, [])

// DEBUG — paste this temporarily
useEffect(() => {
  const t = localStorage.getItem("axpert_token")
  if (!t) {
    console.log("DEBUG: no token found")
    return
  }
  try {
    const payload = JSON.parse(atob(t.split('.')[1]))
    const now     = Math.floor(Date.now() / 1000)
    console.log("DEBUG token exp:", payload.exp)
    console.log("DEBUG now:      ", now)
    console.log("DEBUG expired:  ", payload.exp < now)
    console.log("DEBUG seconds left:", payload.exp - now)
  } catch(e) {
    console.log("DEBUG error:", e)
  }
}, [])

  function handleLogin(data) {
    setAuth(data)
    setPage('chat')
  }

   
  // Not logged in
  if (!auth) {
    return <LoginPage onLogin={handleLogin} />
  }

  const isAdmin  = auth.role === 'admin'
  const NAV      = isAdmin ? NAV_ADMIN : NAV_USER
  const sections = [...new Set(NAV.map(n => n.section))]
  const schema   = auth.schema_name || 'hcaspay'
  const initials = auth.username?.slice(0,2).toUpperCase() || 'U'

  return (
    <div className="shell">

      {/* Session expired popup */}
      {sessionExpired && (
        <SessionExpiredPopup onClose={handleLogout} />
      )}

      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">
            <i className="ti ti-brain" aria-hidden="true" />
          </div>
          <div>
            <div className="logo-name">Axpert AI</div>
            <div className="logo-sub">Knowledge Assistant</div>
          </div>
        </div>

        <nav className="nav">
          {sections.map(sec => (
            <div key={sec}>
              <div className="nav-section">{sec}</div>
              {NAV.filter(n => n.section === sec).map(n => (
                <div
                  key={n.id}
                  className={`nav-item ${page === n.id ? 'active' : ''}`}
                  onClick={() => setPage(n.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setPage(n.id)}
                >
                  <i className={`ti ${n.icon}`} aria-hidden="true" />
                  {n.label}
                </div>
              ))}
            </div>
          ))}
        </nav>

        {/* Schema badge */}
        <div className="schema-badge">
          <div className="schema-label">SCHEMA</div>
          <div className="schema-val">{schema}</div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="page-title">{TITLES[page]}</div>
          <div className="topbar-right">
            <div className="status-dot" aria-hidden="true" />
            <span className="status-txt">Services active</span>
            <div className="avatar" title={auth.username}>{initials}</div>
            <button
              onClick={handleLogout}
              title="Logout"
              style={{
                background:'none', border:'1px solid #e0e0e0',
                borderRadius:6, padding:'4px 10px',
                fontSize:12, cursor:'pointer', color:'#666'
              }}
            >
              Logout
            </button>
          </div>
        </header>

        <div className="content">
          {page === 'chat'     && <ChatPage schema={schema} token={auth.token} onExpired={handleExpired} />}
          {page === 'dash'     && isAdmin && <Dashboard />}
          {page === 'sync'     && isAdmin && <SyncManager />}
          {page === 'fields'   && isAdmin && <FieldInstructions schema={schema} />}
          {page === 'basics'   && isAdmin && <BasicKnowledge schema={schema} />}
          {page === 'profile'  && !isAdmin && <SchemaInfoPage username={auth.username} schema_name={schema} />}
          {page === 'password' && <ChangePasswordPage token={auth.token} onExpired={handleExpired} />}
        </div>
      </div>
    </div>
  )
}