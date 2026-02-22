import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { ResourceCSVUpload } from './CSVUpload'

const C = {
  gold: '#D4A017', bg: '#080808', surface: '#111111', surface2: '#161616',
  border: '#1e1e1e', muted: '#555', text: '#e8e0d0',
  green: '#22C55E', red: '#EF4444', amber: '#F59E0B', blue: '#3B8BEB',
}

const STATUS_ORDER = ['Planned', 'Ordered', 'On Site', 'Used']
const STATUS_COLORS = {
  'Planned': C.muted,
  'Ordered': C.amber,
  'On Site': C.blue,
  'Used': C.green,
}
const TYPE_COLORS = {
  'Labour': '#A855F7',
  'Material': C.blue,
  'Equipment': C.amber,
  'Subcontractor': C.gold,
}

function Badge({ label, color }) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500,
    }}>{label}</span>
  )
}

export default function ResourcesView({ resources, projectId, isAdmin, onRefresh }) {
  const [view, setView] = useState('milestone') // milestone | table | tracker
  const [showAdd, setShowAdd] = useState(false)
  const [showCSV, setShowCSV] = useState(false)
  const [expandedMilestone, setExpandedMilestone] = useState(null)
  const [form, setForm] = useState({
    name: '', type: 'Material', quantity: '', unit: '',
    cost_per_unit: '', milestone: '', milestone_date: '',
    supplier: '', status: 'Planned', notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function addResource() {
    if (!form.name) return
    setSaving(true)
    await supabase.from('resources').insert([{ ...form, project_id: projectId }])
    setSaving(false)
    setShowAdd(false)
    setForm({ name: '', type: 'Material', quantity: '', unit: '', cost_per_unit: '', milestone: '', milestone_date: '', supplier: '', status: 'Planned', notes: '' })
    onRefresh()
  }

  async function updateStatus(id, status) {
    await supabase.from('resources').update({ status }).eq('id', id)
    onRefresh()
  }

  // Group by milestone
  const milestones = {}
  resources.forEach(r => {
    const key = r.milestone || 'Unscheduled'
    if (!milestones[key]) milestones[key] = []
    milestones[key].push(r)
  })

  // Sort milestone keys
  const milestoneKeys = Object.keys(milestones).sort((a, b) => {
    if (a === 'Unscheduled') return 1
    if (b === 'Unscheduled') return -1
    const aNum = parseInt(a.replace(/\D/g, '')) || 999
    const bNum = parseInt(b.replace(/\D/g, '')) || 999
    return aNum - bNum
  })

  const totalCost = resources.reduce((sum, r) => sum + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)
  const spentCost = resources.filter(r => ['On Site', 'Used'].includes(r.status))
    .reduce((sum, r) => sum + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)
  const spentPct = totalCost ? Math.round((spentCost / totalCost) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: C.blue, letterSpacing: 3, marginBottom: 4 }}>RESOURCES</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {resources.length} items · Total ₦{totalCost.toLocaleString()} · Deployed ₦{spentCost.toLocaleString()} ({spentPct}%)
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && (
            <>
              <button onClick={() => setShowCSV(true)} style={{
                background: 'transparent', border: `1px solid ${C.border}`,
                color: C.muted, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 12,
              }}>⬆ Import CSV</button>
              <button onClick={() => setShowAdd(!showAdd)} style={{
                background: C.blue, color: '#fff', border: 'none',
                borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>+ Add Resource</button>
            </>
          )}
        </div>
      </div>

      {/* Cost tracker bar */}
      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Budget Deployment Progress</span>
          <span style={{ fontSize: 12, color: C.blue, fontWeight: 600 }}>{spentPct}% deployed</span>
        </div>
        <div style={{ height: 8, background: '#1a1a1a', borderRadius: 4, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ height: '100%', width: `${spentPct}%`, background: `linear-gradient(90deg, ${C.blue}, #66aaff)`, borderRadius: 4, transition: 'width 0.5s' }} />
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = resources.filter(r => r.status === status).length
            const cost = resources.filter(r => r.status === status).reduce((s, r) => s + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)
            return (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 11, color: C.muted }}>{status}: </span>
                <span style={{ fontSize: 11, color }}>{count} items</span>
                {cost > 0 && <span style={{ fontSize: 11, color: '#444' }}>· ₦{cost.toLocaleString()}</span>}
              </div>
            )
          })}
        </div>
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[
          { key: 'milestone', label: '📅 By Milestone' },
          { key: 'tracker', label: '📊 Tracker' },
          { key: 'table', label: '📋 Full Table' },
        ].map(v => (
          <button key={v.key} onClick={() => setView(v.key)} style={{
            background: view === v.key ? `${C.blue}22` : C.surface,
            border: `1px solid ${view === v.key ? C.blue + '44' : C.border}`,
            color: view === v.key ? C.blue : C.muted,
            padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
          }}>{v.label}</button>
        ))}
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Add Resource</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>RESOURCE NAME</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Cement bags, Tilers, Lift unit"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>TYPE</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13 }}>
                {['Labour', 'Material', 'Equipment', 'Subcontractor'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>MILESTONE (WEEK)</label>
              <input value={form.milestone} onChange={e => setForm(p => ({ ...p, milestone: e.target.value }))}
                placeholder="e.g. WEEK 1, WEEK 3"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>MILESTONE DATE</label>
              <input type="date" value={form.milestone_date} onChange={e => setForm(p => ({ ...p, milestone_date: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>QUANTITY</label>
              <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>UNIT</label>
              <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="bags, persons, sheets"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>COST PER UNIT (₦)</label>
              <input type="number" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: e.target.value }))}
                placeholder="0"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>SUPPLIER</label>
              <input value={form.supplier} onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                placeholder="Supplier name"
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>STATUS</label>
              <select value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13 }}>
                {STATUS_ORDER.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: '9px 0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={addResource} disabled={saving} style={{ flex: 2, background: C.blue, color: '#fff', border: 'none', borderRadius: 5, padding: '9px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
              {saving ? 'Saving...' : 'Add Resource'}
            </button>
          </div>
        </div>
      )}

      {/* MILESTONE VIEW */}
      {view === 'milestone' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {milestoneKeys.map(key => {
            const items = milestones[key]
            const milestoneCost = items.reduce((s, r) => s + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)
            const deployed = items.filter(r => ['On Site', 'Used'].includes(r.status)).length
            const pct = items.length ? Math.round((deployed / items.length) * 100) : 0
            const isExpanded = expandedMilestone === key || expandedMilestone === null

            return (
              <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                {/* Milestone header */}
                <div
                  onClick={() => setExpandedMilestone(expandedMilestone === key ? null : key)}
                  style={{
                    padding: '14px 18px', background: C.surface2, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: isExpanded ? `1px solid ${C.border}` : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: C.blue, letterSpacing: 2 }}>{key}</div>
                    {items[0]?.milestone_date && (
                      <div style={{ fontSize: 11, color: C.muted }}>
                        📅 {new Date(items[0].milestone_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: C.muted }}>{items.length} items</div>
                    <div style={{ fontSize: 12, color: C.gold }}>₦{milestoneCost.toLocaleString()}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 80, height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: C.blue, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontSize: 11, color: pct === 100 ? C.green : C.muted }}>{pct}% deployed</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</span>
                  </div>
                </div>

                {/* Resources in milestone */}
                {isExpanded && (
                  <div>
                    {items.map(r => (
                      <div key={r.id} style={{
                        padding: '12px 18px', borderBottom: `1px solid ${C.border}`,
                        display: 'flex', alignItems: 'center', gap: 14,
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</span>
                            <Badge label={r.type} color={TYPE_COLORS[r.type] || C.muted} />
                          </div>
                          <div style={{ display: 'flex', gap: 16, fontSize: 11, color: C.muted }}>
                            <span>{r.quantity} {r.unit}</span>
                            {r.supplier && <span>Supplier: {r.supplier}</span>}
                            {r.cost_per_unit > 0 && <span style={{ color: C.gold }}>₦{((r.quantity || 0) * (r.cost_per_unit || 0)).toLocaleString()}</span>}
                          </div>
                        </div>

                        {/* Status stepper */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {STATUS_ORDER.map((s, i) => {
                            const currentIdx = STATUS_ORDER.indexOf(r.status)
                            const isPast = i <= currentIdx
                            const isCurrent = i === currentIdx
                            return (
                              <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
                                <div
                                  onClick={() => isAdmin && updateStatus(r.id, s)}
                                  title={s}
                                  style={{
                                    width: isCurrent ? 32 : 10, height: 10,
                                    borderRadius: isCurrent ? 5 : '50%',
                                    background: isPast ? STATUS_COLORS[s] : '#1a1a1a',
                                    border: `1px solid ${isPast ? STATUS_COLORS[s] : '#2a2a2a'}`,
                                    cursor: isAdmin ? 'pointer' : 'default',
                                    transition: 'all 0.2s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  }}
                                >
                                  {isCurrent && <span style={{ fontSize: 7, color: '#000', fontWeight: 700 }}>{s[0]}</span>}
                                </div>
                                {i < STATUS_ORDER.length - 1 && (
                                  <div style={{ width: 12, height: 1, background: i < currentIdx ? STATUS_COLORS[STATUS_ORDER[i + 1]] : '#1a1a1a' }} />
                                )}
                              </div>
                            )
                          })}
                        </div>

                        <Badge label={r.status} color={STATUS_COLORS[r.status] || C.muted} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {resources.length === 0 && (
            <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>
              No resources yet. Add them manually or import via CSV.
            </div>
          )}
        </div>
      )}

      {/* TRACKER VIEW */}
      {view === 'tracker' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {['Labour', 'Material', 'Equipment', 'Subcontractor'].map(type => {
              const typeItems = resources.filter(r => r.type === type)
              if (typeItems.length === 0) return null
              const typeCost = typeItems.reduce((s, r) => s + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)
              const deployedCount = typeItems.filter(r => ['On Site', 'Used'].includes(r.status)).length
              const pct = typeItems.length ? Math.round((deployedCount / typeItems.length) * 100) : 0
              const color = TYPE_COLORS[type] || C.muted

              return (
                <div key={type} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', background: C.surface2, borderBottom: `1px solid ${C.border}`, borderTop: `2px solid ${color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color }}>{type}</div>
                      <div style={{ fontSize: 12, color: C.gold }}>₦{typeCost.toLocaleString()}</div>
                    </div>
                    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>{pct}% deployed · {typeItems.length} items</div>
                  </div>
                  <div>
                    {typeItems.map(r => (
                      <div key={r.id} style={{ padding: '9px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: 12, color: ['On Site', 'Used'].includes(r.status) ? '#444' : C.text, textDecoration: r.status === 'Used' ? 'line-through' : 'none' }}>{r.name}</div>
                          <div style={{ fontSize: 10, color: '#444' }}>{r.milestone && `${r.milestone} · `}{r.quantity} {r.unit}</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {isAdmin ? (
                            <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                              style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 6px', color: STATUS_COLORS[r.status] || C.muted, fontSize: 10, cursor: 'pointer' }}>
                              {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                            </select>
                          ) : (
                            <span style={{ fontSize: 10, color: STATUS_COLORS[r.status] || C.muted }}>{r.status}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {['Resource', 'Type', 'Milestone', 'Qty', 'Unit', 'Cost/Unit', 'Total', 'Supplier', 'Status'].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.muted, fontWeight: 500 }}>{h.toUpperCase()}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {milestoneKeys.flatMap(key =>
                milestones[key].map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td style={{ padding: '11px 14px', fontWeight: 500 }}>{r.name}</td>
                    <td style={{ padding: '11px 14px' }}><Badge label={r.type} color={TYPE_COLORS[r.type] || C.muted} /></td>
                    <td style={{ padding: '11px 14px', color: C.blue, fontSize: 11 }}>{r.milestone || '—'}</td>
                    <td style={{ padding: '11px 14px', color: C.muted }}>{r.quantity}</td>
                    <td style={{ padding: '11px 14px', color: C.muted }}>{r.unit}</td>
                    <td style={{ padding: '11px 14px', color: C.muted }}>₦{(r.cost_per_unit || 0).toLocaleString()}</td>
                    <td style={{ padding: '11px 14px', color: C.gold, fontWeight: 600 }}>₦{((r.quantity || 0) * (r.cost_per_unit || 0)).toLocaleString()}</td>
                    <td style={{ padding: '11px 14px', color: C.muted }}>{r.supplier || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      {isAdmin ? (
                        <select value={r.status} onChange={e => updateStatus(r.id, e.target.value)}
                          style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 4, padding: '4px 8px', color: STATUS_COLORS[r.status] || C.muted, fontSize: 11 }}>
                          {STATUS_ORDER.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : (
                        <Badge label={r.status} color={STATUS_COLORS[r.status] || C.muted} />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}` }}>
                <td colSpan={6} style={{ padding: '12px 14px', fontSize: 12, color: C.muted }}>TOTAL</td>
                <td style={{ padding: '12px 14px', color: C.gold, fontWeight: 700, fontSize: 15 }}>₦{totalCost.toLocaleString()}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* CSV Upload Modal */}
      {showCSV && (
        <ResourceCSVUpload
          projectId={projectId}
          onComplete={onRefresh}
          onClose={() => setShowCSV(false)}
        />
      )}
    </div>
  )
}
