import { useState, useEffect } from 'react';
import './AdminPages.css';
import { adminApi, syncApi } from '../api/api.js';

export default function SyncManager() {
  const [connections, setConnections] = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [syncing,     setSyncing]     = useState({});
  const [testing,     setTesting]     = useState({});
  const [showModal,   setShowModal]   = useState(false);
  const [editConn,    setEditConn]    = useState(null);
  const [form,        setForm]        = useState(emptyForm());
  const [expanded,    setExpanded]    = useState({});
  const [modules,     setModules]     = useState({});
  const [toggling,    setToggling]    = useState({});
  const [migrating, setMigrating] = useState({});

  function emptyForm() {
    return { name:'', schema_name:'', host:'', port:'5432', db_name:'', username:'', password:'' };
  }

  
  useEffect(() => {
  fetchConnections();
  // Check pg tools on load
  adminApi.checkPgTools()
    .then(data => {
      const missing = Object.entries(data)
        .filter(([, v]) => v.status.includes('❌'))
        .map(([k]) => k);
      if (missing.length > 0) {
        setError(`⚠️ PostgreSQL tools not found: ${missing.join(', ')}. Migration will not work. Install PostgreSQL client tools.`);
      }
    })
    .catch(() => {});
}, []);

  async function fetchConnections() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.listConnections();
      setConnections(data);
    } catch {
      setError('Cannot reach admin service on port 8007.');
    } finally {
      setLoading(false);
    }
  }

  async function testConnection(conn) {
    setTesting(prev => ({ ...prev, [conn.id]: true }));
    try {
      const data = await adminApi.testConnection(conn.id);
      alert(data.message || data.status);
    } catch {
      alert('Test failed — check admin service.');
    } finally {
      setTesting(prev => ({ ...prev, [conn.id]: false }));
    }
  }

  async function triggerSync(conn) {
    setSyncing(prev => ({ ...prev, [conn.id]: true }));
    setError(null);
    try {
      await syncApi.run(conn.schema_name);
      fetchConnections();
    } catch {
      setError(`Sync failed for ${conn.name}.`);
    } finally {
      setSyncing(prev => ({ ...prev, [conn.id]: false }));
    }
  }

  async function deleteConnection(conn) {
    if (!confirm(`Delete connection for ${conn.name}?`)) return;
    try {
      await adminApi.deleteConnection(conn.id);
      fetchConnections();
    } catch {
      setError('Delete failed.');
    }
  }

  async function saveForm() {
    setError(null);
    try {
      if (editConn) {
        await adminApi.updateConnection(editConn.id, {
          ...form, port: parseInt(form.port) || 5432
        });
      } else {
        // ✅ FIXED — create only, no auto sync triggered from backend
        await adminApi.createConnection({
          ...form, port: parseInt(form.port) || 5432
        });
      }
      setShowModal(false);
      setEditConn(null);
      setForm(emptyForm());
      fetchConnections();
    } catch {
      setError('Save failed. Check all fields.');
    }
  }

  function openEdit(conn) {
    setEditConn(conn);
    setForm({
      name:        conn.name,
      schema_name: conn.schema_name,
      host:        conn.host,
      port:        String(conn.port),
      db_name:     conn.db_name,
      username:    conn.username,
      password:    ''
    });
    setShowModal(true);
  }

  async function registerModules(schema_name) {
    try {
      await syncApi.registerModules(schema_name);
      alert('Modules registered!');
    } catch {
      setError('Register modules failed.');
    }
  }

  async function fetchModules(schema_name) {
    try {
      const data = await syncApi.listModules(schema_name);
      setModules(prev => ({ ...prev, [schema_name]: data }));
    } catch {
      setError('Could not load modules.');
    }
  }

  async function toggleModule(schema_name, root_module, sub_module, current) {
    const key    = `${schema_name}_${sub_module}`;
    const enable = current === 'Y' ? 'false' : 'true';
    setToggling(prev => ({ ...prev, [key]: true }));
    try {
      await syncApi.toggleModule(schema_name, root_module, sub_module, enable);
      fetchModules(schema_name);
    } catch {
      setError('Toggle failed.');
    } finally {
      setToggling(prev => ({ ...prev, [key]: false }));
    }
  }

  function toggleExpand(conn) {
    const isOpen = expanded[conn.id];
    setExpanded(prev => ({ ...prev, [conn.id]: !isOpen }));
    if (!isOpen && !modules[conn.schema_name]) {
      fetchModules(conn.schema_name);
    }
  }

  function statusBadge(status) {
    const map = {
      connected: { bg:'#d1fae5', color:'#065f46', label:'Connected' },
      syncing:   { bg:'#fef3c7', color:'#92400e', label:'Syncing'   },
      error:     { bg:'#fee2e2', color:'#991b1b', label:'Error'     },
      pending:   { bg:'#f3f4f6', color:'#374151', label:'Pending'   },
    };
    const s = map[status] || map.pending;
    return (
      <span style={{ fontSize:10, padding:'2px 7px', borderRadius:20, background:s.bg, color:s.color, fontWeight:500 }}>
        {s.label}
      </span>
    );
  }

  async function migrateToCloud(conn) {
  if (!confirm(`Migrate ${conn.name} schemas to cloud?\nThis cannot be undone if schemas exist.`)) return;
  setMigrating(prev => ({ ...prev, [conn.id]: true }));
  setError(null);
  try {
    const data = await adminApi.migrateToCloud(conn.id);
    const summary = data.results
      .map(r => `${r.schema}: ${r.status}`)
      .join('\n');
    alert(`Migration ${data.status}:\n\n${summary}`);
  } catch (e) {
    setError(`Migration failed: ${e.message}`);
  } finally {
    setMigrating(prev => ({ ...prev, [conn.id]: false }));
  }
}

  return (
    <div className="admin-page">
      <div className="admin-col">
        <div className="admin-card">
          <div className="card-header">
            <i className="ti ti-refresh" />
            <span>Sync manager — connections</span>
            <div className="card-header-right">
              <button className="btn-primary btn-sm" onClick={() => { setEditConn(null); setForm(emptyForm()); setShowModal(true); }}>
                <i className="ti ti-plus" /> Add connection
              </button>
                       
            </div>
          </div>

          {error && <div className="error-bar">{error}</div>}

          {loading ? (
            <div className="loading-row">
              <i className="ti ti-loader" style={{ animation:'spin 1s linear infinite' }} /> Loading...
            </div>
          ) : connections.length === 0 ? (
            <div className="empty-admin">
              <p>No connections yet. Add your first customer database.</p>
            </div>
          ) : (
            <div className="module-list">
              {connections.map(conn => (
                <div key={conn.id} className="module-row" style={{ flexDirection:'column', alignItems:'stretch', gap:8 }}>

                  {/* Row 1 — name + status + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <span className="module-root">{conn.name}</span>
                      <span className="module-sub" style={{ marginLeft:6 }}>{conn.schema_name}</span>
                    </div>
                    {statusBadge(conn.status)}
                    <span style={{ fontSize:11, color:'#9ca3af' }}>{conn.doc_count} docs</span>

                    <button
                      className="btn-xs"
                      onClick={() => testConnection(conn)}
                      disabled={testing[conn.id]}
                      title="Test connection"
                    >
                      <i className={`ti ${testing[conn.id] ? 'ti-loader' : 'ti-plug'}`}
                         style={testing[conn.id] ? { animation:'spin 1s linear infinite' } : {}} />
                    </button>
                       <button
            className="btn-xs btn-primary"
            onClick={() => migrateToCloud(conn)}
            disabled={migrating[conn.id]}
            title="Migrate to cloud"
            style={{ background:'#059669' }}
          >
            <i className={`ti ${migrating[conn.id] ? 'ti-loader' : 'ti-cloud-upload'}`}
              style={migrating[conn.id] ? { animation:'spin 1s linear infinite' } : {}} />
          </button>
                    <button
                      className={`btn-xs btn-primary ${syncing[conn.id] ? 'loading' : ''}`}
                      onClick={() => triggerSync(conn)}
                      disabled={syncing[conn.id]}
                      title="Sync now"
                    >
                      <i className={`ti ${syncing[conn.id] ? 'ti-loader' : 'ti-player-play'}`}
                         style={syncing[conn.id] ? { animation:'spin 1s linear infinite' } : {}} />
                    </button>

                    <button
                      className="btn-xs"
                      onClick={() => registerModules(conn.schema_name)}
                      title="Register modules"
                    >
                      <i className="ti ti-list-check" />
                    </button>

                    <button
                      className="btn-xs"
                      onClick={() => toggleExpand(conn)}
                      title="Show modules"
                    >
                      <i className={`ti ${expanded[conn.id] ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                    </button>

                    <button className="btn-xs" onClick={() => openEdit(conn)} title="Edit">
                      <i className="ti ti-edit" />
                    </button>

                    <button className="btn-xs btn-danger" onClick={() => deleteConnection(conn)} title="Delete">
                      <i className="ti ti-trash" />
                    </button>
                  </div>

                  {/* Row 2 — host info */}
                  <div style={{ fontSize:11, color:'#9ca3af', paddingLeft:2 }}>
                    {conn.host}:{conn.port} / {conn.db_name}
                  </div>

                  {/* Row 3 — module toggles */}
                  {expanded[conn.id] && (
                    <div style={{ borderTop:'1px solid #f3f4f6', paddingTop:8, marginTop:4 }}>
                      {!modules[conn.schema_name] ? (
                        <div style={{ fontSize:12, color:'#9ca3af' }}>Loading modules...</div>
                      ) : modules[conn.schema_name].length === 0 ? (
                        <div style={{ fontSize:12, color:'#9ca3af' }}>
                          No modules registered. Click <i className="ti ti-list-check" /> first.
                        </div>
                      ) : (
                        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                          {modules[conn.schema_name].map(m => {
                            const key     = `${conn.schema_name}_${m.sub_module}`;
                            const enabled = m.is_enabled === 'Y';
                            return (
                              <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div
                                  style={{
                                    width:32, height:18, borderRadius:9,
                                    background: enabled ? '#2563eb' : '#e5e7eb',
                                    cursor: toggling[key] ? 'not-allowed' : 'pointer',
                                    position:'relative', transition:'background 0.2s',
                                    flexShrink:0
                                  }}
                                  onClick={() => !toggling[key] && toggleModule(conn.schema_name, m.root_module, m.sub_module, m.is_enabled)}
                                >
                                  <div style={{
                                    position:'absolute', top:2,
                                    left: enabled ? 16 : 2,
                                    width:14, height:14,
                                    borderRadius:'50%', background:'#fff',
                                    transition:'left 0.2s'
                                  }} />
                                </div>
                                <span style={{ fontSize:12, color:'#374151' }}>{m.root_module}</span>
                                <span style={{ fontSize:12, color:'#6b7280' }}>→</span>
                                <span style={{ fontSize:12, color:'#111', fontWeight: enabled ? 500 : 400 }}>{m.sub_module}</span>
                                {!enabled && <span style={{ fontSize:10, color:'#9ca3af' }}>skipped on sync</span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Modal */}
      {showModal && (
        <div style={modal.overlay}>
          <div style={modal.box}>
            <div style={modal.title}>
              {editConn ? 'Edit connection' : 'New connection'}
              <button style={modal.close} onClick={() => setShowModal(false)}>✕</button>
            </div>

            {[
              { key:'name',        label:'Company name',  placeholder:'HMS Pharma'     },
              { key:'schema_name', label:'Schema name',   placeholder:'hms_pharma'     },
              { key:'host',        label:'Host',          placeholder:'192.168.1.10'   },
              { key:'port',        label:'Port',          placeholder:'5432'           },
              { key:'db_name',     label:'Database name', placeholder:'axpert_db'      },
              { key:'username',    label:'Username',      placeholder:'postgres'       },
              { key:'password',    label:'Password',      placeholder:'••••••••', type:'password' },
            ].map(({ key, label, placeholder, type }) => (
              <div key={key} style={modal.field}>
                <label style={modal.label}>{label}</label>
                <input
                  type={type || 'text'}
                  style={modal.input}
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            ))}

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button className="btn-xs" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-xs btn-primary" onClick={saveForm}>
                {editConn ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const modal = {
  overlay: {
    position:'fixed', inset:0, background:'rgba(0,0,0,0.35)',
    display:'flex', alignItems:'center', justifyContent:'center', zIndex:100
  },
  box: {
    background:'#fff', borderRadius:12, padding:'1.25rem',
    width:400, boxShadow:'0 8px 32px rgba(0,0,0,0.15)'
  },
  title: {
    fontSize:15, fontWeight:600, color:'#111',
    display:'flex', justifyContent:'space-between', marginBottom:14
  },
  close: { border:'none', background:'none', cursor:'pointer', fontSize:16, color:'#9ca3af' },
  field: { marginBottom:10 },
  label: { display:'block', fontSize:11, color:'#6b7280', marginBottom:4, fontWeight:500 },
  input: {
    width:'100%', padding:'7px 10px', border:'1px solid #e5e7eb',
    borderRadius:7, fontSize:13, boxSizing:'border-box', color:'#111'
  }
};
