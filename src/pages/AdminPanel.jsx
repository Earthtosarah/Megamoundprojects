import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const C = {
  gold: '#D4A017', bg: '#080808', surface: '#111111', surface2: '#161616',
  border: '#1e1e1e', muted: '#555', text: '#e8e0d0', green: '#22C55E', red: '#EF4444', blue: '#3B8BEB',
}

const ROLES = ['Admin', 'Project Manager', 'Site Supervisor', 'Site Engineer', 'Subcontractor / Trade']

export default function AdminPanel({ onBack }) {
  const [tab, setTab] = useState('Users')
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'Site Supervisor' })
  const [inviting, setInviting] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchUsers()
  }, [])

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    setUsers(data || [])
    setLoading(false)
  }

  async function inviteUser() {
    if (!inviteForm.email || !inviteForm.full_name) return
    setInviting(true)
    // Create auth user via Supabase admin invite
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(inviteForm.email, {
      data: { full_name: inviteForm.full_name, role: inviteForm.role }
    })
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage(`Invite sent to ${inviteForm.email}`)
      setShowInvite(false)
      fetchUsers()
    }
    setInviting(false)
    setTimeout(() => setMessage(''), 4000)
  }

  async function updateRole(userId, role) {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    fetchUsers()
  }

  const roleColors = {
    'Admin': C.gold, 'Project Manager': C.blue, 'Site Supervisor': C.green,
    'Site Engineer': '#A855F7', 'Subcontractor / Trade': C.muted,
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg }}>
      <div style={{
        background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onBack} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, padding: '5px 12px', borderRadius: 5, cursor: 'pointer', fontSize: 12 }}>← Back</button>
          <span style={{ fontFamily: "'Bebas Neue'", fontSize: 18, letterSpacing: 2, color: C.gold }}>ADMIN PANEL</span>
        </div>
      </div>

      <div style={{ padding: '32px 28px', maxWidth: 1000, margin: '0 auto' }}>
        {message && (
          <div style={{ background: `${C.green}22`, border: `1px solid ${C.green}44`, borderRadius: 6, padding: '10px 16px', marginBottom: 20, fontSize: 13, color: C.green }}>{message}</div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
          {['Users', 'Roles & Permissions'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: tab === t ? `${C.gold}22` : C.surface,
              border: `1px solid ${tab === t ? C.gold + '44' : C.border}`,
              color: tab === t ? C.gold : C.muted,
              padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13,
            }}>{t}</button>
          ))}
        </div>

        {tab === 'Users' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.gold, letterSpacing: 2 }}>TEAM MEMBERS</div>
              <button onClick={() => setShowInvite(true)} style={{
                background: C.gold, color: '#000', border: 'none',
                borderRadius: 6, padding: '8px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>+ Invite Member</button>
            </div>

            {showInvite && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 20, marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Invite New Member</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { key: 'full_name', label: 'FULL NAME', placeholder: 'John Doe' },
                    { key: 'email', label: 'EMAIL ADDRESS', placeholder: 'john@megamounds.com' },
                  ].map(f => (
                    <div key={f.key}>
                      <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>{f.label}</label>
                      <input value={inviteForm[f.key]} onChange={e => setInviteForm(p => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder} style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13, outline: 'none' }} />
                    </div>
                  ))}
                  <div>
                    <label style={{ display: 'block', fontSize: 11, color: C.muted, marginBottom: 5 }}>ROLE</label>
                    <select value={inviteForm.role} onChange={e => setInviteForm(p => ({ ...p, role: e.target.value }))}
                      style={{ width: '100%', background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 5, padding: '9px 12px', color: C.text, fontSize: 13 }}>
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setShowInvite(false)} style={{ flex: 1, background: 'transparent', border: `1px solid ${C.border}`, color: C.muted, borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13 }}>Cancel</button>
                  <button onClick={inviteUser} disabled={inviting} style={{ flex: 2, background: C.gold, color: '#000', border: 'none', borderRadius: 5, padding: '8px 0', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{inviting ? 'Sending invite...' : 'Send Invite'}</button>
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 10 }}>
                  They will receive an email with a link to set their password and access the app.
                </div>
              </div>
            )}

            {loading ? (
              <div style={{ textAlign: 'center', padding: 60, color: C.muted }}>Loading...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {users.map(user => (
                  <div key={user.id} style={{
                    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: '14px 18px',
                    display: 'flex', alignItems: 'center', gap: 16,
                  }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: `${roleColors[user.role] || C.muted}22`,
                      border: `2px solid ${roleColors[user.role] || C.muted}44`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 700, color: roleColors[user.role] || C.muted, flexShrink: 0,
                    }}>{user.full_name?.[0] || '?'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{user.full_name}</div>
                      <div style={{ fontSize: 12, color: C.muted }}>{user.email}</div>
                    </div>
                    <select
                      value={user.role || 'Site Supervisor'}
                      onChange={e => updateRole(user.id, e.target.value)}
                      style={{
                        background: '#0d0d0d', border: `1px solid ${C.border}`,
                        borderRadius: 5, padding: '6px 10px', color: roleColors[user.role] || C.muted, fontSize: 12,
                      }}
                    >
                      {ROLES.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'Roles & Permissions' && (
          <div>
            <div style={{ fontFamily: "'Bebas Neue'", fontSize: 28, color: C.gold, letterSpacing: 2, marginBottom: 20 }}>ROLES & PERMISSIONS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { role: 'Admin', color: C.gold, perms: ['Full access to everything', 'Invite and manage users', 'Create and delete projects', 'Manage all tasks and data', 'Access admin panel'] },
                { role: 'Project Manager', color: C.blue, perms: ['Create and manage projects', 'Add and edit tasks', 'Manage risk register', 'Manage resources', 'View all project data'] },
                { role: 'Site Supervisor', color: C.green, perms: ['Update task status', 'Add notes to tasks', 'Upload site photos', 'View all project data', 'Cannot create projects'] },
                { role: 'Site Engineer', color: '#A855F7', perms: ['Update task status', 'Add notes to tasks', 'Upload site photos', 'View technical data', 'Cannot create projects'] },
                { role: 'Subcontractor / Trade', color: C.muted, perms: ['View assigned tasks only', 'Update own task status', 'Add notes to own tasks', 'Upload photos to own tasks', 'No access to financials'] },
              ].map(r => (
                <div key={r.role} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${r.color}`, borderRadius: 8, padding: '16px 20px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: r.color, marginBottom: 10 }}>{r.role}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {r.perms.map(p => (
                      <span key={p} style={{ fontSize: 12, color: C.muted, background: '#0d0d0d', border: `1px solid ${C.border}`, borderRadius: 4, padding: '3px 10px' }}>✓ {p}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
