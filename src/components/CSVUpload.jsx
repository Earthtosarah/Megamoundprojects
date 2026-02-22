import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  gold: '#D4A017', bg: '#080808', surface: '#111111', surface2: '#161616',
  border: '#1e1e1e', muted: '#555', text: '#e8e0d0',
  green: '#22C55E', red: '#EF4444', amber: '#F59E0B', blue: '#3B8BEB',
}

// ─── TASK CSV UPLOAD ──────────────────────────────────────────
export function TaskCSVUpload({ projectId, onComplete, onClose }) {
  const [stage, setStage] = useState('upload') // upload | preview | done
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const fileRef = useRef()

  const REQUIRED = ['title', 'week', 'section']
  const OPTIONAL = ['status', 'priority', 'is_critical', 'notes', 'start_date', 'end_date']

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const parsed = []
    const errs = []

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return
      // Handle commas inside quoted fields
      const cols = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      cols.push(cur.trim())

      const row = {}
      headers.forEach((h, idx) => { row[h] = cols[idx] || '' })

      // Validate required fields
      const missing = REQUIRED.filter(r => !row[r])
      if (missing.length) {
        errs.push(`Row ${i + 2}: Missing required fields — ${missing.join(', ')}`)
        return
      }

      // Normalize fields
      parsed.push({
        project_id: projectId,
        title: row.title,
        week: row.week?.toUpperCase().includes('WEEK') ? row.week.toUpperCase() : `WEEK ${row.week}`,
        section: row.section,
        status: ['Not Started', 'In Progress', 'Complete', 'Blocked'].includes(row.status) ? row.status : 'Not Started',
        priority: ['Critical', 'High', 'Normal', 'Low'].includes(row.priority) ? row.priority : 'Normal',
        is_critical: ['true', 'yes', '1'].includes((row.is_critical || '').toLowerCase()),
        notes: row.notes || '',
        start_date: row.start_date || null,
        end_date: row.end_date || null,
      })
    })

    setErrors(errs)
    setRows(parsed)
    if (parsed.length > 0) setStage('preview')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parseCSV(ev.target.result)
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    const chunkSize = 20
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      await supabase.from('tasks').insert(chunk)
      setProgress(Math.round(((i + chunkSize) / rows.length) * 100))
    }
    setImporting(false)
    setStage('done')
    setTimeout(() => { onComplete(); onClose() }, 1500)
  }

  function downloadTemplate() {
    const csv = `title,week,section,status,priority,is_critical,notes,start_date,end_date
Plaster lift shaft,WEEK 1,Roofing & Rooftop,Not Started,Critical,true,,2026-02-17,2026-02-23
Complete rooftop duct casting,WEEK 1,Roofing & Rooftop,Not Started,High,false,,2026-02-17,2026-02-23`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'tasks-template.csv'; a.click()
  }

  return (
    <Modal title="Import Tasks from CSV" onClose={onClose}>
      {stage === 'upload' && (
        <div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.7 }}>
              Upload a CSV file with your tasks. Required columns: <span style={{ color: C.gold }}>title, week, section</span>
              <br />Optional: status, priority, is_critical, notes, start_date, end_date
            </div>
            <button onClick={downloadTemplate} style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, borderRadius: 5, padding: '7px 14px',
              cursor: 'pointer', fontSize: 12, marginBottom: 20,
            }}>⬇ Download Template CSV</button>
          </div>

          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${C.border}`, borderRadius: 10,
              padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
            <div style={{ fontSize: 14, color: C.muted }}>Click to select your CSV file</div>
            <div style={{ fontSize: 12, color: '#333', marginTop: 6 }}>Supports .csv files</div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>

          {errors.length > 0 && (
            <div style={{ marginTop: 16, background: `${C.red}11`, border: `1px solid ${C.red}33`, borderRadius: 6, padding: 14 }}>
              <div style={{ fontSize: 12, color: C.red, marginBottom: 8, fontWeight: 600 }}>⚠ {errors.length} rows had errors and were skipped:</div>
              {errors.map((e, i) => <div key={i} style={{ fontSize: 11, color: '#cc4444', marginBottom: 3 }}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {stage === 'preview' && (
        <div>
          <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.green }}>
            ✓ {rows.length} tasks ready to import{errors.length > 0 ? ` (${errors.length} rows skipped due to errors)` : ''}
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.surface2, position: 'sticky', top: 0 }}>
                  {['Title', 'Week', 'Section', 'Priority', 'Critical'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 12px', color: C.text }}>{r.title}</td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{r.week}</td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{r.section}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ color: r.priority === 'Critical' ? C.red : r.priority === 'High' ? C.amber : C.muted, fontSize: 11 }}>{r.priority}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: r.is_critical ? C.red : '#333', fontSize: 11 }}>{r.is_critical ? '🚨 Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStage('upload'); setRows([]); setErrors([]) }} style={{
              flex: 1, background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13,
            }}>← Back</button>
            <button onClick={handleImport} disabled={importing} style={{
              flex: 2, background: C.gold, color: '#000', border: 'none',
              borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              {importing ? `Importing... ${Math.min(progress, 100)}%` : `Import ${rows.length} Tasks`}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.green }}>Import Complete</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>{rows.length} tasks added successfully</div>
        </div>
      )}
    </Modal>
  )
}

// ─── RESOURCE CSV UPLOAD ─────────────────────────────────────
export function ResourceCSVUpload({ projectId, onComplete, onClose }) {
  const [stage, setStage] = useState('upload')
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef()

  function parseCSV(text) {
    const lines = text.trim().split('\n')
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
    const parsed = []
    const errs = []

    lines.slice(1).forEach((line, i) => {
      if (!line.trim()) return
      const cols = []
      let cur = '', inQ = false
      for (const ch of line) {
        if (ch === '"') { inQ = !inQ }
        else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
        else { cur += ch }
      }
      cols.push(cur.trim())

      const row = {}
      headers.forEach((h, idx) => { row[h] = cols[idx] || '' })

      if (!row.name) { errs.push(`Row ${i + 2}: Missing resource name`); return }

      parsed.push({
        project_id: projectId,
        name: row.name,
        type: ['Labour', 'Material', 'Equipment', 'Subcontractor'].includes(row.type) ? row.type : 'Material',
        quantity: parseFloat(row.quantity) || 0,
        unit: row.unit || '',
        cost_per_unit: parseFloat(row.cost_per_unit) || 0,
        milestone: row.milestone || row.week || '',
        milestone_date: row.milestone_date || null,
        supplier: row.supplier || '',
        status: ['Planned', 'Ordered', 'On Site', 'Used'].includes(row.status) ? row.status : 'Planned',
        notes: row.notes || '',
      })
    })

    setErrors(errs)
    setRows(parsed)
    if (parsed.length > 0) setStage('preview')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parseCSV(ev.target.result)
    reader.readAsText(file)
  }

  async function handleImport() {
    setImporting(true)
    await supabase.from('resources').insert(rows)
    setImporting(false)
    setStage('done')
    setTimeout(() => { onComplete(); onClose() }, 1500)
  }

  function downloadTemplate() {
    const csv = `name,type,quantity,unit,cost_per_unit,milestone,milestone_date,supplier,status,notes
