import { useState, useEffect } from 'react';
import './AdminPages.css';
import { syncApi,adminApi } from '../api/api.js';


const SOURCE_OPTIONS = ['manual', 'db_sync'];


const TOPIC_SUGGESTIONS = [
  { doc_id: 'manual_axpert_basics',    caption: 'What is Axpert ERP'            },
  { doc_id: 'manual_empmu_flow',       caption: 'Employee to User flow'          },
  { doc_id: 'manual_axusers',          caption: 'axusers table explained'        },
  { doc_id: 'manual_roles',            caption: 'Roles and responsibilities'     },
  { doc_id: 'manual_self_service',     caption: 'Employee self service portal'   },
  { doc_id: 'manual_debug_form',       caption: 'How to debug form in runtime'   },
  { doc_id: 'manual_genmap',           caption: 'What is GenMap'                 },
  { doc_id: 'manual_fillgrid',         caption: 'What is FillGrid'               },
  { doc_id: 'manual_mdmap',            caption: 'What is MDMap'                  },
  { doc_id: 'manual_iview',            caption: 'iView setup guide'              },
  { doc_id: 'manual_email_settings',   caption: 'Email configuration'            },
  { doc_id: 'manual_global_variables', caption: 'Global variables (axglo)'       },
];

function emptyForm() {
  return {
    doc_id:   '',
    caption:  '',
    source:   'manual',
    table:    'none',
    document: ''
  };
}

