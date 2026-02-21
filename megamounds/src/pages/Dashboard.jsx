import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

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
}

const STATUS_COLORS = {
  'On Track': C.green,
  'At Risk': C.amber,
  'Delayed': C.red,
  'Completed': '#3B8BEB',
  'Not Started': C.muted,
}

function RAGBadge({ status }) {
  const color = STATUS_COLORS[status] || C.muted
  return (
    <span style={{
      background: `${color}22`,
      color,
      border: `1px solid ${color}44`,
      borderRadius: 4,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 500,
      letterSpacing: 0.5,
    }}>{status}</span>
  )
}

function ProgressBar({ pct, color = C.gold }) {
  return (
    <div style={{ height: 4, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: color,
        borderRadius: 2,
        transition: 'width 0.5s ease',
      }} />
    </div>
  )
}

export default function Dashboard({ onSelectProject }) {
  const { profile, signOut } = useAuth()
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewProject, setShowNewProject] = useState(false)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('All')

  useEffect(() => {
    fetchProjects()
  }, [])

  async function fetchProjects() {
    const { data } = await supabase
      .from('projects')
      .select(`
        *,
        tasks:tasks(count),
        completed_tasks:tasks(count)
      `)
      .order('created_at', { ascending: false })
    
    // Fetch task completion data separately
    if (data) {
      const projectsWithProgress = await Promise.all(data.map(async (project) => {
        const { count: total } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
        
        const { count: done } = await supabase
          .from('tasks')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', project.id)
          .eq('status', 'Complete')
        
        return {
          ...project,
          total_tasks: total || 0,
          completed_tasks: done || 0,
          progress: total ? Math.round(((done || 0) / total) * 100) : 0,
        }
      }))
      setProjects(projectsWithProgress)
    }
    setLoading(false)
  }

  const isAdmin = profile?.role === 'Admin'
  const isManager = profile?.role === 'Project Manager' || isAdmin

  const filtered = projects
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()))
    .filter(p => filterStatus === 'All' || p.rag_status === filterStatus)

  const stats = {
    total: projects.length,
    onTrack: projects.filter(p => p.rag_status === 'On Track').length,
    atRisk: projects.filter(p => p.rag_status === 'At Risk').length,
    delayed: projects.filter(p => p.rag_status === 'Delayed').length,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      {/* Top Nav */}
      <div style={{
        background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 28px',
        height: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 22, letterSpacing: 3, color: C.gold }}>
            MEGAMOUNDS
          </span>
          <span style={{ fontSize: 11, color: '#333', letterSpacing: 1 }}>PM</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: C.surface2,
            border: `1px solid ${C.border}`,
            borderRadius: 6,
            padding: '6px 12px',
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: `${C.gold}22`,
              border: `1px solid ${C.gold}44`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, color: C.gold, fontWeight: 600,
            }}>
              {profile?.full_name?.[0] || 'U'}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{profile?.full_name || 'User'}</div>
              <div style={{ fontSize: 10, color: C.muted }}>{profile?.role}</div>
            </div>
          </div>
          <button onClick={signOut} style={{
            background: 'transparent',
            border: `1px solid ${C.border}`,
            color: C.muted,
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 12,
          }}>Sign out</button>
        </div>
      </div>

      <div style={{ padding: '32px 28px', maxWidth: 1300, margin: '0 auto' }}>
        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 32 }}>
          {[
            { label: 'Total Projects', value: stats.total, color: C.text },
            { label: 'On Track', value: stats.onTrack, color: C.green },
            { label: 'At Risk', value: stats.atRisk, color: C.amber },
            { label: 'Delayed', value: stats.delayed, color: C.red },
          ].map(s => (
            <div key={s.label} style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 10,
              padding: '18px 20px',
            }}>
              <div style={{ fontSize: 11, color: C.muted, letterSpacing: 1, marginBottom: 8 }}>{s.label.toUpperCase()}</div>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 36, color: s.color, letterSpacing: 2 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search projects..."
              style={{
                background: C.surface,
                border: `1px solid ${C.border}`,
                borderRadius: 6,
                padding: '8px 14px',
                color: C.text,
                fontSize: 13,
                outline: 'none',
                width: 220,
              }}
            />
            {['All', 'On Track', 'At Risk', 'Delayed', 'Completed'].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)} style={{
                background: filterStatus === s ? `${STATUS_COLORS[s] || C.gold}22` : C.surface,
                border: `1px solid ${filterStatus === s ? (STATUS_COLORS[s] || C.gold) + '44' : C.border}`,
                color: filterStatus === s ? (STATUS_COLORS[s] || C.gold) : C.muted,
                padding: '8px 14px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
              }}>{s}</button>
            ))}
          </div>
          {isManager && (
            <button onClick={() => setShowNewProject(true)} style={{
              background: C.gold,
              color: '#000',
              border: 'none',
              borderRadius: 6,
              padding: '9px 18px',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              letterSpacing: 0.5,
            }}>+ New Project</button>
          )}
        </div>

        {/* Projects Grid */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: C.muted }}>Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 80, color: C.muted }}>
            {projects.length === 0 ? 'No projects yet. Create your first project.' : 'No projects match your search.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {filtered.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => onSelectProject(project)}
              />
            ))}
          </div>
        )}
      </div>

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={() => { setShowNewProject(false); fetchProjects() }}
        />
      )}
    </div>
  )
}

