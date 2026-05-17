import { useState, useRef, useEffect } from 'react';
import { chatApi, adminApi } from '../api/api.js';
import { useWebSocket } from '../hooks/useWebSocket';
import ReportBubble from '../components/ReportBubble'; 

export default function ChatPage({ schema = 'hcaspay' }) {
  const [messages, setMessages] = useState([
    {
      role:    'assistant',
      content: `Hi! I'm your Axpert implementation guide for **${schema}**.\nAsk me anything about setting up your ERP — forms, masters, workflows, or step-by-step implementation.`
    }
  ]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [mode,      setMode]      = useState('report');  // explain | guide | report
  const [industry,  setIndustry]  = useState('Axpert ERP');
  const [dataAlert, setDataAlert] = useState(null);
  const bottomRef                 = useRef(null);

  // ── WebSocket ───────────────────────────────────────────────
  const { connected, events, clientId } = useWebSocket(schema);
  const clientIdRef = useRef(clientId);

  useEffect(() => {
    clientIdRef.current = clientId;
  }, [clientId]);

  useEffect(() => {
    if (!events.length) return;
    const last = events[events.length - 1];
    if (last.event === 'data_changed') {
      setDataAlert({ message: `New data available in ${last.table} — results may have updated` });
      setTimeout(() => setDataAlert(null), 10000);
    }
    if (last.event === 'metadata_changed') {
      setDataAlert({ message: 'Schema updated — resyncing...' });
      setTimeout(() => setDataAlert(null), 8000);
    }
  }, [events]);

  // ── Auto scroll ─────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load industry ───────────────────────────────────────────
  useEffect(() => {
    adminApi.getCompany(schema)
      .then(d => setIndustry(d.industry))
      .catch(() => {});
  }, [schema]);

  // ── Send message ────────────────────────────────────────────
  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);

    // ── Report mode ─────────────────────────────────────────
    if (mode === 'report') {
      setMessages(prev => [...prev, {
        role: 'assistant', content: '...', loading: true
      }]);

      try {
        const res = await chatApi.report(text, schema, clientIdRef.current || '', {});
        setMessages(prev => prev.filter(m => !m.loading));

        if (res.type === 'report' || res.type === 'count') {
          setMessages(prev => [...prev, {
            role: 'assistant', type: 'report', report: res
          }]);
        } else if (res.type === 'empty') {
          setMessages(prev => [...prev, {
            role: 'assistant', content: `No data found for: "${text}"`
          }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant', content: res.message || 'Something went wrong.'
          }]);
        }
      } catch (e) {
        setMessages(prev => prev.filter(m => !m.loading));
        setMessages(prev => [...prev, {
          role: 'assistant', content: `Error: ${e.message}`
        }]);
      }

      setLoading(false);
      return;
    }

    // ── Knowledge mode (existing flow) ───────────────────────
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-6);

    try {
      const data = await chatApi.send(
        text, industry, undefined, mode, history, schema
      );
      setMessages(prev => [...prev, {
        role:     'assistant',
        content:  data.answer,
        sources:  data.sources   || [],
        chunks:   data.chunks_used,
        distance: data.min_distance
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: "Sorry, I couldn't connect to the chat service. Please try again."
      }]);
    }

    setLoading(false);
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ── Render ──────────────────────────────────────────────────
  return (
    <div style={s.page}>

      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.logoIcon}>A</div>
          <div>
            <div style={s.headerTitle}>Axpert Assistant</div>
            <div style={s.headerSub}>{industry}</div>
          </div>
        </div>

        <div style={s.headerRight}>
          {/* Mode toggle — explain | guide | report */}
          <div style={s.modeToggle}>
            {[
              { id: 'explain', label: 'Explain',    icon: 'ti-bulb'      },
              { id: 'guide',   label: 'Step Guide', icon: 'ti-list'      },
              { id: 'report',  label: 'Reports',    icon: 'ti-chart-bar' },
            ].map(m => (
              <button
                key={m.id}
                style={{ ...s.modeBtn, ...(mode === m.id ? s.modeBtnActive : {}) }}
                onClick={() => setMode(m.id)}
              >
                <i className={`ti ${m.icon}`}
                  style={{ marginRight: 4, fontSize: 12 }}
                  aria-hidden="true" />
                {m.label}
              </button>
            ))}
          </div>

          {/* WS live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: connected ? '#10b981' : '#94a3b8'
            }} />
            <span style={{ fontSize: 11, color: '#aaa' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Data alert banner */}
      {dataAlert && (
        <div style={s.alertBanner}>
          <span>
            <i className="ti ti-refresh" style={{ marginRight: 6 }} aria-hidden="true" />
            {dataAlert.message}
          </span>
          <button onClick={() => setDataAlert(null)} style={s.alertClose}>✕</button>
        </div>
      )}

      {/* Report mode hint */}
      {mode === 'report' && (
        <div style={s.reportHint}>
          <i className="ti ti-chart-bar" style={{ marginRight: 6 }} aria-hidden="true" />
          Report mode — ask for data, summaries, or trends from your ERP
        </div>
      )}

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            ...s.msgRow,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
          }}>
            {msg.role === 'assistant' && <div style={s.avatar}>A</div>}
            <div style={{ maxWidth: msg.type === 'report' ? '95%' : '72%', flex: msg.type === 'report' ? 1 : 'unset' }}>
              {msg.type === 'report'
                ? <ReportBubble
                    report={msg.report}
                    filterMeta={msg.report.filter_meta || {}}
                    onApplyFilters={async (filters) => {
                      const isClearing = Object.keys(filters).length === 0;
                      const payload = {
                        ...(isClearing ? {} : (msg.report.filters || {})),  // ← keep original filters e.g. active=YES
                        ...filters,                      // ← add new filters from filter bar
                        __force_detail: true
                      };
                      console.log('[onApplyFilters] sending payload:', payload); 
                      const res = await chatApi.report(msg.report.title, schema, clientIdRef.current || '', payload);
                      console.log('[onApplyFilters] res:', res);
                      return res;
                    }}
                    onLoadDetails={async () => {
                      console.log('onLoadDetails called, i=', i);
                  const res = await chatApi.report(
                    msg.report.title, schema, clientIdRef.current || '',
                    { ...(msg.report.filters || {}), __force_detail: true }
                  );
                  console.log('detail result:', res); 
                  if (res?.rows) {
                    setMessages(prev => prev.map((m, idx) =>
                      idx === i
                        ? { ...m, report: { ...m.report, ...res, type: 'report' } }
                        : m
                    ));
                  }
                }}
                  />
                : (
                  <>
                    <div style={{
                      ...s.bubble,
                      ...(msg.role === 'user' ? s.bubbleUser : s.bubbleBot),
                      ...(msg.loading ? { color: '#999' } : {})
                    }}>
                      <MessageText content={msg.content || ''} />
                    </div>
                    {msg.sources?.length > 0 && (
                      <div style={s.sources}>
                        {msg.sources.map((src, j) => (
                          <span key={j} style={s.sourceTag}>{src}</span>
                        ))}
                      </div>
                    )}
                  </>
                )
              }
            </div>
          </div>
        ))}

        {loading && mode !== 'report' && (
          <div style={{ ...s.msgRow, justifyContent: 'flex-start' }}>
            <div style={s.avatar}>A</div>
            <div style={{ ...s.bubble, ...s.bubbleBot, color: '#999' }}>
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={s.inputArea}>
        <div style={s.inputRow}>
          <textarea
            style={s.textarea}
            placeholder={
              mode === 'report'  ? 'e.g. Show payroll summary for this month...' :
              mode === 'guide'   ? 'e.g. How do I set up Purchase Order workflow?' :
                                   'e.g. What is a Vendor Master in Axpert?'
            }
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={2}
          />
          <button
            style={{ ...s.sendBtn, opacity: loading || !input.trim() ? 0.5 : 1 }}
            onClick={sendMessage}
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </div>
        <div style={s.hint}>Press Enter to send · Shift+Enter for new line</div>
      </div>

    </div>
  );
}

