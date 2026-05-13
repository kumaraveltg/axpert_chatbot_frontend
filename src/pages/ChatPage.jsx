import { useState, useRef, useEffect } from 'react';
import { chatApi, adminApi } from '../api/api.js';

export default function ChatPage({ schema = 'hcaspay' }) {
  const [messages, setMessages] = useState([
    {
      role:    'assistant',
      content: `Hi! I'm your Axpert implementation guide for **${schema}**.\nAsk me anything about setting up your ERP — forms, masters, workflows, or step-by-step implementation.`
    }
  ]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState('explain');
  const [industry, setIndustry] = useState('Axpert ERP');
  const bottomRef               = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    adminApi.getCompany(schema)
      .then(d => setIndustry(d.industry))
      .catch(() => {});
  }, [schema]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    // Build history from current messages (last 6, excluding system)
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-6);

    try {
      // ✅ FIXED — passes history and schema_name correctly
      const data = await chatApi.send(
        text,
        industry,
        undefined,
        mode,
        history,
        schema
      );

      setMessages(prev => [...prev, {
        role:     'assistant',
        content:  data.answer,
        sources:  data.sources  || [],
        chunks:   data.chunks_used,
        distance: data.min_distance
      }]);

    } catch {
      setMessages(prev => [...prev, {
        role:    'assistant',
        content: 'Sorry, I couldn\'t connect to the chat service. Please try again.'
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
          <div style={s.modeToggle}>
            <button
              style={{ ...s.modeBtn, ...(mode === 'explain' ? s.modeBtnActive : {}) }}
              onClick={() => setMode('explain')}
            >Explain</button>
            <button
              style={{ ...s.modeBtn, ...(mode === 'guide' ? s.modeBtnActive : {}) }}
              onClick={() => setMode('guide')}
            >Step Guide</button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={s.messages}>
        {messages.map((msg, i) => (
          <div key={i} style={{ ...s.msgRow, justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && <div style={s.avatar}>A</div>}
            <div style={{ maxWidth: '72%' }}>
              <div style={{ ...s.bubble, ...(msg.role === 'user' ? s.bubbleUser : s.bubbleBot) }}>
                <MessageText content={msg.content} />
              </div>
              {msg.sources?.length > 0 && (
                <div style={s.sources}>
                  {msg.sources.map((src, j) => (
                    <span key={j} style={s.sourceTag}>{src}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
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
            placeholder={mode === 'guide'
              ? 'e.g. How do I set up Purchase Order workflow?'
              : 'e.g. What is a Vendor Master in Axpert?'}
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

// Renders **bold** and newlines from bot response
function MessageText({ content }) {
  const lines = content.split('\n');
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

const s = {
  page: {
    display:       'flex',
    flexDirection: 'column',
    height:        '100vh',
    background:    '#f7f7f3',
    fontFamily:    'system-ui, sans-serif'
  },
  header: {
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '12px 20px',
    background:     '#fff',
    borderBottom:   '1px solid #ebebeb'
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 10 },
  logoIcon: {
    width: 34, height: 34,
    borderRadius: 8,
    background:   '#1a1a2e',
    color:        '#fff',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontWeight: 700, fontSize: 16
  },
  headerTitle: { fontWeight: 600, fontSize: 14, color: '#111' },
  headerSub:   { fontSize: 11, color: '#888' },
  modeToggle: {
    display:    'flex',
    background: '#f0f0ec',
    borderRadius: 8,
    padding:    3,
    gap:        2
  },
  modeBtn: {
    padding:    '5px 12px',
    fontSize:   12,
    border:     'none',
    borderRadius: 6,
    background: 'transparent',
    color:      '#666',
    cursor:     'pointer',
    fontWeight: 500
  },
  modeBtnActive: {
    background: '#fff',
    color:      '#111',
    boxShadow:  '0 1px 3px rgba(0,0,0,0.1)'
  },
  messages: {
    flex:          1,
    overflowY:     'auto',
    padding:       '20px 16px',
    display:       'flex',
    flexDirection: 'column',
    gap:           16
  },
  msgRow: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        8
  },
  avatar: {
    width:  28, height: 28,
    borderRadius: '50%',
    background:   '#1a1a2e',
    color:        '#fff',
    display:      'flex',
    alignItems:   'center',
    justifyContent: 'center',
    fontSize:   12,
    fontWeight: 700,
    flexShrink: 0,
    marginTop:  2
  },
  bubble: {
    padding:      '10px 14px',
    borderRadius: 12,
    color:        '#111'
  },
  bubbleBot: {
    background:          '#fff',
    border:              '1px solid #ebebeb',
    borderTopLeftRadius: 4
  },
  bubbleUser: {
    background:           '#1a1a2e',
    color:                '#fff',
    borderTopRightRadius: 4
  },
  sources: {
    marginTop: 6,
    display:   'flex',
    flexWrap:  'wrap',
    gap:       4
  },
  sourceTag: {
    fontSize:     11,
    background:   '#eef2ff',
    color:        '#3a3a8c',
    padding:      '2px 8px',
    borderRadius: 20
  },
  inputArea: {
    padding:    '12px 16px 16px',
    background: '#fff',
    borderTop:  '1px solid #ebebeb'
  },
  inputRow: {
    display:    'flex',
    gap:        8,
    alignItems: 'flex-end'
  },
  textarea: {
    flex:         1,
    padding:      '10px 12px',
    border:       '1px solid #e0e0e0',
    borderRadius: 10,
    fontSize:     14,
    resize:       'none',
    outline:      'none',
    fontFamily:   'inherit',
    color:        '#111',
    lineHeight:   1.5
  },
  sendBtn: {
    padding:      '10px 18px',
    background:   '#1a1a2e',
    color:        '#fff',
    border:       'none',
    borderRadius: 10,
    fontSize:     14,
    fontWeight:   600,
    cursor:       'pointer',
    flexShrink:   0
  },
  hint: {
    fontSize:  11,
    color:     '#aaa',
    marginTop: 6,
    textAlign: 'center'
  }
};
