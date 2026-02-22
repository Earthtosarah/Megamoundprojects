import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

const C = {
  gold: '#D4A017',
  bg: '#080808',
  surface: '#111111',
  border: '#1e1e1e',
  muted: '#555',
  text: '#e8e0d0',
}

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: C.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      {/* Background texture */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'radial-gradient(circle at 20% 50%, #D4A01708 0%, transparent 50%), radial-gradient(circle at 80% 20%, #D4A01705 0%, transparent 40%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: 400, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{
            fontFamily: "'Bebas Neue', sans-serif",
            fontSize: 42,
            letterSpacing: 6,
            color: C.gold,
            lineHeight: 1,
          }}>MEGAMOUNDS</div>
          <div style={{ fontSize: 11, color: C.muted, letterSpacing: 3, marginTop: 6 }}>
            PROJECT MANAGEMENT
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 12,
          padding: 32,
        }}>
          <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Sign in</div>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 28 }}>
            Use your Megamounds account credentials
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, letterSpacing: 0.5 }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="you@megamounds.com"
                style={{
                  width: '100%',
                  background: '#0d0d0d',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '11px 14px',
                  color: C.text,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, color: C.muted, marginBottom: 6, letterSpacing: 0.5 }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                style={{
                  width: '100%',
                  background: '#0d0d0d',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '11px 14px',
                  color: C.text,
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{
                background: '#EF444422',
                border: '1px solid #EF444444',
                borderRadius: 6,
                padding: '10px 14px',
                fontSize: 13,
                color: '#EF4444',
                marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#2a2a2a' : C.gold,
                color: loading ? C.muted : '#000',
                border: 'none',
                borderRadius: 6,
                padding: '12px 0',
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: 0.5,
                transition: 'all 0.2s',
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, fontSize: 12, color: '#333' }}>
          Contact your administrator for account access
        </div>
      </div>
    </div>
  )
}
