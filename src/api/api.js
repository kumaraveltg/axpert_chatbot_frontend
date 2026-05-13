// ── Base URLs ─────────────────────────────────────────────────
const CHAT_URL  = 'http://127.0.0.1:8006';
const SYNC_URL  = 'http://127.0.0.1:8005';
const ADMIN_URL = 'http://127.0.0.1:8007';

// ── Base request helper ───────────────────────────────────────
async function request(base, path, options = {}) {
  const res = await fetch(base + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}


// ══════════════════════════════════════════════════════════════
// CHAT API
// ══════════════════════════════════════════════════════════════
export const chatApi = {

  send: (question, industry, module, mode, history, schema_name) =>
    request(CHAT_URL, '/chat', {
      method: 'POST',
      body: JSON.stringify({
        question,
        industry,
        module,
        mode,
        schema_name,
        history: Array.isArray(history)
          ? history
              .filter(m => m.role !== 'bot' || m.meta)
              .map(m => ({
                role:    m.role === 'bot' ? 'assistant' : 'user',
                content: m.text || m.content || ''
              }))
          : []
      })
    }),

  debug: (industry, question, module, schema_name) => {
    const params = new URLSearchParams({ industry, question, schema_name });
    if (module) params.append('module', module);
    return request(CHAT_URL, `/debug/query?${params}`);
  },

  collections: () => request(CHAT_URL, '/collections'),
  health:      () => request(CHAT_URL, '/health'),
};


// ══════════════════════════════════════════════════════════════
// SYNC API
// ══════════════════════════════════════════════════════════════
export const syncApi = {
  run:             (schema) =>
    request(SYNC_URL, `/sync/${schema}`, { method: 'POST' }),

  registerModules: (schema) =>
    request(SYNC_URL, `/sync/${schema}/register-modules`, { method: 'POST' }),

  listModules:     (schema) =>
    request(SYNC_URL, `/sync/${schema}/modules`),

  toggleModule:    (schema, root, sub, enable) =>
    request(SYNC_URL,
      `/sync/${schema}/modules?root_module=${encodeURIComponent(root)}&sub_module=${encodeURIComponent(sub)}&enable=${enable}`,
      { method: 'PATCH' }
    ),

  status:          (schema) =>
    request(SYNC_URL, `/status/${schema}`),

  health:          () => request(SYNC_URL, '/health'),

  // ── Shared knowledge ────────────────────────────────────────
  listShared:      () =>
    request(SYNC_URL, '/shared/list'),

  addShared:       (payload) =>
    request(SYNC_URL, '/shared/add', {
      method: 'POST',
      body:   JSON.stringify(payload)
    }),

  deleteShared:    (doc_id) =>
    request(SYNC_URL, `/shared/${encodeURIComponent(doc_id)}`, {
      method: 'DELETE'
    }),

  searchShared:    (question, n_results = 3) => {
    const params = new URLSearchParams({ question, n_results });
    return request(SYNC_URL, `/shared/search?${params}`);
  },
};


// ══════════════════════════════════════════════════════════════
// ADMIN API
// ══════════════════════════════════════════════════════════════
export const adminApi = {

  // ── Connections ───────────────────────────────────────────
  listConnections:  () =>
    request(ADMIN_URL, '/connections'),

  createConnection: (payload) =>
    request(ADMIN_URL, '/connections', {
      method: 'POST',
      body:   JSON.stringify(payload)
    }),

  updateConnection: (id, payload) =>
    request(ADMIN_URL, `/connections/${id}`, {
      method: 'PUT',
      body:   JSON.stringify(payload)
    }),

  deleteConnection: (id) =>
    request(ADMIN_URL, `/connections/${id}`, { method: 'DELETE' }),

  testConnection:   (id) =>
    request(ADMIN_URL, `/connections/${id}/test`, { method: 'POST' }),

  syncConnection:   (id) =>
    request(ADMIN_URL, `/connections/${id}/sync`, { method: 'POST' }),

  getCoreTransactions: (schema) =>
    request(ADMIN_URL, `/core-transactions/${schema}`),

  migrateToCloud: (id) =>
    request(ADMIN_URL, `/connections/${id}/migrate`, { method: 'POST' }),

  checkPgTools: () =>
    request(ADMIN_URL, '/check-pg-tools'),

  // ── Company ───────────────────────────────────────────────
  getCompany:       (schema) =>
    request(ADMIN_URL, `/company/${schema}`),

  // ── Forms & Transids ──────────────────────────────────────
  listTransids:     (schema) =>
    request(ADMIN_URL, `/transids/${schema}`),

  listForms:        (schema) =>
    request(ADMIN_URL, `/forms/${schema}`),

  getFields:        (schema, transid) =>
    request(ADMIN_URL, `/fields/${schema}/${transid}`),

  // ── Instructions ──────────────────────────────────────────
  getInstructions:  (schema, transid) =>
    request(ADMIN_URL, `/instructions/${schema}/${transid}`),

  getInstructionsByLevel: (schema, transid, level) =>
    request(ADMIN_URL, `/instructions/${schema}/${transid}/${level}`),

  saveInstruction:  (payload) =>
    request(ADMIN_URL, '/instructions', {
      method: 'POST',
      body:   JSON.stringify(payload)
    }),

  deleteInstruction: (schema, transid, fieldname) =>
    request(ADMIN_URL, `/instructions/${schema}/${transid}/${fieldname}`, {
      method: 'DELETE'
    }),

  // ── Level Data & Auto Generate ────────────────────────────
  getLevelData:     (schema, transid, level) =>
    request(ADMIN_URL, `/level-data/${schema}/${transid}/${level}`),

  autoGenerate:     (schema, transid, level) =>
    request(ADMIN_URL, `/auto-generate/${schema}/${transid}/${level}`, {
      method: 'POST'
    }),

  // ── Health ────────────────────────────────────────────────
  health:           () => request(ADMIN_URL, '/health'),
};
