import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { TaskCSVUpload } from '../components/CSVUpload'
import ResourcesViewComponent from '../components/ResourcesView'

const C = {
  gold: '#D4A017',
  bg: '#080808',
  surface: '#111111',
  surface2: '#161616',
  border: '#1e1e1e',
  muted: '#555',
  text: '#e8e0d0',
  green: '#22C55E',
  red: '#EF4444',
  amber: '#F59E0B',
  blue: '#3B8BEB',
}

const VIEWS = ['Tasks', 'Critical Path', 'Risk Register', 'Resources', 'Charts', 'Team']
const STATUSES = ['Not Started', 'In Progress', 'Complete', 'Blocked']
const STATUS_COLORS = { 'Not Started': C.muted, 'In Progress': C.amber, 'Complete': C.green, 'Blocked': C.red }
const PRIORITIES = ['Critical', 'High', 'Normal', 'Low']
const PRIORITY_COLORS = { 'Critical': C.red, 'High': C.amber, 'Normal': C.blue, 'Low': C.muted }

function Badge({ label, color }) {
  return (
    <span style={{
      background: `${color}22`, color, border: `1px solid ${color}44`,
      borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 500,
    }}>{label}</span>
  )
}

function ProgressRing({ pct, color = C.gold, size = 48 }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (pct / 100) * circ
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a1a" strokeWidth={5} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={5}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
    </svg>
  )
}

