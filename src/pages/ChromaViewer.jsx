import { useState, useEffect } from 'react';
import { adminApi } from '../api/api';

const LIMIT = 10;

// ── Helpers ───────────────────────────────────────────────────
function collectionLabel(name) {
  if (name === 'axpert_shared') return { label: 'shared', color: '#7c3aed', bg: '#ede9fe' };
  const schema = name.replace('axpert_', '');
  return { label: schema, color: '#0369a1', bg: '#e0f2fe' };
}

function sourceColor(source) {
  if (source === 'db_sync')  return { color: '#065f46', bg: '#d1fae5' };
  if (source === 'manual')   return { color: '#92400e', bg: '#fef3c7' };
  if (source === 'auto')     return { color: '#1e40af', bg: '#dbeafe' };
  return { color: '#374151', bg: '#f3f4f6' };
}

function Badge({ text, color, bg }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px',
      borderRadius: 99, background: bg, color,
      letterSpacing: '0.03em', whiteSpace: 'nowrap'
    }}>{text}</span>
  );
}

function EmptyState({ icon, title, sub }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '3rem 1rem', gap: 10,
      color: '#9ca3af'
    }}>
      <i className={`ti ${icon}`} style={{ fontSize: 36 }} aria-hidden="true" />
      <p style={{ margin: 0, fontWeight: 500, color: '#6b7280' }}>{title}</p>
      {sub && <p style={{ margin: 0, fontSize: 13 }}>{sub}</p>}
    </div>
  );
}

