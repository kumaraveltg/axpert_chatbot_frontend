import { useState,useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6'];
const OPERATOR_LABELS = {
  equals:      "equals",
  not_equals:  "not equals",
  contains:    "contains",
  starts_with: "starts with",
  ends_with:   "ends with",
  in:          "in",
  gt:          ">",
  lt:          "<",
  gte:         ">=",
  lte:         "<=",
  between:     "between",
};

const OPERATORS_BY_TYPE = {
  text:    ["equals", "not_equals", "contains", "starts_with", "ends_with", "in"],
  list:    ["equals", "not_equals", "in"],
  numeric: ["equals", "gt", "lt", "gte", "lte", "between"],
  date:    ["between", "gte", "lte"],
};


// ── ID field patterns to skip in KPI ─────────────────────────
const ID_SUFFIXES = ['id', 'aid', 'bid', 'mid', 'sid', 'rid'];
const ID_EXACT    = ['sno', 'recid', 'rowid', 'exeord', 'code'];

function isIdField(key) {
  const k = key.toLowerCase();
  if (ID_EXACT.includes(k)) return true;
  if (ID_SUFFIXES.some(s => k.endsWith(s))) return true;
  return false;
}

function isNumeric(val) {
  if (val === null || val === undefined || val === '') return false;
  return !isNaN(parseFloat(val)) && isFinite(val);
}

// ── Export functions ──────────────────────────────────────────
function exportExcel(columns, rows, title) {
  const headers = columns.map(c => c.label);
  const data    = rows.map(row => columns.map(c => row[c.key] ?? ''));
  const ws      = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const wb      = XLSX.utils.book_new();
  ws['!cols']   = columns.map(() => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${title || 'report'}.xlsx`);
}

function exportCSV(columns, rows, title) {
  const headers  = columns.map(c => `"${c.label}"`).join(',');
  const dataRows = rows.map(row =>
    columns.map(c => `"${(row[c.key] ?? '').toString().replace(/"/g, '""')}"`).join(',')
  );
  const blob = new Blob([[headers, ...dataRows].join('\n')], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${title || 'report'}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPDF(columns, rows, title,chartRef) {
  try {
    const { default: jsPDF }     = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'landscape' });

    // ── Title ─────────────────────────────────────────────
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text(title || 'Report', 14, 16);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);

    let startY = 28;

    // ── Chart image ───────────────────────────────────────
    try {
      const chartEl = document.querySelector('.recharts-wrapper canvas')
                   || document.querySelector('.recharts-surface');
      if (chartEl) {
        // Convert SVG to canvas then to image
        const svgEl = document.querySelector('.recharts-surface');
        if (svgEl) {
          const svgData  = new XMLSerializer().serializeToString(svgEl);
          const svgBlob  = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
          const url      = URL.createObjectURL(svgBlob);
          const img      = new Image();
          await new Promise((resolve, reject) => {
            img.onload  = resolve;
            img.onerror = reject;
            img.src     = url;
          });
          const canvas    = document.createElement('canvas');
          canvas.width    = svgEl.clientWidth  || 600;
          canvas.height   = svgEl.clientHeight || 300;
          const ctx       = canvas.getContext('2d');
          ctx.fillStyle   = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          const imgData = canvas.toDataURL('image/png');
          // Add chart — scale to fit page width
          const pageW    = doc.internal.pageSize.getWidth();
          const imgW     = pageW - 28;
          const imgH     = (canvas.height / canvas.width) * imgW;
          doc.addImage(imgData, 'PNG', 14, startY, imgW, imgH);
          startY += imgH + 8;
        }
      }
    } catch (chartErr) {
      console.warn('Chart export skipped:', chartErr);
      // Continue without chart
    }

    // ── Table ─────────────────────────────────────────────
    autoTable(doc, {
      head:       [columns.map(c => c.label)],
      body:       rows.map(row => columns.map(c => row[c.key] ?? '')),
      startY,
      styles:     { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`${title || 'report'}.pdf`);
  } catch (e) {
    alert('PDF export failed. Run: npm install jspdf jspdf-autotable');
  }
}