export default function ProjectView({ project, onBack }) {
  const { profile } = useAuth()
  const [activeView, setActiveView] = useState('Tasks')
  const [tasks, setTasks] = useState([])
  const [risks, setRisks] = useState([])
  const [resources, setResources] = useState([])
  const [team, setTeam] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeWeek, setActiveWeek] = useState(null)
  const [showAddTask, setShowAddTask] = useState(false)
  const [showTaskCSV, setShowTaskCSV] = useState(false)

  const canEdit = ['Admin', 'Project Manager', 'Site Supervisor', 'Site Engineer'].includes(profile?.role)
  const isAdmin = ['Admin', 'Project Manager'].includes(profile?.role)

  useEffect(() => {
    fetchAll()
  }, [project.id])

  async function fetchAll() {
    setLoading(true)
    const [tasksRes, risksRes, resourcesRes, teamRes] = await Promise.all([
      supabase.from('tasks').select('*, assignee:profiles(full_name, role)').eq('project_id', project.id).order('week').order('section'),
      supabase.from('risks').select('*').eq('project_id', project.id),
      supabase.from('resources').select('*').eq('project_id', project.id),
      supabase.from('project_members').select('*, profile:profiles(full_name, role, email)').eq('project_id', project.id),
    ])
    setTasks(tasksRes.data || [])
    setRisks(risksRes.data || [])
    setResources(resourcesRes.data || [])
    setTeam(teamRes.data || [])
    if (tasksRes.data?.length > 0 && !activeWeek) {
      setActiveWeek(tasksRes.data[0].week)
    }
    setLoading(false)
  }

  // Computed stats
  const totalTasks = tasks.length
  const completedTasks = tasks.filter(t => t.status === 'Complete').length
  const overallPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  const weeks = [...new Set(tasks.map(t => t.week))].sort()
  const weekTasks = tasks.filter(t => t.week === activeWeek)
  const weekCompleted = weekTasks.filter(t => t.status === 'Complete').length
  const weekPct = weekTasks.length ? Math.round((weekCompleted / weekTasks.length) * 100) : 0

  const sections = [...new Set(weekTasks.map(t => t.section))].filter(Boolean)

  // Completion probability (simple algo based on current velocity)
  const completionProbability = () => {
    if (totalTasks === 0) return 0
    const daysElapsed = Math.max(1, Math.ceil((new Date() - new Date(project.created_at)) / (1000 * 60 * 60 * 24)))
    const daysTotal = Math.ceil((new Date(project.target_date) - new Date(project.created_at)) / (1000 * 60 * 60 * 24))
    const daysLeft = Math.max(0, Math.ceil((new Date(project.target_date) - new Date()) / (1000 * 60 * 60 * 24)))
    const velocity = completedTasks / daysElapsed
    const tasksRemaining = totalTasks - completedTasks
    const daysNeeded = velocity > 0 ? tasksRemaining / velocity : 9999
    if (daysNeeded <= daysLeft) return Math.min(99, Math.round(90 + (10 * (daysLeft - daysNeeded) / daysLeft)))
    return Math.max(5, Math.round(90 * (daysLeft / daysNeeded)))
  }

  const probability = completionProbability()

  async function updateTaskStatus(taskId, status) {
    await supabase.from('tasks').update({ status, updated_at: new Date().toISOString() }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t))
  }

  async function updateTaskNote(taskId, notes) {
    await supabase.from('tasks').update({ notes }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notes } : t))
  }

  const daysLeft = Math.ceil((new Date(project.target_date) - new Date()) / (1000 * 60 * 60 * 24))

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Top Nav */}
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{
            background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12,
          }}>← All Projects</button>
          <div>
            <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2, color: C.gold }}>{project.name}</span>
            <span style={{ fontSize: 11, color: C.muted, marginLeft: 10 }}>{project.location}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontSize: 12, color: daysLeft < 14 ? C.red : C.muted,
            fontWeight: daysLeft < 14 ? 600 : 400,
          }}>
            {daysLeft > 0 ? `${daysLeft} days to target` : `${Math.abs(daysLeft)} days overdue`}
          </div>
          <div style={{
            background: `${probability >= 70 ? C.green : probability >= 40 ? C.amber : C.red}22`,
            border: `1px solid ${probability >= 70 ? C.green : probability >= 40 ? C.amber : C.red}44`,
            color: probability >= 70 ? C.green : probability >= 40 ? C.amber : C.red,
            borderRadius: 5, padding: '4px 10px', fontSize: 12, fontWeight: 600,
          }}>
            {probability}% on time
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
        {/* Sidebar */}
        <div style={{
          width: 220, borderRight: `1px solid ${C.border}`,
          padding: '20px 0', overflowY: 'auto', flexShrink: 0, background: C.surface,
        }}>
          {/* Overall progress */}
          <div style={{ padding: '0 16px 20px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1.5, marginBottom: 10 }}>OVERALL PROGRESS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ProgressRing pct={overallPct} color={C.gold} size={44} />
              <div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 22, color: C.gold, letterSpacing: 1 }}>{overallPct}%</div>
                <div style={{ fontSize: 10, color: C.muted }}>{completedTasks}/{totalTasks} tasks</div>
              </div>
            </div>
            <div style={{ marginTop: 10, height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${overallPct}%`, background: `linear-gradient(90deg, ${C.gold}, #f0c060)`, borderRadius: 2, transition: 'width 0.5s' }} />
            </div>
          </div>

          {/* Views */}
          <div style={{ padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 10, color: '#333', letterSpacing: 1.5, padding: '0 16px', marginBottom: 6 }}>VIEWS</div>
            {VIEWS.map(v => (
              <div key={v} onClick={() => setActiveView(v)} style={{
                padding: '8px 16px', cursor: 'pointer',
                borderLeft: activeView === v ? `2px solid ${C.gold}` : '2px solid transparent',
                background: activeView === v ? `${C.gold}0a` : 'transparent',
                color: activeView === v ? C.gold : C.muted,
                fontSize: 13, transition: 'all 0.15s',
              }}>{v}</div>
            ))}
          </div>

          {/* Weeks (only show in Tasks view) */}
          {activeView === 'Tasks' && (
            <div style={{ padding: '12px 0' }}>
              <div style={{ fontSize: 10, color: '#333', letterSpacing: 1.5, padding: '0 16px', marginBottom: 6 }}>WEEKS</div>
              {weeks.map(week => {
                const wt = tasks.filter(t => t.week === week)
                const wc = wt.filter(t => t.status === 'Complete').length
                const wp = wt.length ? Math.round((wc / wt.length) * 100) : 0
                return (
                  <div key={week} onClick={() => setActiveWeek(week)} style={{
                    padding: '8px 16px', cursor: 'pointer',
                    borderLeft: activeWeek === week ? `2px solid ${C.gold}` : '2px solid transparent',
                    background: activeWeek === week ? `${C.gold}0a` : 'transparent',
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: 12, color: activeWeek === week ? C.gold : '#888', fontWeight: 500 }}>{week}</div>
                      <div style={{ fontSize: 11, color: wp === 100 ? C.green : '#444' }}>{wp}%</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Main content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: C.muted }}>Loading...</div>
          ) : (
            <>
              {activeView === 'Tasks' && (
                <TasksView
                  weekTasks={weekTasks}
                  sections={sections}
                  activeWeek={activeWeek}
                  weekPct={weekPct}
                  canEdit={canEdit}
                  isAdmin={isAdmin}
                  onUpdateStatus={updateTaskStatus}
                  onUpdateNote={updateTaskNote}
                  onAddTask={() => setShowAddTask(true)}
                  onImportCSV={() => setShowTaskCSV(true)}
                  projectId={project.id}
                  onRefresh={fetchAll}
                />
              )}
              {activeView === 'Critical Path' && (
                <CriticalPathView tasks={tasks.filter(t => t.is_critical)} onUpdateStatus={updateTaskStatus} canEdit={canEdit} />
              )}
              {activeView === 'Risk Register' && (
                <RiskRegisterView risks={risks} projectId={project.id} isAdmin={isAdmin} onRefresh={fetchAll} />
              )}
              {activeView === 'Resources' && (
                <ResourcesViewComponent resources={resources} projectId={project.id} isAdmin={isAdmin} onRefresh={fetchAll} />
              )}
              {activeView === 'Charts' && (
                <ChartsView tasks={tasks} weeks={weeks} probability={probability} overallPct={overallPct} project={project} />
              )}
              {activeView === 'Team' && (
                <TeamView team={team} projectId={project.id} isAdmin={isAdmin} onRefresh={fetchAll} />
              )}
            </>
          )}
        </div>
      </div>

      {showAddTask && (
        <AddTaskModal
          projectId={project.id}
          weeks={weeks}
          onClose={() => setShowAddTask(false)}
          onCreated={() => { setShowAddTask(false); fetchAll() }}
        />
      )}
      {showTaskCSV && (
        <TaskCSVUpload
          projectId={project.id}
          onComplete={fetchAll}
          onClose={() => setShowTaskCSV(false)}
        />
      )}
    </div>
  )
}

// ─── TASKS VIEW ───────────────────────────────────────────────
function TasksView({ weekTasks, sections, activeWeek, weekPct, canEdit, isAdmin, onUpdateStatus, onUpdateNote, onAddTask, onImportCSV, projectId, onRefresh }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.gold, letterSpacing: 3 }}>{activeWeek}</div>
          <div style={{ fontSize: 13, color: C.muted }}>{weekTasks.length} tasks · {weekPct}% complete</div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onImportCSV} style={{
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.muted, borderRadius: 6, padding: '8px 14px', cursor: 'pointer', fontSize: 12,
            }}>⬆ Import CSV</button>
            <button onClick={onAddTask} style={{
              background: C.gold, color: '#000', border: 'none',
              borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>+ Add Task</button>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {sections.map(section => {
          const sectionTasks = weekTasks.filter(t => t.section === section)
          const sc = sectionTasks.filter(t => t.status === 'Complete').length
          const sp = sectionTasks.length ? Math.round((sc / sectionTasks.length) * 100) : 0

          return (
            <div key={section} style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 8, overflow: 'hidden',
            }}>
              <div style={{
                padding: '11px 14px', background: C.surface2,
                borderBottom: `1px solid ${C.border}`,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#ccc' }}>{section}</span>
                <span style={{
                  fontSize: 10, color: sp === 100 ? C.green : C.muted,
                  background: sp === 100 ? `${C.green}22` : '#1a1a1a',
                  padding: '2px 8px', borderRadius: 10,
                  border: `1px solid ${sp === 100 ? C.green + '44' : '#222'}`,
                }}>{sp}%</span>
              </div>
              <div style={{ padding: '6px 0' }}>
                {sectionTasks.map(task => (
                  <TaskRow key={task.id} task={task} canEdit={canEdit} onUpdateStatus={onUpdateStatus} onUpdateNote={onUpdateNote} />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TaskRow({ task, canEdit, onUpdateStatus, onUpdateNote }) {
  const [editingNote, setEditingNote] = useState(false)
  const [note, setNote] = useState(task.notes || '')
  const [showDetail, setShowDetail] = useState(false)
  const statusColor = STATUS_COLORS[task.status] || C.muted

  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, padding: '8px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        {/* Status cycle button */}
        <div
          onClick={() => {
            if (!canEdit) return
            const idx = STATUSES.indexOf(task.status)
            const next = STATUSES[(idx + 1) % STATUSES.length]
            onUpdateStatus(task.id, next)
          }}
          style={{
            width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 2,
            background: `${statusColor}33`, border: `2px solid ${statusColor}`,
            cursor: canEdit ? 'pointer' : 'default', transition: 'all 0.2s',
          }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <span style={{
              fontSize: 12, color: task.status === 'Complete' ? '#3a3a3a' : '#999',
              textDecoration: task.status === 'Complete' ? 'line-through' : 'none',
              lineHeight: 1.5, flex: 1,
            }}>{task.title}</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 8, flexShrink: 0 }}>
              {task.is_critical && <span style={{ fontSize: 9, color: C.red }}>🚨</span>}
              {task.priority && task.priority !== 'Normal' && (
                <span style={{ fontSize: 9, color: PRIORITY_COLORS[task.priority] }}>
                  {task.priority === 'Critical' ? '🔴' : task.priority === 'High' ? '🟠' : '🟡'}
                </span>
              )}
              <span onClick={() => setShowDetail(!showDetail)} style={{ fontSize: 10, color: '#333', cursor: 'pointer' }}>···</span>
            </div>
          </div>

          {/* Note */}
          {editingNote ? (
            <textarea
              autoFocus
              value={note}
              onChange={e => setNote(e.target.value)}
              onBlur={() => { setEditingNote(false); onUpdateNote(task.id, note) }}
              style={{
                width: '100%', background: '#0e0e0e', border: `1px solid #2a2a2a`,
                borderRadius: 4, color: '#888', fontSize: 11, padding: '5px 7px',
                resize: 'none', minHeight: 48, fontFamily: 'inherit', marginTop: 6, outline: 'none',
              }}
            />
          ) : note ? (
            <div onClick={() => canEdit && setEditingNote(true)} style={{
              fontSize: 11, color: '#555', marginTop: 4, cursor: canEdit ? 'text' : 'default',
              fontStyle: 'italic',
            }}>{note}</div>
          ) : canEdit ? (
            <div onClick={() => setEditingNote(true)} style={{
              fontSize: 11, color: '#2a2a2a', marginTop: 4, cursor: 'text',
            }}>Add note...</div>
          ) : null}

          {/* Photo upload detail panel */}
          {showDetail && <TaskDetail task={task} canEdit={canEdit} />}
        </div>
      </div>
    </div>
  )
}

function TaskDetail({ task, canEdit }) {
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef()

  useEffect(() => {
    fetchPhotos()
  }, [task.id])

  async function fetchPhotos() {
    const { data } = await supabase.from('task_photos').select('*').eq('task_id', task.id)
    setPhotos(data || [])
  }

  async function handleUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const filename = `${task.id}/${Date.now()}_${file.name}`
    const { data: uploadData } = await supabase.storage.from('task-photos').upload(filename, file)
    if (uploadData) {
      const { data: { publicUrl } } = supabase.storage.from('task-photos').getPublicUrl(filename)
      await supabase.from('task_photos').insert([{ task_id: task.id, url: publicUrl, filename: file.name }])
      fetchPhotos()
    }
    setUploading(false)
  }

  return (
    <div style={{ marginTop: 10, padding: '10px', background: '#0d0d0d', borderRadius: 6, border: `1px solid ${C.border}` }}>
      <div style={{ fontSize: 10, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>SITE PHOTOS</div>

      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {photos.map(p => (
            <img key={p.id} src={p.url} alt={p.filename} style={{
              width: 70, height: 70, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border}`,
              cursor: 'pointer',
            }} onClick={() => window.open(p.url)} />
          ))}
        </div>
      )}

      {canEdit && (
        <>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current.click()} disabled={uploading} style={{
            background: 'transparent', border: `1px dashed ${C.border}`,
            color: C.muted, borderRadius: 4, padding: '5px 10px',
            cursor: 'pointer', fontSize: 11, width: '100%',
          }}>
            {uploading ? 'Uploading...' : '+ Upload Photo'}
          </button>
        </>
      )}

      {photos.length === 0 && !canEdit && (
        <div style={{ fontSize: 11, color: '#333' }}>No photos yet</div>
      )}
    </div>
  )
}

// ─── CRITICAL PATH VIEW ───────────────────────────────────────
function CriticalPathView({ tasks, onUpdateStatus, canEdit }) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.red, letterSpacing: 3, marginBottom: 4 }}>CRITICAL PATH</div>
        <div style={{ fontSize: 13, color: C.muted }}>{tasks.length} critical tasks — these cannot slip</div>
      </div>

      {tasks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>
          No critical tasks flagged yet. Mark tasks as critical from the Tasks view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tasks.map((task, i) => (
            <div key={task.id} style={{
              background: C.surface, border: `1px solid ${C.red}33`,
              borderLeft: `3px solid ${C.red}`, borderRadius: 8, padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 16,
            }}>
              <div style={{
                fontFamily: "'Bebas Neue'", fontSize: 20, color: `${C.red}44`, letterSpacing: 1, flexShrink: 0,
              }}>{String(i + 1).padStart(2, '0')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: task.status === 'Complete' ? '#444' : C.text, marginBottom: 4 }}>{task.title}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.muted }}>{task.week}</span>
                  {task.section && <span style={{ fontSize: 11, color: '#333' }}>· {task.section}</span>}
                </div>
              </div>
              <div>
                <Badge label={task.status} color={STATUS_COLORS[task.status] || C.muted} />
              </div>
              {canEdit && (
                <select
                  value={task.status}
                  onChange={e => onUpdateStatus(task.id, e.target.value)}
                  style={{
                    background: '#0d0d0d', border: `1px solid ${C.border}`,
                    borderRadius: 4, padding: '4px 8px', color: C.text, fontSize: 11, cursor: 'pointer',
                  }}
                >
                  {STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── RISK REGISTER VIEW ───────────────────────────────────────
function RiskRegisterView({ risks, projectId, isAdmin, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ title: '', likelihood: 'High', impact: 'High', status: 'Active', mitigation: '', owner: '' })
  const [saving, setSaving] = useState(false)

  async function addRisk() {
    setSaving(true)
    await supabase.from('risks').insert([{ ...form, project_id: projectId }])
    setSaving(false)
    setShowAdd(false)
    setForm({ title: '', likelihood: 'High', impact: 'High', status: 'Active', mitigation: '', owner: '' })
    onRefresh()
  }

  async function updateRisk(id, field, value) {
    await supabase.from('risks').update({ [field]: value }).eq('id', id)
    onRefresh()
  }

  const riskColor = (level) => level === 'High' ? C.red : level === 'Medium' ? C.amber : C.green

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.amber, letterSpacing: 3, marginBottom: 4 }}>RISK REGISTER</div>
          <div style={{ fontSize: 13, color: C.muted }}>{risks.length} risks tracked</div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: C.amber, color: '#000', border: 'none',
            borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>+ Add Risk</button>
        )}
      </div>

      {showAdd && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>RISK DESCRIPTION</label>
              <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="Describe the risk..." style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            {[['likelihood', 'LIKELIHOOD'], ['impact', 'IMPACT']].map(([key, label]) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>{label}</label>
                <select value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13 }}>
                  {['Low', 'Medium', 'High'].map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>OWNER</label>
              <input value={form.owner} onChange={e => setForm(p => ({ ...p, owner: e.target.value }))}
                placeholder="Who owns this risk?" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>MITIGATION ACTION</label>
              <textarea value={form.mitigation} onChange={e => setForm(p => ({ ...p, mitigation: e.target.value }))}
                placeholder="What's being done about it?" rows={2} style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none', resize: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={addRisk} disabled={saving} style={{ flex: 2, background: C.amber, color: '#000', border: 'none', borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving...' : 'Add Risk'}</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {risks.map(risk => (
          <div key={risk.id} style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderLeft: `3px solid ${riskColor(risk.impact)}`, borderRadius: 8, padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>{risk.title}</div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, marginLeft: 16 }}>
                <Badge label={`L: ${risk.likelihood}`} color={riskColor(risk.likelihood)} />
                <Badge label={`I: ${risk.impact}`} color={riskColor(risk.impact)} />
                {isAdmin ? (
                  <select value={risk.status} onChange={e => updateRisk(risk.id, 'status', e.target.value)}
                    style={{ background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 4, padding: '2px 6px', color: C.text, fontSize: 11 }}>
                    {['Active', 'Mitigated', 'Resolved'].map(s => <option key={s}>{s}</option>)}
                  </select>
                ) : (
                  <Badge label={risk.status} color={risk.status === 'Resolved' ? C.green : risk.status === 'Mitigated' ? C.amber : C.red} />
                )}
              </div>
            </div>
            {risk.mitigation && <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>↳ {risk.mitigation}</div>}
            {risk.owner && <div style={{ fontSize: 11, color: '#444' }}>Owner: {risk.owner}</div>}
          </div>
        ))}
        {risks.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>No risks logged yet.</div>
        )}
      </div>
    </div>
  )
}

// ─── RESOURCES VIEW ───────────────────────────────────────────
function ResourcesView({ resources, projectId, isAdmin, onRefresh }) {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', type: 'Labour', quantity: '', unit: '', cost_per_unit: '', status: 'Planned' })
  const [saving, setSaving] = useState(false)

  async function addResource() {
    setSaving(true)
    await supabase.from('resources').insert([{ ...form, project_id: projectId }])
    setSaving(false)
    setShowAdd(false)
    onRefresh()
  }

  const totalCost = resources.reduce((sum, r) => sum + ((r.quantity || 0) * (r.cost_per_unit || 0)), 0)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.blue, letterSpacing: 3, marginBottom: 4 }}>RESOURCES</div>
          <div style={{ fontSize: 13, color: C.muted }}>
            {resources.length} resources · Total: ₦{totalCost.toLocaleString()}
          </div>
        </div>
        {isAdmin && (
          <button onClick={() => setShowAdd(!showAdd)} style={{
            background: C.blue, color: '#fff', border: 'none',
            borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>+ Add Resource</button>
        )}
      </div>

      {showAdd && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>RESOURCE NAME</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Tilers, Cement bags" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>TYPE</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13 }}>
                {['Labour', 'Material', 'Equipment', 'Subcontractor'].map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>QUANTITY</label>
              <input type="number" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                placeholder="0" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>UNIT</label>
              <input value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                placeholder="e.g. days, bags, persons" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>COST PER UNIT (₦)</label>
              <input type="number" value={form.cost_per_unit} onChange={e => setForm(p => ({ ...p, cost_per_unit: e.target.value }))}
                placeholder="0" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
            <button onClick={addResource} disabled={saving} style={{ flex: 2, background: C.blue, color: '#fff', border: 'none', borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Saving...' : 'Add Resource'}</button>
          </div>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.border}` }}>
              {['Resource', 'Type', 'Quantity', 'Unit', 'Cost/Unit', 'Total Cost', 'Status'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, color: C.muted, letterSpacing: 0.5, fontWeight: 500 }}>{h.toUpperCase()}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {resources.map(r => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                <td style={{ padding: '12px 14px', fontWeight: 500 }}>{r.name}</td>
                <td style={{ padding: '12px 14px' }}><Badge label={r.type} color={C.blue} /></td>
                <td style={{ padding: '12px 14px', color: C.muted }}>{r.quantity}</td>
                <td style={{ padding: '12px 14px', color: C.muted }}>{r.unit}</td>
                <td style={{ padding: '12px 14px', color: C.muted }}>₦{(r.cost_per_unit || 0).toLocaleString()}</td>
                <td style={{ padding: '12px 14px', color: C.gold, fontWeight: 600 }}>₦{((r.quantity || 0) * (r.cost_per_unit || 0)).toLocaleString()}</td>
                <td style={{ padding: '12px 14px' }}><Badge label={r.status} color={r.status === 'On Site' ? C.green : r.status === 'Planned' ? C.muted : C.amber} /></td>
              </tr>
            ))}
          </tbody>
          {resources.length > 0 && (
            <tfoot>
              <tr style={{ borderTop: `2px solid ${C.border}` }}>
                <td colSpan={5} style={{ padding: '12px 14px', fontSize: 12, color: C.muted }}>TOTAL</td>
                <td style={{ padding: '12px 14px', color: C.gold, fontWeight: 700, fontSize: 15 }}>₦{totalCost.toLocaleString()}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
        {resources.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>No resources tracked yet.</div>
        )}
      </div>
    </div>
  )
}

// ─── CHARTS VIEW ──────────────────────────────────────────────
function ChartsView({ tasks, weeks, probability, overallPct, project }) {
  const weekData = weeks.map(week => {
    const wt = tasks.filter(t => t.week === week)
    const complete = wt.filter(t => t.status === 'Complete').length
    const inProgress = wt.filter(t => t.status === 'In Progress').length
    const blocked = wt.filter(t => t.status === 'Blocked').length
    return { week: week.replace('WEEK ', 'W'), total: wt.length, complete, inProgress, blocked, notStarted: wt.length - complete - inProgress - blocked }
  })

  const statusData = [
    { name: 'Complete', value: tasks.filter(t => t.status === 'Complete').length, color: C.green },
    { name: 'In Progress', value: tasks.filter(t => t.status === 'In Progress').length, color: C.amber },
    { name: 'Not Started', value: tasks.filter(t => t.status === 'Not Started').length, color: C.muted },
    { name: 'Blocked', value: tasks.filter(t => t.status === 'Blocked').length, color: C.red },
  ].filter(d => d.value > 0)

  const probColor = probability >= 70 ? C.green : probability >= 40 ? C.amber : C.red

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.gold, letterSpacing: 3, marginBottom: 24 }}>ANALYTICS</div>

      {/* Probability Card */}
      <div style={{
        background: C.surface, border: `1px solid ${probColor}44`,
        borderRadius: 10, padding: '24px 28px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 32,
      }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1.5, marginBottom: 8 }}>COMPLETION PROBABILITY</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 64, color: probColor, letterSpacing: 2, lineHeight: 1 }}>{probability}%</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>
            {probability >= 70 ? '✅ On track to complete by target date'
              : probability >= 40 ? '⚠️ At risk — acceleration needed'
              : '🚨 High risk of delay — immediate action required'}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 6 }}>OVERALL PROGRESS — {overallPct}%</div>
          <div style={{ height: 12, background: '#1a1a1a', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: `linear-gradient(90deg, ${C.gold}, #f0c060)`, borderRadius: 6, transition: 'width 0.5s' }} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 12 }}>
            {statusData.map(s => (
              <div key={s.name} style={{ fontSize: 11, color: s.color }}>
                <span style={{ fontWeight: 600 }}>{s.value}</span> {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Progress by week bar chart */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 16 }}>PROGRESS BY WEEK</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData} barSize={20}>
              <XAxis dataKey="week" stroke="#333" tick={{ fill: '#666', fontSize: 11 }} />
              <YAxis stroke="#333" tick={{ fill: '#666', fontSize: 11 }} />
              <Tooltip contentStyle={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
              <Bar dataKey="complete" fill={C.green} name="Complete" radius={[3, 3, 0, 0]} />
              <Bar dataKey="inProgress" fill={C.amber} name="In Progress" radius={[3, 3, 0, 0]} />
              <Bar dataKey="blocked" fill={C.red} name="Blocked" radius={[3, 3, 0, 0]} />
              <Bar dataKey="notStarted" fill="#222" name="Not Started" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown pie */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20 }}>
          <div style={{ fontSize: 12, color: C.muted, letterSpacing: 1, marginBottom: 16 }}>STATUS BREAKDOWN</div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value" paddingAngle={3}>
                {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {statusData.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.color }} />
                <span style={{ color: C.muted }}>{s.name}: </span>
                <span style={{ color: s.color, fontWeight: 600 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── TEAM VIEW ────────────────────────────────────────────────
function TeamView({ team, projectId, isAdmin, onRefresh }) {
  const roleColors = { 'Admin': C.gold, 'Project Manager': C.blue, 'Site Supervisor': C.green, 'Site Engineer': C.amber, 'Subcontractor / Trade': C.muted }

  return (
    <div>
      <div style={{ fontFamily: "'Bebas Neue'", fontSize: 32, color: C.gold, letterSpacing: 3, marginBottom: 24 }}>TEAM</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {team.map(member => (
          <div key={member.id} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 18,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: `${roleColors[member.profile?.role] || C.muted}22`,
                border: `2px solid ${roleColors[member.profile?.role] || C.muted}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: roleColors[member.profile?.role] || C.muted,
              }}>
                {member.profile?.full_name?.[0] || '?'}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600 }}>{member.profile?.full_name}</div>
                <div style={{ fontSize: 11, color: C.muted }}>{member.profile?.email}</div>
              </div>
            </div>
            <Badge label={member.profile?.role || 'Member'} color={roleColors[member.profile?.role] || C.muted} />
          </div>
        ))}
        {team.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, color: C.muted, fontSize: 13 }}>
            No team members assigned to this project yet.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── ADD TASK MODAL ───────────────────────────────────────────
function AddTaskModal({ projectId, weeks, onClose, onCreated }) {
  const [form, setForm] = useState({
    title: '', week: weeks[0] || 'WEEK 1', section: '', status: 'Not Started',
    priority: 'Normal', is_critical: false, notes: '',
  })
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!form.title) return
    setSaving(true)
    await supabase.from('tasks').insert([{ ...form, project_id: projectId }])
    setSaving(false)
    onCreated()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000cc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 24 }}>
      <div style={{ background: '#111', border: `1px solid ${C.border}`, borderRadius: 12, padding: 32, width: '100%', maxWidth: 480 }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>Add Task</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>TASK TITLE</label>
          <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
            placeholder="What needs to be done?" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '10px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {[
            { key: 'week', label: 'WEEK', options: weeks },
            { key: 'priority', label: 'PRIORITY', options: PRIORITIES },
            { key: 'status', label: 'STATUS', options: STATUSES },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>{f.label}</label>
              <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 10px', color: C.text, fontSize: 13 }}>
                {f.options.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>SECTION</label>
            <input value={form.section} onChange={e => setForm(p => ({ ...p, section: e.target.value }))}
              placeholder="e.g. Roofing" style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 10px', color: C.text, fontSize: 13, outline: 'none' }} />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.is_critical} onChange={e => setForm(p => ({ ...p, is_critical: e.target.checked }))}
            style={{ accentColor: C.red, width: 16, height: 16 }} />
          <span style={{ fontSize: 13, color: C.muted }}>🚨 Mark as Critical Path item</span>
        </label>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={{ flex: 2, background: C.gold, color: '#000', border: 'none', borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{saving ? 'Adding...' : 'Add Task'}</button>
        </div>
      </div>
    </div>
  )
}
