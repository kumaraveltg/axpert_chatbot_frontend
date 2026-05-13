import { useState, useEffect } from 'react';
import './AdminPages.css';
import { adminApi } from '../api/api.js';

const TABS = [
  { id: 'form',     label: 'Form'     },
  { id: 'dc',       label: 'DC'       },
  { id: 'field',    label: 'Fields'   },
  { id: 'genmap',   label: 'GenMap'   },
  { id: 'mdmap',    label: 'MDMap'    },
  { id: 'fillgrid', label: 'FillGrid' },
];

export default function FieldInstructions() {
  const [schema,   setSchema]   = useState('hcaspay');
  const [forms,    setForms]    = useState([]);
  const [transid,  setTransid]  = useState('');
  const [fields,   setFields]   = useState([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [editing,  setEditing]  = useState(null);
  const [editVal,  setEditVal]  = useState('');
  const [saving,   setSaving]   = useState(false);

  const [activeTab,   setActiveTab]   = useState('form');
  const [levelData,   setLevelData]   = useState([]);
  const [levelInstrs, setLevelInstrs] = useState({});
  const [levelEdit,   setLevelEdit]   = useState(null);
  const [levelVal,    setLevelVal]    = useState('');

  useEffect(() => { fetchForms(schema); }, [schema]);

  useEffect(() => {
    if (transid) fetchFields(schema, transid);
  }, [transid]);

  useEffect(() => {
    if (transid && activeTab !== 'field') {
      fetchLevelData(schema, transid, activeTab);
    }
  }, [activeTab, transid]);

  // ── Field tab functions ───────────────────────────────────

  async function fetchForms(s) {
    setError(null);
    try {
      const data = await adminApi.listTransids(s);
      const list = data.transids?.map(d => ({ transid: d.transid, caption: d.caption })) || [];
      setForms(list);
      setTransid(list[0]?.transid || '');
    } catch {
      setError('Could not load forms from admin service.');
    }
  }

  async function fetchFields(s, tid) {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getFields(s, tid);
      setFields(data.fields || []);
    } catch {
      setError(`Could not load fields for ${tid}.`);
      setFields([]);
    } finally {
      setLoading(false);
    }
  }

  async function saveInstruction(fieldname) {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      await adminApi.saveInstruction({
        schema_name: schema,
        transid,
        fieldname,
        instruction: editVal.trim(),
        created_by:  'admin',
        level:       'field',
        ref_name:    fieldname
      });
      setEditing(null);
      fetchFields(schema, transid);
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteInstruction(fieldname) {
    try {
      await adminApi.deleteInstruction(schema, transid, fieldname);
      fetchFields(schema, transid);
    } catch {
      setError('Delete failed.');
    }
  }

  // ── Level tab functions ───────────────────────────────────

  async function fetchLevelData(s, tid, level) {
    setLoading(true);
    setError(null);
    try {
      const data  = await adminApi.getLevelData(s, tid, level);
      setLevelData(data.items || []);

      const data2 = await adminApi.getInstructionsByLevel(s, tid, level);
      const map   = {};
      (data2.instructions || []).forEach(i => { map[i.ref_name] = i.instruction; });
      setLevelInstrs(map);
    } catch {
      setLevelData([]);
      setLevelInstrs({});
    } finally {
      setLoading(false);
    }
  }

  async function saveLevelInstruction(ref_name) {
    if (!levelVal.trim()) return;
    setSaving(true);
    try {
      await adminApi.saveInstruction({
        schema_name: schema,
        transid,
        fieldname:   ref_name,
        instruction: levelVal.trim(),
        created_by:  'admin',
        level:       activeTab,
        ref_name:    ref_name
      });
      setLevelEdit(null);
      fetchLevelData(schema, transid, activeTab);
    } catch {
      setError('Save failed.');
    } finally {
      setSaving(false);
    }
  }

  async function autoGenerate(level) {
    setSaving(true);
    try {
      const data = await adminApi.autoGenerate(schema, transid, level);
      fetchLevelData(schema, transid, level);
      alert(`Generated ${data.count} instructions`);
    } catch {
      setError('Auto generate failed.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteLevelInstruction(ref_name) {
    try {
      await adminApi.deleteInstruction(schema, transid, ref_name);
      fetchLevelData(schema, transid, activeTab);
    } catch {
      setError('Delete failed.');
    }
  }

  const withInstr = fields.filter(f => f.has_instruction).length;
  const total     = fields.length;

  return (
    <div className="admin-page">
      <div style={{ maxWidth: 760 }}>
        <div className="admin-card">

          {/* Header */}
          <div className="card-header">
            <i className="ti ti-forms" />
            <span>Form/Field instructions</span>
            <div className="card-header-right" style={{ display:'flex', gap:8 }}>
              <input
                value={schema}
                onChange={e => setSchema(e.target.value)}
                onBlur={() => fetchForms(schema)}
                placeholder="schema"
                style={{ fontSize:12, padding:'3px 8px', borderRadius:6, border:'1px solid #e5e7eb', width:90 }}
              />
              <select
                value={transid}
                onChange={e => setTransid(e.target.value)}
                style={{ fontSize:12, padding:'3px 8px', borderRadius:6, border:'1px solid #e5e7eb', background:'#f9fafb', color:'#374151' }}
              >
                {forms.length === 0 && <option value="">— no forms —</option>}
                {forms.map(f => (
                  <option key={f.transid} value={f.transid}>{f.caption} ({f.transid})</option>
                ))}
              </select>
              {total > 0 && activeTab === 'field' && (
                <span className="badge-info">{withInstr}/{total} filled</span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid #e5e7eb', marginBottom:12 }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                style={{
                  padding:'7px 14px', fontSize:12, border:'none',
                  background:'transparent', cursor:'pointer',
                  borderBottom: activeTab === t.id ? '2px solid #2563eb' : '2px solid transparent',
                  color: activeTab === t.id ? '#2563eb' : '#6b7280',
                  fontWeight: activeTab === t.id ? 600 : 400
                }}
              >{t.label}</button>
            ))}
          </div>

          {error && <div className="error-bar">{error}</div>}

          {/* Field Tab */}
          {activeTab === 'field' && (
            loading ? (
              <div className="loading-row">
                <i className="ti ti-loader" style={{ animation:'spin 1s linear infinite' }} /> Loading...
              </div>
            ) : fields.length === 0 ? (
              <div style={{ fontSize:13, color:'#6b7280', padding:'12px 0' }}>
                No fields found for <code style={{ fontFamily:'monospace', color:'#2563eb' }}>{transid}</code>.
              </div>
            ) : (
              <table className="field-table">
                <thead>
                  <tr>
                    <th style={{ width:110 }}>Field</th>
                    <th style={{ width:130 }}>Caption</th>
                    <th>Instruction</th>
                    <th style={{ width:70 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.filter(f => !f.hidden).map(f => (
                    <tr key={f.fieldname}>
                      <td><span className="fname">{f.fieldname}</span></td>
                      <td style={{ fontSize:12, color:'#374151' }}>{f.caption}</td>
                      <td>
                        {editing === f.fieldname ? (
                          <div style={{ display:'flex', gap:4 }}>
                            <input
                              autoFocus
                              value={editVal}
                              onChange={e => setEditVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  saveInstruction(f.fieldname);
                                if (e.key === 'Escape') setEditing(null);
                              }}
                              style={{ flex:1, fontSize:12, padding:'3px 6px', borderRadius:4, border:'1px solid #2563eb' }}
                            />
                            <button className="btn-xs btn-primary" onClick={() => saveInstruction(f.fieldname)} disabled={saving}>Save</button>
                            <button className="btn-xs" onClick={() => setEditing(null)}>✕</button>
                          </div>
                        ) : (
                          <span
                            className={f.has_instruction ? 'finstr' : 'finstr-empty'}
                            onClick={() => { setEditing(f.fieldname); setEditVal(f.instruction || ''); }}
                            title="Click to edit"
                            style={{ cursor:'pointer' }}
                          >
                            {f.instruction || <em style={{ color:'#9ca3af' }}>click to add...</em>}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn-xs" onClick={() => { setEditing(f.fieldname); setEditVal(f.instruction || ''); }} title="Edit">
                            <i className="ti ti-edit" />
                          </button>
                          {f.has_instruction && (
                            <button className="btn-xs btn-danger" onClick={() => deleteInstruction(f.fieldname)} title="Delete">
                              <i className="ti ti-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* Other Tabs — DC / Form / GenMap / MDMap / FillGrid */}
          {activeTab !== 'field' && (
            loading ? (
              <div className="loading-row">
                <i className="ti ti-loader" style={{ animation:'spin 1s linear infinite' }} /> Loading...
              </div>
            ) : levelData.length === 0 ? (
              <div style={{ fontSize:13, color:'#6b7280', padding:'12px 0' }}>
                No {activeTab} data found for <code style={{ fontFamily:'monospace', color:'#2563eb' }}>{transid}</code>.
              </div>
            ) : (
              <table className="field-table">
                <thead>
                  <tr>
                    <th style={{ width:130 }}>Name</th>
                    <th style={{ width:130 }}>Caption</th>
                    <th>Instruction</th>
                    <th style={{ width:70 }}>Actions</th>
                    <th style={{ width:100 }}>Auto Generate</th>
                  </tr>
                </thead>
                <tbody>
                  {levelData.map(item => (
                    <tr key={item.name}>
                      <td><span className="fname">{item.name}</span></td>
                      <td style={{ fontSize:12, color:'#374151' }}>{item.caption}</td>
                      <td>
                        {levelEdit === item.name ? (
                          <div style={{ display:'flex', gap:4 }}>
                            <input
                              autoFocus
                              value={levelVal}
                              onChange={e => setLevelVal(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter')  saveLevelInstruction(item.name);
                                if (e.key === 'Escape') setLevelEdit(null);
                              }}
                              style={{ flex:1, fontSize:12, padding:'3px 6px', borderRadius:4, border:'1px solid #2563eb' }}
                            />
                            <button className="btn-xs btn-primary" onClick={() => saveLevelInstruction(item.name)} disabled={saving}>Save</button>
                            <button className="btn-xs" onClick={() => setLevelEdit(null)}>✕</button>
                          </div>
                        ) : (
                          <span
                            className={levelInstrs[item.name] ? 'finstr' : 'finstr-empty'}
                            onClick={() => { setLevelEdit(item.name); setLevelVal(levelInstrs[item.name] || ''); }}
                            title="Click to edit"
                            style={{ cursor:'pointer' }}
                          >
                            {levelInstrs[item.name] || <em style={{ color:'#9ca3af' }}>click to add...</em>}
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display:'flex', gap:4 }}>
                          <button className="btn-xs" onClick={() => { setLevelEdit(item.name); setLevelVal(levelInstrs[item.name] || ''); }} title="Edit">
                            <i className="ti ti-edit" />
                          </button>
                          {levelInstrs[item.name] && (
                            <button className="btn-xs btn-danger" onClick={() => deleteLevelInstruction(item.name)} title="Delete">
                              <i className="ti ti-trash" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          className="btn-xs btn-primary"
                          onClick={() => autoGenerate(activeTab)}
                          disabled={saving}
                        >
                          <i className="ti ti-sparkles" /> Auto
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

        </div>
      </div>
    </div>
  );
}
