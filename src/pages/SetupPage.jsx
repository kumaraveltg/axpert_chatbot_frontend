import { useState, useEffect } from 'react'
import { adminApi } from '../api/api'

const TABS = ['Industries', 'Companies', 'Connections']

export default function SetupPage({ schema, token }) {
  const [tab, setTab] = useState('Industries')

  return (
    <div style={s.page}>
      {/* Tab bar */}
      <div style={s.tabs}>
        {TABS.map(t => (
          <button
            key={t}
            style={{ ...s.tab, ...(tab === t ? s.tabActive : {}) }}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={s.content}>
        {tab === 'Industries'  && <IndustriesTab />}
        {tab === 'Companies'   && <CompaniesTab />}
        {tab === 'Connections' && <ConnectionsTab schema={schema} />}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// TAB 1 — Industries
// ══════════════════════════════════════════════════════════════

function IndustriesTab() {
  const [items,    setItems]    = useState([])
  const [name,     setName]     = useState('')
  const [desc,     setDesc]     = useState('')
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    try {
      const data = await adminApi.listIndustries()
      setItems(data)
    } catch {}
  }

  async function handleAdd() {
    if (!name.trim()) return
    setLoading(true)
    setMsg('')
    try {
      await adminApi.createIndustry({ industry: name, description: desc })
      setName(''); setDesc('')
      setMsg('✅ Industry added')
      load()
    } catch (e) {
      setMsg(`❌ ${e.message}`)
    }
    setLoading(false)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this industry?')) return
    try {
      await adminApi.deleteIndustry(id)
      load()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>Add Industry</div>
        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Industry Name *</label>
            <input
              style={s.input}
              placeholder="e.g. Healthcare, Education"
              value={name}
              onChange={e => setName(e.target.value)}
            />
          </div>
          <div style={s.field}>
            <label style={s.label}>Description</label>
            <input
              style={s.input}
              placeholder="Optional description"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>
          <button
            style={{ ...s.btn, marginTop: 22 }}
            onClick={handleAdd}
            disabled={loading}
          >
            {loading ? 'Adding...' : '+ Add'}
          </button>
        </div>
        {msg && <div style={msg.includes('✅') ? s.success : s.error}>{msg}</div>}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Industries ({items.length})</div>
        {items.length === 0 && <div style={s.empty}>No industries yet</div>}
        {items.map(i => (
          <div key={i.id} style={s.listRow}>
            <div>
              <div style={s.listName}>{i.industry}</div>
              {i.description && <div style={s.listSub}>{i.description}</div>}
            </div>
            <button
              style={s.btnDanger}
              onClick={() => handleDelete(i.id)}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// TAB 2 — Companies
// ══════════════════════════════════════════════════════════════

function CompaniesTab() {
  const [items,      setItems]      = useState([])
  const [industries, setIndustries] = useState([])
  const [form,       setForm]       = useState({
    company_name: '', schema_name: '',
    industry_id:  '', description: '',
    contact:      '', logo_url: ''
  })
  const [editing,  setEditing]  = useState(null)
  const [loading,  setLoading]  = useState(false)
  const [msg,      setMsg]      = useState('')

  useEffect(() => { load(); loadIndustries() }, [])

  async function load() {
    try {
      const data = await adminApi.listCompanies()
      setItems(data)
    } catch {}
  }

  async function loadIndustries() {
    try {
      const data = await adminApi.listIndustries()
      setIndustries(data)
    } catch {}
  }

  function resetForm() {
    setForm({
      company_name: '', schema_name: '',
      industry_id:  '', description: '',
      contact:      '', logo_url: ''
    })
    setEditing(null)
  }

  async function handleSave() {
    if (!form.company_name || !form.schema_name || !form.industry_id) {
      setMsg('❌ Company name, schema and industry are required')
      return
    }
    setLoading(true); setMsg('')
    try {
      const payload = { ...form, industry_id: parseInt(form.industry_id) }
      if (editing) {
        await adminApi.updateCompany(editing, payload)
        setMsg('✅ Company updated')
      } else {
        await adminApi.createCompany(payload)
        setMsg('✅ Company added')
      }
      resetForm(); load()
    } catch (e) {
      setMsg(`❌ ${e.message}`)
    }
    setLoading(false)
  }

  function handleEdit(item) {
    setEditing(item.id)
    setForm({
      company_name: item.company_name,
      schema_name:  item.schema_name,
      industry_id:  item.industry_id,
      description:  item.description || '',
      contact:      item.contact     || '',
      logo_url:     item.logo_url    || ''
    })
  }

  async function handleDelete(id) {
    if (!confirm('Delete this company?')) return
    try {
      await adminApi.deleteCompany(id)
      load()
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div style={s.card}>
        <div style={s.cardTitle}>{editing ? 'Edit Company' : 'Add Company'}</div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Company Name *</label>
            <input style={s.input} placeholder="e.g. HMS Pharma"
              value={form.company_name}
              onChange={e => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Schema Name *</label>
            <input style={s.input} placeholder="e.g. hms_pharma"
              value={form.schema_name}
              onChange={e => setForm({ ...form, schema_name: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Industry *</label>
            <select style={s.input}
              value={form.industry_id}
              onChange={e => setForm({ ...form, industry_id: e.target.value })}>
              <option value="">Select industry</option>
              {industries.map(i => (
                <option key={i.id} value={i.id}>{i.industry}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={s.row}>
          <div style={s.field}>
            <label style={s.label}>Description</label>
            <input style={s.input} placeholder="Company description"
              value={form.description}
              onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Contact (phone/email)</label>
            <input style={s.input} placeholder="e.g. +91 9999999999"
              value={form.contact}
              onChange={e => setForm({ ...form, contact: e.target.value })} />
          </div>
          <div style={s.field}>
            <label style={s.label}>Logo URL</label>
            <input style={s.input} placeholder="https://..."
              value={form.logo_url}
              onChange={e => setForm({ ...form, logo_url: e.target.value })} />
          </div>
        </div>

        {msg && <div style={msg.includes('✅') ? s.success : s.error}>{msg}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button style={s.btn} onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : editing ? 'Update' : '+ Add Company'}
          </button>
          {editing && (
            <button style={s.btnSecondary} onClick={resetForm}>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Companies ({items.length})</div>
        {items.length === 0 && <div style={s.empty}>No companies yet</div>}
        {items.map(i => (
          <div key={i.id} style={s.listRow}>
            <div>
              <div style={s.listName}>{i.company_name}</div>
              <div style={s.listSub}>
                Schema: {i.schema_name} | Industry: {i.industry}
                {i.contact && ` | ${i.contact}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={s.btnSecondary} onClick={() => handleEdit(i)}>Edit</button>
              <button style={s.btnDanger}    onClick={() => handleDelete(i.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}


// ══════════════════════════════════════════════════════════════
// TAB 3 — Connections (simplified, links to company)
// ══════════════════════════════════════════════════════════════

function ConnectionsTab({ schema }) {
  return (
    <div style={s.card}>
      <div style={s.cardTitle}>Connections</div>
      <div style={s.empty}>
        Manage connections in the Sync Manager page.
        This tab shows the link between companies and their DB connections.
      </div>
    </div>
  )
}


// ── Styles ────────────────────────────────────────────────────
const s = {
  page:    { padding: '0' },
  tabs: {
    display: 'flex', gap: 4,
    marginBottom: '1.5rem',
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: 0
  },
  tab: {
    padding: '8px 20px', border: 'none',
    background: 'none', cursor: 'pointer',
    fontSize: 14, color: '#666',
    borderBottom: '2px solid transparent',
    marginBottom: -2
  },
  tabActive: {
    color: '#1a1a2e', fontWeight: 600,
    borderBottom: '2px solid #1a1a2e'
  },
  card: {
    background: '#fff', borderRadius: 10,
    padding: '1.5rem', marginBottom: '1rem',
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)'
  },
  cardTitle: {
    fontWeight: 600, fontSize: 15,
    color: '#111', marginBottom: '1rem'
  },
  row: { display: 'flex', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 180 },
  label: {
    display: 'block', fontSize: 12,
    color: '#555', marginBottom: 5, fontWeight: 500
  },
  input: {
    width: '100%', padding: '8px 12px',
    border: '1px solid #e0e0e0', borderRadius: 8,
    fontSize: 14, outline: 'none',
    boxSizing: 'border-box', color: '#111'
  },
  btn: {
    padding: '8px 20px', background: '#1a1a2e',
    color: '#fff', border: 'none', borderRadius: 8,
    fontSize: 13, fontWeight: 600, cursor: 'pointer'
  },
  btnSecondary: {
    padding: '8px 16px', background: '#f4f4f0',
    color: '#333', border: '1px solid #e0e0e0',
    borderRadius: 8, fontSize: 13, cursor: 'pointer'
  },
  btnDanger: {
    padding: '6px 14px', background: '#fff0f0',
    color: '#c0392b', border: '1px solid #fcc',
    borderRadius: 8, fontSize: 12, cursor: 'pointer'
  },
  listRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', padding: '10px 0',
    borderBottom: '1px solid #f5f5f5'
  },
  listName: { fontSize: 14, fontWeight: 600, color: '#111' },
  listSub:  { fontSize: 12, color: '#888', marginTop: 2 },
  empty:    { fontSize: 13, color: '#aaa', padding: '1rem 0' },
  success: {
    color: '#27ae60', fontSize: 13,
    padding: '8px 12px', background: '#f0fff4',
    borderRadius: 8, marginTop: 8
  },
  error: {
    color: '#c0392b', fontSize: 13,
    padding: '8px 12px', background: '#fff0f0',
    borderRadius: 8, marginTop: 8
  }
}