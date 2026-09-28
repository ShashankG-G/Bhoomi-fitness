import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function formatWeekday(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
}

function formatDayNum(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function formatFullDate(iso) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function TrainerPlan() {
  const navigate = useNavigate()
  const [days, setDays] = useState(null)
  const [error, setError] = useState(null)
  const [openDate, setOpenDate] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setError(null)
      try {
        const data = await api.personalTrainingPlan()
        if (!cancelled) {
          setDays(Array.isArray(data) ? data : [])
          const today = todayIso()
          const hasToday = Array.isArray(data) && data.some((d) => d.date === today)
          if (!cancelled) setOpenDate(hasToday ? today : null)
        }
      } catch (err) {
        if (!cancelled)
          setError(err instanceof ApiError ? err.message : 'Could not load your trainer plan.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const today = todayIso()

  return (
    <div className="screen">
      <div className="page-header">
        <button className="btn btn-ghost" type="button" onClick={() => navigate('/')}>
          ← Dashboard
        </button>
      </div>

      <h1 className="page-title" style={{ marginBottom: 4 }}>
        My Trainer Plan
      </h1>
      <p className="subtitle" style={{ marginBottom: 16 }}>
        What your trainer has set for the next 30 days.
      </p>

      <ErrorBanner message={error} onRetry={() => window.location.reload()} />

      {!days && !error && <LoadingScreen label="Loading your plan…" />}

      {days && days.length === 0 && (
        <div className="empty-state">You&apos;re not on a personal training plan right now.</div>
      )}

      {days && days.length > 0 && days.every((d) => !d.is_rest_day && !d.title && d.exercises.length === 0) && (
        <div className="empty-state">
          Your trainer hasn&apos;t set any workouts yet. Check back soon, or ask them at your next
          session.
        </div>
      )}

      <div className="stack">
        {days &&
          days.map((d) => {
            const isEmpty = !d.is_rest_day && !d.title && d.exercises.length === 0
            const isOpen = openDate === d.date
            return (
              <div
                key={d.date}
                className="card"
                style={{
                  padding: 0,
                  overflow: 'hidden',
                  borderColor: d.date === today ? 'var(--accent)' : undefined,
                }}
              >
                <button
                  type="button"
                  className="row-between"
                  style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                  onClick={() => setOpenDate(isOpen ? null : d.date)}
                >
                  <div className="row" style={{ gap: 12 }}>
                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                      <div
                        className="subtitle"
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          color: d.date === today ? 'var(--accent)' : undefined,
                        }}
                      >
                        {formatWeekday(d.date)}
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{formatDayNum(d.date)}</div>
                    </div>
                    <div>
                      {d.is_rest_day ? (
                        <p style={{ fontWeight: 600, color: 'var(--text-dim)' }}>Rest day</p>
                      ) : isEmpty ? (
                        <p style={{ fontWeight: 600, color: 'var(--text-faint)' }}>Not planned yet</p>
                      ) : (
                        <>
                          <p style={{ fontWeight: 600 }}>{d.title || 'Workout'}</p>
                          <p className="subtitle" style={{ fontSize: '0.8rem' }}>
                            {d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                  <span style={{ color: 'var(--text-faint)' }}>{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && !d.is_rest_day && !isEmpty && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    {d.notes && (
                      <p className="subtitle" style={{ margin: '12px 0', lineHeight: 1.5 }}>
                        {d.notes}
                      </p>
                    )}
                    <div className="stack" style={{ gap: 8, marginTop: 12 }}>
                      {d.exercises.map((ex, idx) => (
                        <div
                          key={idx}
                          className="row-between"
                          style={{
                            background: 'var(--bg-elevated-2)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '10px 12px',
                          }}
                        >
                          <div>
                            <p style={{ fontWeight: 600 }}>{ex.exercise_name}</p>
                            {ex.notes && (
                              <p className="subtitle" style={{ fontSize: '0.8rem' }}>
                                {ex.notes}
                              </p>
                            )}
                          </div>
                          <p className="subtitle" style={{ whiteSpace: 'nowrap', marginLeft: 8 }}>
                            {ex.sets ? `${ex.sets} × ` : ''}
                            {ex.reps || ''}
                          </p>
                        </div>
                      ))}
                    </div>
                    {d.trainer_name && (
                      <p className="subtitle" style={{ fontSize: '0.75rem', marginTop: 12 }}>
                        Set by {d.trainer_name}
                      </p>
                    )}
                  </div>
                )}

                {isOpen && d.is_rest_day && d.notes && (
                  <div style={{ padding: '0 16px 16px', borderTop: '1px solid var(--border)' }}>
                    <p className="subtitle" style={{ margin: '12px 0', lineHeight: 1.5 }}>
                      {d.notes}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
      </div>
    </div>
  )
}