function ProjectCard({ project, onClick }) {
  const daysLeft = Math.ceil((new Date(project.target_date) - new Date()) / (1000 * 60 * 60 * 24))
  const progressColor = project.progress >= 80 ? C.green : project.progress >= 50 ? C.amber : C.gold

  return (
    <div
      onClick={onClick}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 20,
        cursor: 'pointer',
        transition: 'border-color 0.2s, transform 0.1s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = 'translateY(0)' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 3 }}>{project.name}</div>
          <div style={{ fontSize: 12, color: C.muted }}>{project.location}</div>
        </div>
        <RAGBadge status={project.rag_status || 'Not Started'} />
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: C.muted }}>Overall Progress</span>
          <span style={{ fontSize: 12, color: progressColor, fontWeight: 600 }}>{project.progress}%</span>
        </div>
        <ProgressBar pct={project.progress} color={progressColor} />
      </div>

      {/* Meta */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 11, color: C.muted }}>
          {project.completed_tasks}/{project.total_tasks} tasks
        </div>
        <div style={{
          fontSize: 11,
          color: daysLeft < 14 ? C.red : daysLeft < 30 ? C.amber : C.muted,
          fontWeight: daysLeft < 14 ? 600 : 400,
        }}>
          {daysLeft > 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`}
        </div>
      </div>

      {/* Type tag */}
      {project.project_type && (
        <div style={{
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`,
          fontSize: 11,
          color: '#333',
          letterSpacing: 0.5,
        }}>
          {project.project_type}
        </div>
      )}
    </div>
  )
}

function NewProjectModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', location: '', project_type: '', target_date: '', description: '', rag_status: 'Not Started',
  })
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!form.name || !form.target_date) return
    setSaving(true)
    await supabase.from('projects').insert([form])
    setSaving(false)
    onCreated()
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: '#000000cc',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 999, padding: 24,
    }}>
      <div style={{
        background: '#111',
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: 32,
        width: '100%',
        maxWidth: 500,
      }}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>New Project</div>

        {[
          { key: 'name', label: 'Project Name', placeholder: 'e.g. The Curve' },
          { key: 'location', label: 'Location', placeholder: 'e.g. Victoria Island, Lagos' },
          { key: 'project_type', label: 'Project Type', placeholder: 'e.g. 4 Storey Residential' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 0.5 }}>
              {f.label.toUpperCase()}
            </label>
            <input
              value={form[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              style={{
                width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`,
                borderRadius: 6, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none',
              }}
            />
          </div>
        ))}

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 0.5 }}>TARGET COMPLETION DATE</label>
          <input
            type="date"
            value={form.target_date}
            onChange={e => setForm(p => ({ ...p, target_date: e.target.value }))}
            style={{
              width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none',
            }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 6, letterSpacing: 0.5 }}>DESCRIPTION</label>
          <textarea
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
            placeholder="Brief project description..."
            rows={3}
            style={{
              width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`,
              borderRadius: 6, padding: '10px 14px', color: C.text, fontSize: 13, outline: 'none',
              resize: 'none',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{
            flex: 1, background: 'transparent', border: `1px solid ${C.border}`,
            color: C.muted, borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={handleCreate} disabled={saving} style={{
            flex: 2, background: C.gold, color: '#000', border: 'none',
            borderRadius: 6, padding: '10px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600,
          }}>{saving ? 'Creating...' : 'Create Project'}</button>
        </div>
      </div>
    </div>
  )
}