Cement bags,Material,500,bags,2500,WEEK 1,2026-02-17,Dangote,Planned,First delivery for plastering
Tilers (gang),Labour,8,persons,25000,WEEK 2,2026-02-24,Subcontractor A,Planned,
Aluminium roofing sheets,Material,120,sheets,45000,WEEK 1,2026-02-17,Roofing Ltd,Ordered,
Lift unit,Equipment,1,unit,4500000,WEEK 4,2026-03-09,Otis Nigeria,Planned,Full installation`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'resources-template.csv'; a.click()
  }

  return (
    <Modal title="Import Resources from CSV" onClose={onClose}>
      {stage === 'upload' && (
        <div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 16, lineHeight: 1.7 }}>
            Upload resources with milestone delivery schedules. Required: <span style={{ color: C.gold }}>name</span>
            <br />Optional: type, quantity, unit, cost_per_unit, <span style={{ color: C.blue }}>milestone, milestone_date</span>, supplier, status, notes
          </div>

          <div style={{
            background: `${C.blue}11`, border: `1px solid ${C.blue}33`,
            borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 12, color: '#6699cc',
          }}>
            💡 Use <strong>milestone</strong> column (e.g. "WEEK 1") to schedule when each resource is needed. The same resource can appear multiple times across different milestones.
          </div>

          <button onClick={downloadTemplate} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 5, padding: '7px 14px',
            cursor: 'pointer', fontSize: 12, marginBottom: 20, display: 'block',
          }}>⬇ Download Template CSV</button>

          <div
            onClick={() => fileRef.current.click()}
            style={{
              border: `2px dashed ${C.border}`, borderRadius: 10,
              padding: '48px 24px', textAlign: 'center', cursor: 'pointer',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = C.blue}
            onMouseLeave={e => e.currentTarget.style.borderColor = C.border}
          >
            <div style={{ fontSize: 32, marginBottom: 10 }}>📦</div>
            <div style={{ fontSize: 14, color: C.muted }}>Click to select your CSV file</div>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ display: 'none' }} />
          </div>
        </div>
      )}

      {stage === 'preview' && (
        <div>
          <div style={{ background: `${C.green}11`, border: `1px solid ${C.green}33`, borderRadius: 6, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: C.green }}>
            ✓ {rows.length} resources ready to import
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${C.border}`, borderRadius: 6, marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: C.surface2, position: 'sticky', top: 0 }}>
                  {['Name', 'Type', 'Qty', 'Cost/Unit', 'Milestone', 'Status'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: C.muted, fontWeight: 500, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${C.border}` }}>
                    <td style={{ padding: '8px 12px', color: C.text }}>{r.name}</td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{r.type}</td>
                    <td style={{ padding: '8px 12px', color: C.muted }}>{r.quantity} {r.unit}</td>
                    <td style={{ padding: '8px 12px', color: C.gold }}>₦{(r.cost_per_unit || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', color: C.blue }}>{r.milestone || '—'}</td>
                    <td style={{ padding: '8px 12px', color: C.muted, fontSize: 11 }}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { setStage('upload'); setRows([]) }} style={{
              flex: 1, background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13,
            }}>← Back</button>
            <button onClick={handleImport} disabled={importing} style={{
              flex: 2, background: C.blue, color: '#fff', border: 'none',
              borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>
              {importing ? 'Importing...' : `Import ${rows.length} Resources`}
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: C.green }}>Import Complete</div>
        </div>
      )}
    </Modal>
  )
}

// ─── MODAL WRAPPER ────────────────────────────────────────────
export function Modal({ title, onClose, children }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000000dd',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div style={{
        background: '#111', border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 32, width: '100%', maxWidth: 600,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
          <button onClick={onClose} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 5, width: 30, height: 30,
            cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
