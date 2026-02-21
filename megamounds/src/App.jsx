import { useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ProjectView from './pages/ProjectView'
import AdminPanel from './pages/AdminPanel'

function AppInner() {
  const { user, profile, loading } = useAuth()
  const [selectedProject, setSelectedProject] = useState(null)
  const [showAdmin, setShowAdmin] = useState(false)

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080808',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: 4, color: '#D4A017' }}>
          MEGAMOUNDS
        </div>
        <div style={{ fontSize: 12, color: '#333', letterSpacing: 2 }}>LOADING...</div>
      </div>
    )
  }

  if (!user) return <Login />

  if (showAdmin) return <AdminPanel onBack={() => setShowAdmin(false)} />

  if (selectedProject) return (
    <ProjectView
      project={selectedProject}
      onBack={() => setSelectedProject(null)}
    />
  )

  return (
    <div>
      {/* Admin shortcut button */}
      {profile?.role === 'Admin' && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}>
          <button
            onClick={() => setShowAdmin(true)}
            style={{
              background: '#D4A017',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              padding: '10px 18px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 1,
              boxShadow: '0 4px 20px #D4A01740',
            }}
          >
            ⚙ ADMIN
          </button>
        </div>
      )}
      <Dashboard onSelectProject={setSelectedProject} />
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}