// ── MessageText ───────────────────────────────────────────────
function MessageText({ content }) {
  const lines = (content || '').split('\n');
  return (
    <div style={{ lineHeight: 1.65, fontSize: 14 }}>
      {lines.map((line, i) => {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return (
          <div key={i} style={{ marginBottom: line === '' ? 8 : 0 }}>
            {parts.map((part, j) =>
              j % 2 === 1
                ? <strong key={j}>{part}</strong>
                : <span key={j}>{part}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const s = {
  page: {
    display: 'flex', flexDirection: 'column',
    height: '100vh', background: '#f7f7f3',
    fontFamily: 'system-ui, sans-serif',overflow: 'hidden', width: '100%',   maxWidth: '100%',   boxSizing: 'border-box',
  },
  header: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: '#fff', borderBottom: '1px solid #ebebeb'
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 34, height: 34, borderRadius: 8,
    background: '#1a1a2e', color: '#fff',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 700, fontSize: 16
  },
  headerTitle: { fontWeight: 600, fontSize: 14, color: '#111' },
  headerSub:   { fontSize: 11, color: '#888' },
  modeToggle: {
    display: 'flex', background: '#f0f0ec',
    borderRadius: 8, padding: 3, gap: 2
  },
  modeBtn: {
    padding: '5px 12px', fontSize: 12,
    border: 'none', borderRadius: 6,
    background: 'transparent', color: '#666',
    cursor: 'pointer', fontWeight: 500,
    display: 'flex', alignItems: 'center'
  },
  modeBtnActive: {
    background: '#fff', color: '#111',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  alertBanner: {
    background: '#eff6ff', borderBottom: '1px solid #bfdbfe',
    padding: '8px 20px', fontSize: 12, color: '#1d4ed8',
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between'
  },
  alertClose: {
    background: 'none', border: 'none',
    color: '#93c5fd', cursor: 'pointer', fontSize: 14
  },
  reportHint: {
    background: '#f0f4ff', borderBottom: '1px solid #e0e7ff',
    padding: '6px 20px', fontSize: 12, color: '#4338ca'
  },
  messages: {
    flex: 1, overflowY: 'auto',overflowX: 'hidden',
    padding: '20px 16px',
    display: 'flex', flexDirection: 'column', gap: 16,minHeight: 0,
  },
  msgRow: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  avatar: {
    width: 28, height: 28, borderRadius: '50%',
    background: '#1a1a2e', color: '#fff',
    display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontSize: 12,
    fontWeight: 700, flexShrink: 0, marginTop: 2
  },
  bubble:    { padding: '10px 14px', borderRadius: 12, color: '#111' },
  bubbleBot: {
    background: '#fff', border: '1px solid #ebebeb',
    borderTopLeftRadius: 4
  },
  bubbleUser: {
    background: '#1a1a2e', color: '#fff',
    borderTopRightRadius: 4
  },
  sources:   { marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 },
  sourceTag: {
    fontSize: 11, background: '#eef2ff', color: '#3a3a8c',
    padding: '2px 8px', borderRadius: 20
  },
  inputArea: {
    padding: '12px 16px 16px',
    background: '#fff',
    borderTop: '1px solid #ebebeb',
    position: 'sticky',   // ← fix
    bottom: 0,            // ← fix
    zIndex: 10,     
    width: '100%',           // ← ADD THIS
    boxSizing: 'border-box', // ← ADD THIS
    overflow: 'hidden',      // ← fix
  },
  inputRow:  { display: 'flex', gap: 8, alignItems: 'flex-end',width: '100%',boxSizing: 'border-box' },
  textarea: {
    flex: 1, padding: '10px 12px',
    border: '1px solid #e0e0e0', borderRadius: 10,
    fontSize: 14, resize: 'none', outline: 'none',
    fontFamily: 'inherit', color: '#111', lineHeight: 1.5,minwidth: 0,boxSizing: 'border-box'
  },
  sendBtn: {
    padding: '10px 18px', background: '#1a1a2e',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0
  },
  hint: { fontSize: 11, color: '#aaa', marginTop: 6, textAlign: 'center' }
};
