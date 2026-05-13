import { useState } from "react"

const ADMIN_URL = import.meta.env.VITE_ADMIN_URL || "http://localhost:8007"

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error,    setError]    = useState("")
  const [loading,  setLoading]  = useState(false)

  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      setError("Please enter username and password.")
      return
    }
    setLoading(true)
    setError("")

    try {
      const res  = await fetch(`${ADMIN_URL}/auth/login`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          username: username.trim(),
          password: password.trim()
        })
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.detail || "Login failed")
        setLoading(false)
        return
      }

      // Store in localStorage
      localStorage.setItem("axpert_token",  data.token)
      localStorage.setItem("axpert_role",   data.role)
      localStorage.setItem("axpert_user",   data.username)
      localStorage.setItem("axpert_schema", data.schema_name || "")

      onLogin({
        token:       data.token,
        role:        data.role,
        username:    data.username,
        schema_name: data.schema_name
      })

    } catch (e) {
      setError("Cannot connect to server. Please try again.")
    }
    setLoading(false)
  }

  return (
    <div style={s.page}>
      <div style={s.card}>

        {/* Logo */}
        <div style={s.logo}>
          <div style={s.logoIcon}>A</div>
          <div>
            <div style={s.logoTitle}>Axpert Assistant</div>
            <div style={s.logoSub}>ERP Information/Implementation Guide</div>
          </div>
        </div>

        {/* Username */}
        <div style={s.field}>
          <label style={s.label}>Username</label>
          <input
            style={s.input}
            placeholder="Enter username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            autoFocus
          />
        </div>

        {/* Password */}
        <div style={s.field}>
          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
        </div>

        {error && <div style={s.error}>{error}</div>}

        <button
          style={{ ...s.btn, opacity: loading ? 0.6 : 1 }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In →"}
        </button>

      </div>
    </div>
  )
}

const s = {
  page: {
    minHeight:      "100vh",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    background:     "#f4f4f0",
    fontFamily:     "system-ui, sans-serif"
  },
  card: {
    background:   "#fff",
    borderRadius: 12,
    padding:      "2rem",
    width:        360,
    boxShadow:    "0 2px 16px rgba(0,0,0,0.08)"
  },
  logo: {
    display:       "flex",
    alignItems:    "center",
    gap:           12,
    marginBottom:  "1.75rem"
  },
  logoIcon: {
    width:          40,
    height:         40,
    borderRadius:   10,
    background:     "#1a1a2e",
    color:          "#fff",
    display:        "flex",
    alignItems:     "center",
    justifyContent: "center",
    fontWeight:     700,
    fontSize:       18
  },
  logoTitle: { fontWeight: 600, fontSize: 15, color: "#111" },
  logoSub:   { fontSize: 12, color: "#888", marginTop: 1 },
  field:     { marginBottom: "1rem" },
  label: {
    display:      "block",
    fontSize:     12,
    color:        "#555",
    marginBottom: 5,
    fontWeight:   500
  },
  input: {
    width:        "100%",
    padding:      "9px 12px",
    border:       "1px solid #e0e0e0",
    borderRadius: 8,
    fontSize:     14,
    outline:      "none",
    boxSizing:    "border-box",
    color:        "#111"
  },
  error: {
    background:   "#fff0f0",
    color:        "#c0392b",
    fontSize:     13,
    padding:      "8px 12px",
    borderRadius: 8,
    marginBottom: "1rem"
  },
  btn: {
    width:        "100%",
    padding:      "10px",
    background:   "#1a1a2e",
    color:        "#fff",
    border:       "none",
    borderRadius: 8,
    fontSize:     14,
    fontWeight:   600,
    cursor:       "pointer",
    marginTop:    4
  }
}