// ── Chunk card ────────────────────────────────────────────────
function ChunkCard({ chunk, index, offset }) {
  const [expanded, setExpanded] = useState(false);
  const meta   = chunk.metadata || {};
  const isLong = (chunk.document || '').length > 200;

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '14px 16px',
      marginBottom: 10,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', minWidth: 24 }}>
          #{offset + index + 1}
        </span>
        {meta.source      && <Badge text={meta.source}      {...sourceColor(meta.source)} />}
        {meta.transid     && <Badge text={meta.transid}     color="#1e40af" bg="#dbeafe" />}
        {meta.schema_name && <Badge text={meta.schema_name} color="#374151" bg="#f3f4f6" />}
        {meta.level       && <Badge text={`level: ${meta.level}`} color="#6d28d9" bg="#ede9fe" />}
        {chunk.distance !== undefined && (
          <Badge text={`dist: ${chunk.distance.toFixed(3)}`} color="#374151" bg="#f3f4f6" />
        )}
      </div>

      {/* Document text */}
      <p style={{
        fontSize: 13, color: '#1f2937', lineHeight: 1.65,
        margin: '0 0 8px',
        display: '-webkit-box',
        WebkitLineClamp: expanded ? 'unset' : 3,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}>
        {chunk.document}
      </p>

      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          style={{
            background: 'none', border: 'none', padding: 0,
            fontSize: 12, color: '#6366f1', cursor: 'pointer',
            fontWeight: 500, marginBottom: 8
          }}
        >
          {expanded ? 'Show less ↑' : 'Show more ↓'}
        </button>
      )}

      {/* Metadata table */}
      <div style={{ background: '#f9fafb', borderRadius: 7, padding: '8px 12px', marginTop: 4 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', margin: '0 0 6px', letterSpacing: '0.05em' }}>
          METADATA
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '3px 8px' }}>
          {Object.entries(meta).map(([k, v]) => [
            <span key={k + '_k'} style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>{k}</span>,
            <span key={k + '_v'} style={{ fontSize: 11, color: '#374151', wordBreak: 'break-all' }}>{String(v)}</span>
          ])}
          <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 500 }}>id</span>
          <span style={{ fontSize: 11, color: '#374151', wordBreak: 'break-all', fontFamily: 'monospace' }}>{chunk.id}</span>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function ChromaViewer() {
  const [collections, setCollections] = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [chunks,      setChunks]      = useState([]);
  const [total,       setTotal]       = useState(0);
  const [offset,      setOffset]      = useState(0);
  const [search,      setSearch]      = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [colLoading,  setColLoading]  = useState(true);
  const [error,       setError]       = useState('');

  // Load collections on mount
  useEffect(() => {
    setColLoading(true);
    adminApi.chromaListCollections()
      .then(d => setCollections(d.collections || []))
      .catch(e => setError(e.message))
      .finally(() => setColLoading(false));
  }, []);

  // Load chunks when collection selected or offset changes
  useEffect(() => {
    if (!selected || isSearching) return;
    loadChunks(selected, offset);
  }, [selected, offset]);

  async function loadChunks(name, off) {
    setLoading(true);
    setError('');
    try {
      const d = await adminApi.chromaGetChunks(name, LIMIT, off);
      setChunks(d.chunks || []);
      setTotal(d.total  || 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!search.trim() || !selected) return;
    setLoading(true);
    setIsSearching(true);
    setError('');
    try {
      const d = await adminApi.chromaSearch(selected, search.trim());
      setChunks(d.results || []);
      setTotal(d.results?.length || 0);
      setOffset(0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function clearSearch() {
    setSearch('');
    setIsSearching(false);
    setOffset(0);
    if (selected) loadChunks(selected, 0);
  }

  function selectCollection(name) {
    setSelected(name);
    setChunks([]);
    setOffset(0);
    setSearch('');
    setIsSearching(false);
    setError('');
  }

  const totalPages  = Math.ceil(total / LIMIT);
  const currentPage = Math.floor(offset / LIMIT) + 1;

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0, fontFamily: 'inherit' }}>

      {/* ── Left: collection list ── */}
      <div style={{
        width: 220, flexShrink: 0,
        borderRight: '1px solid #e5e7eb',
        background: '#f9fafb',
        display: 'flex', flexDirection: 'column'
      }}>
        <div style={{ padding: '16px 14px 10px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', margin: 0, letterSpacing: '0.05em' }}>
            COLLECTIONS
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {colLoading && (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px 14px', margin: 0 }}>Loading...</p>
          )}
          {!colLoading && collections.length === 0 && (
            <p style={{ fontSize: 13, color: '#9ca3af', padding: '12px 14px', margin: 0 }}>No collections found</p>
          )}
          {collections.map(col => {
            const { label } = collectionLabel(col.name);
            const isActive  = selected === col.name;
            return (
              <div
                key={col.name}
                onClick={() => selectCollection(col.name)}
                style={{
                  padding: '10px 14px', cursor: 'pointer',
                  background: isActive ? '#ede9fe' : 'transparent',
                  borderLeft: isActive ? '3px solid #6366f1' : '3px solid transparent',
                  transition: 'background 0.1s'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <i className="ti ti-database"
                      style={{ fontSize: 14, color: isActive ? '#6366f1' : '#9ca3af', flexShrink: 0 }}
                      aria-hidden="true" />
                    <span style={{
                      fontSize: 12, fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#4338ca' : '#374151',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {label}
                    </span>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    background: isActive ? '#c7d2fe' : '#e5e7eb',
                    color: isActive ? '#3730a3' : '#6b7280',
                    borderRadius: 99, padding: '1px 6px', flexShrink: 0
                  }}>
                    {col.count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: chunk browser ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {!selected ? (
          <EmptyState
            icon="ti-database-off"
            title="Select a collection"
            sub="Choose a collection from the left to browse chunks"
          />
        ) : (
          <>
            {/* Toolbar */}
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid #e5e7eb',
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff'
            }}>
              <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <i className="ti ti-search" style={{
                    position: 'absolute', left: 10, top: '50%',
                    transform: 'translateY(-50%)',
                    fontSize: 15, color: '#9ca3af', pointerEvents: 'none'
                  }} aria-hidden="true" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Semantic search in this collection..."
                    style={{
                      width: '100%', padding: '8px 10px 8px 34px',
                      border: '1px solid #e5e7eb', borderRadius: 8,
                      fontSize: 13, boxSizing: 'border-box',
                      outline: 'none', background: '#f9fafb'
                    }}
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!search.trim() || loading}
                  style={{
                    padding: '8px 16px', background: '#6366f1',
                    color: '#fff', border: 'none', borderRadius: 8,
                    fontSize: 13, fontWeight: 500, cursor: 'pointer',
                    opacity: !search.trim() || loading ? 0.5 : 1
                  }}
                >
                  Search
                </button>
                {isSearching && (
                  <button onClick={clearSearch} style={{
                    padding: '8px 12px', background: '#f3f4f6',
                    color: '#374151', border: '1px solid #e5e7eb',
                    borderRadius: 8, fontSize: 13, cursor: 'pointer'
                  }}>
                    <i className="ti ti-x" aria-hidden="true" /> Clear
                  </button>
                )}
              </div>
              <div style={{ fontSize: 12, color: '#6b7280', whiteSpace: 'nowrap' }}>
                {isSearching
                  ? `${total} results`
                  : `${total} chunks · page ${currentPage} of ${totalPages || 1}`
                }
              </div>
            </div>

            {/* Search banner */}
            {isSearching && (
              <div style={{
                padding: '8px 20px',
                background: '#eef2ff', borderBottom: '1px solid #c7d2fe',
                fontSize: 12, color: '#4338ca',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <i className="ti ti-sparkles" style={{ fontSize: 14 }} aria-hidden="true" />
                Semantic results for: <strong>"{search}"</strong> — sorted by relevance
              </div>
            )}

            {/* Error */}
            {error && (
              <div style={{
                margin: '12px 20px', padding: '10px 14px',
                background: '#fef2f2', color: '#991b1b',
                borderRadius: 8, fontSize: 13, border: '1px solid #fecaca'
              }}>
                <i className="ti ti-alert-circle" aria-hidden="true" /> {error}
              </div>
            )}

            {/* Chunk list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {loading && (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#9ca3af' }}>
                  <i className="ti ti-loader-2" style={{ fontSize: 24 }} aria-hidden="true" />
                  <p style={{ margin: '8px 0 0', fontSize: 13 }}>Loading chunks...</p>
                </div>
              )}
              {!loading && chunks.length === 0 && (
                <EmptyState
                  icon="ti-mood-empty"
                  title="No chunks found"
                  sub={isSearching ? 'Try a different search query' : 'This collection is empty'}
                />
              )}
              {!loading && chunks.map((chunk, i) => (
                <ChunkCard key={chunk.id} chunk={chunk} index={i} offset={offset} />
              ))}
            </div>

            {/* Pagination */}
            {!isSearching && totalPages > 1 && (
              <div style={{
                padding: '12px 20px', borderTop: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, background: '#fff'
              }}>
                <button onClick={() => setOffset(0)}
                  disabled={offset === 0 || loading} style={pageBtnStyle(offset === 0 || loading)}>
                  <i className="ti ti-chevrons-left" aria-hidden="true" />
                </button>
                <button onClick={() => setOffset(o => Math.max(0, o - LIMIT))}
                  disabled={offset === 0 || loading} style={pageBtnStyle(offset === 0 || loading)}>
                  <i className="ti ti-chevron-left" aria-hidden="true" />
                </button>
                <span style={{ fontSize: 13, color: '#374151', padding: '0 8px' }}>
                  Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button onClick={() => setOffset(o => o + LIMIT)}
                  disabled={offset + LIMIT >= total || loading} style={pageBtnStyle(offset + LIMIT >= total || loading)}>
                  <i className="ti ti-chevron-right" aria-hidden="true" />
                </button>
                <button onClick={() => setOffset((totalPages - 1) * LIMIT)}
                  disabled={offset + LIMIT >= total || loading} style={pageBtnStyle(offset + LIMIT >= total || loading)}>
                  <i className="ti ti-chevrons-right" aria-hidden="true" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function pageBtnStyle(disabled) {
  return {
    padding: '6px 10px', fontSize: 14,
    background: disabled ? '#f9fafb' : '#fff',
    border: '1px solid #e5e7eb', borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#d1d5db' : '#374151'
  };
}