// ── Export dropdown ───────────────────────────────────────────
function ExportMenu({ columns, rows, title,chartRef }) {
  const [open, setOpen] = useState(false);

  const options = [
    { label: 'Excel (.xlsx)', icon: 'ti-table',         fn: () => exportExcel(columns, rows, title) },
    { label: 'CSV (.csv)',    icon: 'ti-file-text',      fn: () => exportCSV(columns, rows, title)   },
    { label: 'PDF (.pdf)',    icon: 'ti-file-type-pdf',  fn: () => exportPDF(columns, rows, title)   },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        padding: '4px 10px', fontSize: 11, fontWeight: 500,
        background: 'rgba(255,255,255,0.15)', color: '#fff',
        border: '1px solid rgba(255,255,255,0.3)',
        borderRadius: 6, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4
      }}>
        <i className="ti ti-download" style={{ fontSize: 12 }} aria-hidden="true" />
        Export
      </button>

      {open && (
        <>
          {/* Click outside to close */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99
          }} onClick={() => setOpen(false)} />

          <div style={{
            position: 'absolute', top: '100%', right: 0,
            marginTop: 4, background: '#fff',
            border: '1px solid #e2e8f0', borderRadius: 8,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
            zIndex: 100, minWidth: 150, overflow: 'hidden'
          }}>
            {options.map(opt => (
              <button key={opt.label} onClick={() => { opt.fn(); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '9px 14px',
                background: 'none', border: 'none',
                fontSize: 12, color: '#374151',
                cursor: 'pointer', textAlign: 'left'
              }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <i className={`ti ${opt.icon}`}
                  style={{ fontSize: 14, color: '#6366f1' }}
                  aria-hidden="true" />
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── KPI card ──────────────────────────────────────────────────
function KpiCard({ label, value }) {
  return (
    <div style={{
      background: '#f8fafc', borderRadius: 10,
      padding: '12px 16px', minWidth: 120, textAlign: 'center',
      border: '1px solid #e2e8f0'
    }}>
      <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 4px', fontWeight: 500 }}>
        {label}
      </p>
      <p style={{ fontSize: 20, fontWeight: 700, color: '#1e293b', margin: 0 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

// ── Chart ─────────────────────────────────────────────────────
function ReportChart({ chart, rows }) {
  if (!chart?.x || !chart?.y || !rows?.length) return null;

  // Aggregate — group by x, sum y (skip ID fields)
  const agg = {};
  rows.forEach(r => {
    const xVal = String(r[chart.x] ?? 'Unknown').slice(0, 25);
    const yVal = parseFloat(r[chart.y]) || 0;
    agg[xVal]  = (agg[xVal] || 0) + yVal;
  });

  const data = Object.entries(agg)
    .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  if (!data.length) return null;

  if (chart.type === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name"
            cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={v => v.toLocaleString()} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === 'line') {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} />
          <Tooltip formatter={v => v.toLocaleString()} />
          <Line type="monotone" dataKey="value"
            stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 10 }}
          interval={0} angle={-30} textAnchor="end" height={50} />
        <YAxis tick={{ fontSize: 11 }} />
        <Tooltip formatter={v => v.toLocaleString()} />
        <Bar dataKey="value" fill="#6366f1" radius={[4,4,0,0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Pagination button ─────────────────────────────────────────
function PgBtn({ disabled, onClick, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '4px 10px', fontSize: 12,
      background: disabled ? '#f1f5f9' : '#fff',
      border: '1px solid #e2e8f0', borderRadius: 6,
      cursor: disabled ? 'not-allowed' : 'pointer',
      color: disabled ? '#cbd5e1' : '#475569'
    }}>{children}</button>
  );
}

// ── Main ReportBubble ─────────────────────────────────────────
export default function ReportBubble({ report, filterMeta = {}, onApplyFilters,onLoadDetails }) {
  const [view, setView]       = useState('both');
  const [page, setPage]       = useState(0);
  const [field, setField]     = useState('');
  const [op, setOp]           = useState('equals');
  const [val, setVal]         = useState('');
  const [val2, setVal2]       = useState('');
  const [activeFilters, setActiveFilters] = useState([]);
  const [filteredRows, setFilteredRows]   = useState(null);
  const PAGE_SIZE = 20;
  const chartRef = useRef(null);

  function handleFieldChange(f) {
    setField(f);
    setVal(''); setVal2('');
    const t   = filterMeta[f]?.type || 'text';
    const ops = OPERATORS_BY_TYPE[t] || OPERATORS_BY_TYPE.text;
    setOp(ops[0]);
  }

  function addFilter() {
    if (!field || !val) return;
    const filterVal = op === 'between' ? `${val},${val2}` : val;
    const label     = `${filterMeta[field]?.caption || field} ${OPERATOR_LABELS[op]} ${op === 'between' ? `${val}–${val2}` : val}`;
    setActiveFilters(prev => [...prev, { key: `${field}__${op}`, label, val: filterVal }]);
    setVal(''); setVal2('');
  }

  async function applyFilters() {
  if (!onApplyFilters) return;
  const payload = Object.fromEntries(activeFilters.map(f => [f.key, f.val]));
  const result  = await onApplyFilters(payload);
  if (result?.rows && result.rows.length > 0) {
    setFilteredRows(result.rows);
  } else if (result?.type === 'count') {
    // Backend returned count — force another call via onLoadDetails
    // This happens when question still matches is_count
    // Workaround: treat total as the answer
    setFilteredRows([]);   // clear rows so table shows empty
    alert(`Filtered count: ${result.total}`);
  }
}

  async function clearFilters() {
  setActiveFilters([]);
  setFilteredRows(null);
  setPage(0);
  // Re-fetch original data without filters
  if (onApplyFilters) {
    const res = await onApplyFilters({});
    if (res?.rows) setFilteredRows(res.rows);
  }
}

  if (!report) return null;

  const { title, columns = [], rows = [], summary = [], chart, total, cached } = report;
  const displayRows = filteredRows ?? rows;

  // Filter out ID columns from display
  const visibleCols = columns.filter(c => !isIdField(c.key));
  const visibleRows = displayRows.map(row => {
    const r = {};
    visibleCols.forEach(c => { r[c.key] = row[c.key]; });
    return r;
  });

  // Filter summary — skip ID-based KPIs
  const visibleSummary = summary.filter(s =>
    s.label === 'Total Records' || !isIdField(s.label.replace('Total ', ''))
  );

  const pageRows  = visibleRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPgs  = Math.ceil(visibleRows.length / PAGE_SIZE);
   
  return (
    <div style={{
      background: '#fff', border: '1px solid #e2e8f0',
      borderRadius: 14, overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: '100%'
    }}>

      {/* Header */}
      <div style={{
        padding: '12px 16px',
        background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 8, flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-chart-bar"
            style={{ fontSize: 16, color: '#fff' }} aria-hidden="true" />
          <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
            {title}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
            {total} records {cached ? '· cached' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* View toggle */}
          {['table','chart','both'].map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: '4px 10px', fontSize: 11, fontWeight: 500,
              background: view === v ? '#fff' : 'rgba(255,255,255,0.15)',
              color: view === v ? '#4f46e5' : '#fff',
              border: 'none', borderRadius: 6, cursor: 'pointer'
            }}>{v}</button>
          ))}

          {/* Export */}
          <ExportMenu columns={visibleCols} rows={visibleRows} title={title} chartRef={chartRef} />
        </div>
      </div>

      <div style={{ padding: '14px 16px' }}>

        {/* KPI summary — no ID fields */}
        {visibleSummary.length > 0 && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
            {visibleSummary.map((s, i) => (
              <KpiCard key={i} label={s.label} value={s.value} />
            ))}
          </div>
        )}
        {/* View Details button for count type */}
        {report.type === 'count' && (
          <button
            onClick={() => onLoadDetails?.()}
            style={{
              width: '100%', padding: '9px',
              fontSize: 13, borderRadius: 8,
              border: '1px solid #6366f1',
              background: '#6366f1', color: '#fff',
              cursor: 'pointer', marginBottom: 12
            }}
          >
            View all {report.total?.toLocaleString()} employee details →
          </button>
        )}
        {/* Chart */}
        {(view === 'chart' || view === 'both') && chart?.x && (
          <div style={{ marginBottom: 14 }}>
            <ReportChart chart={chart} rows={visibleRows}  />
          </div>
        )}
        {/* Filter bar */}
        {Object.keys(filterMeta).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center',
              padding:10, background:'#f8fafc', borderRadius:8, marginBottom:8 }}>

              <select value={field} onChange={e => handleFieldChange(e.target.value)}
                style={fStyle.select}>
                <option value="">Filter by field...</option>
                {Object.entries(filterMeta).map(([k, v]) => (
                  <option key={k} value={k}>{v.caption || k}</option>
                ))}
              </select>

              {field && (
                <select value={op} onChange={e => { setOp(e.target.value); setVal(''); setVal2(''); }}
                  style={fStyle.select}>
                  {(OPERATORS_BY_TYPE[filterMeta[field]?.type || 'text'] || OPERATORS_BY_TYPE.text)
                    .map(o => <option key={o} value={o}>{OPERATOR_LABELS[o]}</option>)}
                </select>
              )}

              {field && op === 'between' && (
                <>
                  <input style={fStyle.input} placeholder="From"
                    value={val} onChange={e => setVal(e.target.value)} />
                  <span style={{ fontSize:12, color:'#94a3b8' }}>to</span>
                  <input style={fStyle.input} placeholder="To"
                    value={val2} onChange={e => setVal2(e.target.value)} />
                </>
              )}

              {field && op !== 'between' && filterMeta[field]?.type === 'list' && (
                <select style={fStyle.select} value={val} onChange={e => setVal(e.target.value)}>
                  <option value="">Select...</option>
                  {(filterMeta[field]?.values || []).map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              )}

              {field && op !== 'between' && filterMeta[field]?.type !== 'list' && (
                <input style={{ ...fStyle.input, minWidth: op === 'in' ? 180 : 120 }}
                  placeholder={
                        op === 'in' ? 'Finance, HR, IT' :
                        filterMeta[field]?.type === 'lookup' ? `Type ${filterMeta[field]?.caption || field} name...` :
                        'Value...'
                      }
                  type={filterMeta[field]?.type === 'numeric' ? 'number' : 'text'}
                  value={val} onChange={e => setVal(e.target.value)} />
              )}

              <button onClick={addFilter} disabled={!field || !val} style={fStyle.addBtn}>
                + Add
              </button>
            </div>

            {activeFilters.length > 0 && (
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
                {activeFilters.map((f, i) => (
                  <div key={i} style={fStyle.chip}>
                    {f.label}
                    <span style={{ cursor:'pointer', marginLeft:4 }}
                      onClick={() => setActiveFilters(prev => prev.filter((_,j) => j !== i))}>✕</span>
                  </div>
                ))}
                <button onClick={applyFilters} style={fStyle.applyBtn}>Apply</button>
                <button onClick={clearFilters} style={fStyle.clearBtn}>Clear all</button>
              </div>
            )}
          </div>
        )}
        {/* Table */}
        {(view === 'table' || view === 'both') && visibleCols.length > 0 && (
          <>
            <div style={{ overflowX: 'auto',maxWidth:'100%' ,WebkitOverflowScrolling: 'touch' }}>
              <table style={{ minWidth:'max-content',width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {visibleCols.map(col => (
                      <th key={col.key} style={{
                        padding: '8px 10px', textAlign: 'left',
                        fontWeight: 600, color: '#475569',
                        borderBottom: '1px solid #e2e8f0',
                        whiteSpace: 'nowrap'
                      }}>
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#f0f4ff'}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? '#fff' : '#fafafa'}
                    >
                      {visibleCols.map(col => (
                        <td key={col.key} style={{
                          padding: '7px 10px',
                          borderBottom: '1px solid #f1f5f9',
                          color: '#334155', whiteSpace: 'nowrap'
                        }}>
                          {row[col.key] !== null && row[col.key] !== undefined
                            ? String(row[col.key]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPgs > 1 && (
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 10, fontSize: 12, color: '#64748b'
              }}>
                <span>{total} total · showing {page * PAGE_SIZE + 1}–{Math.min((page+1) * PAGE_SIZE, visibleRows.length)}</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <PgBtn disabled={page === 0} onClick={() => setPage(0)}>«</PgBtn>
                  <PgBtn disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹</PgBtn>
                  <span>{page + 1} / {totalPgs}</span>
                  <PgBtn disabled={page >= totalPgs - 1} onClick={() => setPage(p => p + 1)}>›</PgBtn>
                  <PgBtn disabled={page >= totalPgs - 1} onClick={() => setPage(totalPgs - 1)}>»</PgBtn>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
const fStyle = {
  select: {
    fontSize:12, padding:'5px 8px', borderRadius:6,
    border:'1px solid #e2e8f0', background:'#fff',
    color:'#374151', minWidth:120,
  },
  input: {
    fontSize:12, padding:'5px 8px', borderRadius:6,
    border:'1px solid #e2e8f0', background:'#fff',
    color:'#374151', minWidth:100,
  },
  addBtn: {
    fontSize:12, padding:'5px 12px', borderRadius:6,
    border:'1px solid #e2e8f0', background:'#fff',
    color:'#374151', cursor:'pointer',
  },
  chip: {
    display:'flex', alignItems:'center',
    fontSize:11, padding:'3px 10px', borderRadius:20,
    background:'#eef2ff', color:'#4338ca',
  },
  applyBtn: {
    fontSize:12, padding:'5px 12px', borderRadius:6,
    border:'none', background:'#4f46e5',
    color:'#fff', cursor:'pointer',
  },
  clearBtn: {
    fontSize:12, padding:'5px 12px', borderRadius:6,
    border:'1px solid #e2e8f0', background:'transparent',
    color:'#64748b', cursor:'pointer',
  },
};