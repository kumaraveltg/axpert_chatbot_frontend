import { useState, useEffect } from 'react';
import { chatApi, syncApi } from '../api/api';
import './AdminPages.css';

export default function Dashboard() {
  const [chatOk, setChatOk] = useState(null);
  const [syncOk, setSyncOk] = useState(null);
  const [cols,   setCols]   = useState([]);

  useEffect(() => {
    chatApi.health().then(() => setChatOk(true)).catch(() => setChatOk(false));
    syncApi.health().then(() => setSyncOk(true)).catch(() => setSyncOk(false));
    chatApi.collections().then(d => setCols(d.collections || [])).catch(() => {});
  }, []);

  function StatusBadge({ ok }) {
    if (ok === null) return <span className="badge-warn">Checking...</span>;
    return ok
      ? <span className="badge-ok">Running ✓</span>
      : <span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'#fee2e2',color:'#991b1b'}}>Offline ✗</span>;
  }

  return (
    <div className="admin-page">
      <div className="admin-grid">

        <div className="admin-card" style={{gridColumn:'1/-1'}}>
          <div className="card-header"><i className="ti ti-activity" />Service status</div>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-lbl">Chat service :8006</div>
              <div style={{marginTop:6}}><StatusBadge ok={chatOk} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-lbl">Sync service :8005</div>
              <div style={{marginTop:6}}><StatusBadge ok={syncOk} /></div>
            </div>
            <div className="stat-card">
              <div className="stat-num">{cols.length}</div>
              <div className="stat-lbl">Collections</div>
            </div>
            <div className="stat-card">
              <div className="stat-num">hcaspay</div>
              <div className="stat-lbl">Active schema</div>
            </div>
          </div>
        </div>

        <div className="admin-card">
          <div className="card-header"><i className="ti ti-cpu" />RAG pipeline</div>
          <table style={{width:'100%',fontSize:12,borderCollapse:'collapse'}}>
            <tbody>
              {[
                ['LLM',       'llama-4-scout-17b'],
                ['Provider',  'Groq'],
                ['Embedding', 'all-mpnet-base-v2'],
                ['VectorDB',  'ChromaDB (cosine)'],
                ['Retrieval', 'Multi-query'],
                ['Threshold', 'Adaptive (best × 1.2)'],
              ].map(([k,v]) => (
                <tr key={k} style={{borderBottom:'1px solid #f3f4f6'}}>
                  <td style={{padding:'6px 0',color:'#6b7280',width:90}}>{k}</td>
                  <td style={{padding:'6px 0',fontFamily:'monospace',fontSize:11,color:'#111827'}}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-card">
          <div className="card-header"><i className="ti ti-database" />Collections</div>
          {cols.length === 0
            ? <div style={{fontSize:12,color:'#9ca3af'}}>No collections found. Run sync first.</div>
            : cols.map(c => (
                <div key={c} style={{padding:'6px 8px',background:'#f9fafb',borderRadius:6,fontSize:12,fontFamily:'monospace',marginBottom:4,color:'#374151'}}>
                  {c}
                </div>
              ))
          }
        </div>

      </div>
    </div>
  );
}
