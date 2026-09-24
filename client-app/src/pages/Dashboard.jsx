import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext.jsx'
import { useQrPayload } from '../hooks/useQrPayload.js'
import { api, ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner.jsx'

const ROTATE_SECONDS = 30

export default function Dashboard() {
  const { member, logout } = useAuth()
  const navigate = useNavigate()
  const { data: qr, error: qrError, loading: qrLoading, secondsLeft, refetch } = useQrPayload()
  const [startingWorkout, setStartingWorkout] = useState(false)
  const [startError, setStartError] = useState(null)

  const progressPct = secondsLeft === null ? 0 : Math.max(0, Math.min(100, (secondsLeft / ROTATE_SECONDS) * 100))

  async function handleStartWorkout() {
    setStartError(null)
    setStartingWorkout(true)
    try {
      const res = await api.createSession()
      navigate(`/workout/session/${res.session_id}`)
    } catch (err) {
      setStartError(err instanceof ApiError ? err.message : 'Could not start a workout. Try again.')
    } finally {
      setStartingWorkout(false)
    }
  }

  return (
    <div className="screen">
      <div className="page-header">
        <div>
          <p className="subtitle" style={{ marginBottom: 2 }}>
            Welcome back,
          </p>
          <h1 className="page-title">{member?.name || 'Member'}</h1>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          style={{ marginLeft: 'auto' }}
          onClick={logout}
        >
          Log out
        </button>
      </div>

      <div className="card" style={{ textAlign: 'center' }}>
        <p className="section-title" style={{ marginTop: 0 }}>
          Gym Entry QR
        </p>

        {qrLoading && !qr && (
          <div style={{ padding: '30px 0' }}>
            <div className="spinner spinner--lg" style={{ margin: '0 auto' }} />
          </div>
        )}

        <ErrorBanner message={qr ? null : qrError} onRetry={refetch} />

        {qr && (
          <>
            <div
              style={{
                background: '#fff',
                padding: 16,
                borderRadius: 'var(--radius-md)',
                display: 'inline-block',
                margin: '4px auto 16px',
              }}
            >
              <QRCodeSVG value={qr.payload} size={200} level="M" />
            </div>
            <p style={{ fontSize: '2rem', fontWeight: 700, letterSpacing: '0.15em', margin: '4px 0 6px' }}>
              {qr.code}
            </p>
            <p className="subtitle" style={{ marginBottom: 12 }}>
              Show the QR to staff, or read them this code
            </p>
            <div
              aria-label="Code refreshes soon"
              style={{
                height: 4,
                borderRadius: 999,
                background: 'var(--bg-elevated-2)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${progressPct}%`,
                  background: 'var(--accent)',
                  transition: 'width 1s linear',
                }}
              />
            </div>
            <p className="subtitle" style={{ marginTop: 8, fontSize: '0.8rem' }}>
              Refreshes automatically
            </p>
          </>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <ErrorBanner message={startError} />
        <button className="btn btn-primary" type="button" onClick={handleStartWorkout} disabled={startingWorkout}>
          {startingWorkout ? <span className="spinner" /> : 'Start Workout'}
        </button>
      </div>

      <div className="stack" style={{ marginTop: 14 }}>
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/history')}>
          Workout History
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => navigate('/cafeteria')}>
          Cafeteria
        </button>
      </div>
    </div>
  )
}