export default function BasicKnowledge({ schema = 'hcaspay' }) {
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState({});
  const [showModal,  setShowModal]  = useState(false);
  const [editEntry,  setEditEntry]  = useState(null);  // null = new
  const [form,       setForm]       = useState(emptyForm());
  const [expanded,   setExpanded]   = useState({});    // { doc_id: true/false }
  const [searchQ,    setSearchQ]    = useState('');
  const [filterSrc,  setFilterSrc]  = useState('all'); // all | manual | db_sync
  const [coreTransactions, setCoreTransactions] = useState([]);
  const [selectedTransid,  setSelectedTransid]  = useState('');
  const [generating,       setGenerating]        = useState(false);

  useEffect(() => { fetchEntries(); }, []);

  async function fetchEntries() {
    setLoading(true);
    setError(null);
    try {
      const data = await syncApi.listShared();
      setEntries(data.entries || []);
    } catch {
      setError('Could not load shared knowledge. Make sure sync service is running.');
    } finally {
      setLoading(false);
    }
  }

  async function saveEntry() {
    if (!form.doc_id.trim() || !form.caption.trim() || !form.document.trim()) {
      setError('Doc ID, Caption and Content are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await syncApi.addShared({
        doc_id:   form.doc_id.trim().toLowerCase().replace(/\s+/g, '_'),
        caption:  form.caption.trim(),
        source:   form.source,
        table:    form.table,
        document: form.document.trim()
      });
      setShowModal(false);
      setEditEntry(null);
      setForm(emptyForm());
      fetchEntries();
    } catch {
      setError('Save failed. Check sync service.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(doc_id) {
    if (!confirm(`Delete "${doc_id}"?`)) return;
    setDeleting(prev => ({ ...prev, [doc_id]: true }));
    try {
      await syncApi.deleteShared(doc_id);
      fetchEntries();
    } catch {
      setError('Delete failed.');
    } finally {
      setDeleting(prev => ({ ...prev, [doc_id]: false }));
    }
  }

  function openNew() {
    setEditEntry(null);
    setForm(emptyForm());
    setError(null);
    setShowModal(true);
  }

  function openEdit(entry) {
    setEditEntry(entry);
    setForm({
      doc_id:   entry.doc_id,
      caption:  entry.caption,
      source:   entry.source,
      table:    entry.table,
      document: entry.document
    });
    setError(null);
    setShowModal(true);
  }

  function useSuggestion(s) {
    setForm(prev => ({
      ...prev,
      doc_id:  s.doc_id,
      caption: s.caption,
      source:  'manual',
      table:   'none'
    }));
  }

  function toggleExpand(doc_id) {
    setExpanded(prev => ({ ...prev, [doc_id]: !prev[doc_id] }));
  }

  // Filter entries
  const filtered = entries.filter(e => {
    const matchSrc = filterSrc === 'all' || e.source === filterSrc;
    const matchQ   = !searchQ.trim() ||
      e.caption.toLowerCase().includes(searchQ.toLowerCase()) ||
      e.doc_id.toLowerCase().includes(searchQ.toLowerCase());
    return matchSrc && matchQ;
  });

  const manualCount  = entries.filter(e => e.source === 'manual').length;
  const dbSyncCount  = entries.filter(e => e.source === 'db_sync').length;

  async function fetchCoreTransactions() {
  const s = typeof schema === 'string' ? schema : schema?.schema_name || 'hcaspay';
  try {
    const data = await adminApi.getCoreTransactions(s);
    setCoreTransactions(data.items || []);
  } catch {
    setError('Could not load core transactions.');
  }
}

async function autoSyncDbEntry() {
  if (!selectedTransid) return;
  const found = coreTransactions.find(t => t.transid === selectedTransid);
  if (!found) return;

  setGenerating(true);
  setError(null);
  try {
    // Step 1 — auto generate field instructions
    await adminApi.autoGenerate(schema, selectedTransid, 'field');

    // Step 2 — fetch generated instructions
    const instrData = await adminApi.getInstructions(schema, selectedTransid);
    const instrText = (instrData.instructions || [])
      .map(i => `${i.fieldname}: ${i.instruction}`)
      .join('\n');

    // Step 3 — save to shared
    await syncApi.addShared({
      doc_id:   `db_sync_${selectedTransid.toLowerCase()}`,
      caption:  found.caption,
      source:   'db_sync',
      table:    selectedTransid.toLowerCase(),
      document: `FORM: ${found.caption} (${selectedTransid})\n\n${instrText}`
    });

    setShowModal(false);
    setSelectedTransid('');
    fetchEntries();
    alert(`✅ Synced: ${found.caption}`);
  } catch {
    setError('Auto sync failed.');
  } finally {
    setGenerating(false);
  }
}

  return (
    <div className="admin-page">
      <div style={{ maxWidth: 860 }}>
        <div className="admin-card">

          {/* Header */}
          <div className="card-header">
            <i className="ti ti-books" />
            <span>Basic Knowledge</span>
            <div className="card-header-right" style={{ display:'flex', gap:8, alignItems:'center' }}>
              {/* Stats */}
              <span style={badge('#dbeafe', '#1e40af')}>{manualCount} manual</span>
              <span style={badge('#d1fae5', '#065f46')}>{dbSyncCount} db_sync</span>
              {/* Filter */}
              <select
                value={filterSrc}
                onChange={e => setFilterSrc(e.target.value)}
                style={selectStyle}
              >
                <option value="all">All sources</option>
                <option value="manual">Manual only</option>
                <option value="db_sync">DB sync only</option>
              </select>
              {/* Search */}
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search..."
                style={{ ...selectStyle, width: 140 }}
              />
              <button className="btn-primary btn-sm" onClick={openNew}>
                <i className="ti ti-plus" /> Add Knowledge
              </button>
            </div>
          </div>

          {error && <div className="error-bar">{error}</div>}

          {/* List */}
          {loading ? (
            <div className="loading-row">
              <i className="ti ti-loader" style={{ animation:'spin 1s linear infinite' }} /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-admin">
              <p>No knowledge entries yet. Click <strong>Add Knowledge</strong> to start.</p>
            </div>
          ) : (
            <div className="module-list">
              {filtered.map(entry => (
                <div key={entry.doc_id} className="module-row" style={{ flexDirection:'column', alignItems:'stretch', gap:6 }}>

                  {/* Row 1 — info + actions */}
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ flex:1 }}>
                      <span className="module-root">{entry.caption}</span>
                      <span className="module-sub" style={{ marginLeft:6, fontFamily:'monospace', fontSize:11 }}>
                        {entry.doc_id}
                      </span>
                    </div>

                    {/* Source badge */}
                    <span style={entry.source === 'manual'
                      ? badge('#ede9fe', '#5b21b6')
                      : badge('#d1fae5', '#065f46')
                    }>
                      {entry.source}
                    </span>
                  
                    {/* Table badge — show only if not none */}
                    {entry.table && entry.table !== 'none' && (
                      <span style={badge('#fef3c7', '#92400e')}>
                        {entry.table}
                      </span>
                    )}

                    {/* Expand */}
                    <button
                      className="btn-xs"
                      onClick={() => toggleExpand(entry.doc_id)}
                      title="Preview content"
                    >
                      <i className={`ti ${expanded[entry.doc_id] ? 'ti-chevron-up' : 'ti-chevron-down'}`} />
                    </button>

                    {/* Edit */}
                    <button
                      className="btn-xs"
                      onClick={() => openEdit(entry)}
                      title="Edit"
                    >
                      <i className="ti ti-edit" />
                    </button>

                    {/* Delete */}
                    <button
                      className="btn-xs btn-danger"
                      onClick={() => deleteEntry(entry.doc_id)}
                      disabled={deleting[entry.doc_id]}
                      title="Delete"
                    >
                      <i className={`ti ${deleting[entry.doc_id] ? 'ti-loader' : 'ti-trash'}`}
                         style={deleting[entry.doc_id] ? { animation:'spin 1s linear infinite' } : {}} />
                    </button>
                  </div>

                  {/* Row 2 — content preview */}
                  {expanded[entry.doc_id] && (
                    <div style={{
                      fontSize:    12,
                      color:       '#374151',
                      background:  '#f9fafb',
                      border:      '1px solid #e5e7eb',
                      borderRadius: 6,
                      padding:     '8px 10px',
                      whiteSpace:  'pre-wrap',
                      lineHeight:  1.6,
                      marginTop:   2
                    }}>
                      {entry.document}
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
              {editEntry ? 'Edit Knowledge Entry' : 'Add Knowledge Entry'}
              <button style={modal.close} onClick={() => setShowModal(false)}>✕</button>
            </div>

            {/* Suggestions — only for new entry */}
            {!editEntry && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'#6b7280', marginBottom:5, fontWeight:500 }}>
                  Quick suggestions:
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                  {TOPIC_SUGGESTIONS.map(s => (
                    <button
                      key={s.doc_id}
                      onClick={() => useSuggestion(s)}
                      style={{
                        fontSize:     10,
                        padding:      '3px 8px',
                        borderRadius: 20,
                        border:       '1px solid #e5e7eb',
                        background:   form.doc_id === s.doc_id ? '#dbeafe' : '#f9fafb',
                        color:        form.doc_id === s.doc_id ? '#1e40af' : '#374151',
                        cursor:       'pointer'
                      }}
                    >
                      {s.caption}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && <div className="error-bar" style={{ marginBottom:10 }}>{error}</div>}

            {/* Doc ID */}
            <div style={modal.field}>
              <label style={modal.label}>Doc ID <span style={{ color:'#ef4444' }}>*</span></label>
              <input
                style={modal.input}
                placeholder="e.g. manual_axpert_basics"
                value={form.doc_id}
                disabled={!!editEntry}
                onChange={e => setForm(p => ({ ...p, doc_id: e.target.value }))}
              />
              {!editEntry && (
                <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>
                  Use format: manual_topic_name or axusr_recordid
                </div>
              )}
            </div>

            {/* Caption */}
            <div style={modal.field}>
              <label style={modal.label}>Caption <span style={{ color:'#ef4444' }}>*</span></label>
              <input
                style={modal.input}
                placeholder="e.g. What is Axpert ERP"
                value={form.caption}
                onChange={e => setForm(p => ({ ...p, caption: e.target.value }))}
              />
            </div>

            {/* Source + Table row */}
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <div style={{ flex:1 }}>
                <label style={modal.label}>Source</label>
                <select
                  style={modal.input}
                  value={form.source}
                  onChange={e => setForm(p => ({...p,  source: e.target.value,  table:  e.target.value === 'manual' ? 'none' : p.table}))}
                >
                  {SOURCE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex:1 }}>
                <label style={modal.label}>Table</label>
                <input
                style={{ ...modal.input, background:'#f9fafb', color:'#6b7280' }}
                value={form.source === 'manual' ? 'none' : (selectedTransid || 'none')}
                readOnly
              />
              </div>
            </div>

            {/* Content */}
            <div style={modal.field}>
              <label style={modal.label}>Content <span style={{ color:'#ef4444' }}>*</span></label>
              {/* DB Sync picker — only when db_sync selected */}
              {form.source === 'db_sync' && (
                <div style={modal.field}>
                  <label style={modal.label}>Core Transaction</label>
                  <div style={{ display:'flex', gap:6 }}>
                    <select
                      style={{ ...modal.input, flex:1 }}
                      value={selectedTransid}
                      onChange={e => setSelectedTransid(e.target.value)}
                      onClick={() => !coreTransactions.length && fetchCoreTransactions()}
                    >
                      <option value="">— select transaction —</option>
                      {coreTransactions.map(t => (
                        <option key={t.transid} value={t.transid}>
                          {t.caption} ({t.transid})
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn-xs btn-primary"
                      onClick={fetchCoreTransactions}
                      type="button"
                    >Load</button>
                  </div>
                  <button
                    className="btn-xs btn-primary"
                    style={{ marginTop:8, width:'100%' }}
                    onClick={autoSyncDbEntry}
                    disabled={!selectedTransid || generating}
                  >
                    {generating ? 'Generating...' : '⚡ Auto Sync'}
                  </button>
                </div>
              )}

              {/* Content — only when manual */}
              {/* {form.source === 'manual' && (
                <div style={modal.field}>
                  <label style={modal.label}>Content <span style={{ color:'#ef4444' }}>*</span></label>
                  <textarea
                    style={{ ...modal.input, height:140, resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
                    placeholder="Explain this topic clearly..."
                    value={form.document}
                    onChange={e => setForm(p => ({ ...p, document: e.target.value }))}
                  />
                  <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>
                    {form.document.length} characters
                  </div>
                </div>
              )} */}
              <textarea
                style={{ ...modal.input, height:140, resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
                placeholder="Explain this topic clearly. Include synonyms and terms users might search for..."
                value={form.document}
                onChange={e => setForm(p => ({ ...p, document: e.target.value }))}
              />
              <div style={{ fontSize:10, color:'#9ca3af', marginTop:2 }}>
                {form.document.length} characters
              </div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:4 }}>
              <button className="btn-xs" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn-xs btn-primary"
                onClick={saveEntry}
                disabled={saving}
              >
                {saving
                  ? 'Saving...'
                  : editEntry ? 'Update' : 'Save'
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────

function badge(bg, color) {
  return {
    fontSize:     10,
    padding:      '2px 7px',
    borderRadius: 20,
    background:   bg,
    color,
    fontWeight:   500,
    whiteSpace:   'nowrap'
  };
}

const selectStyle = {
  fontSize:     12,
  padding:      '3px 8px',
  borderRadius: 6,
  border:       '1px solid #e5e7eb',
  background:   '#f9fafb',
  color:        '#374151'
};

const modal = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', zIndex: 100
  },
  box: {
    background:   '#fff',
    borderRadius: 12,
    padding:      '1.25rem',
    width:        520,
    maxHeight:    '90vh',
    overflowY:    'auto',
    boxShadow:    '0 8px 32px rgba(0,0,0,0.15)'
  },
  title: {
    fontSize:   15,
    fontWeight: 600,
    color:      '#111',
    display:    'flex',
    justifyContent: 'space-between',
    marginBottom:   14
  },
  close: {
    border: 'none', background: 'none',
    cursor: 'pointer', fontSize: 16, color: '#9ca3af'
  },
  field:  { marginBottom: 10 },
  label:  { display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4, fontWeight: 500 },
  input:  {
    width: '100%', padding: '7px 10px',
    border: '1px solid #e5e7eb', borderRadius: 7,
    fontSize: 13, boxSizing: 'border-box', color: '#111'
  }
};
