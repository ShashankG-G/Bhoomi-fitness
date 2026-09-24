import { useEffect, useState } from 'react'
import { api, ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import { formatDateHeading, formatDuration } from '../utils/format.js'
import { normalizeHistory } from '../utils/normalizeHistory.js'

export default function History() {
  const [groups, setGroups] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await api.workoutHistory(2)
      setGroups(normalizeHistory(data))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your workout history.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="screen">
      <div className="page-header">
        <h1 className="page-title">Workout History</h1>
      </div>

      <ErrorBanner message={error} onRetry={load} />

      {loading && !groups && <LoadingScreen label="Loading history…" />}

      {groups && groups.length === 0 && !loading && (
        <div className="empty-state">
          No workouts logged in the last 2 months yet. Start one from the dashboard to see it here.
        </div>
      )}

      {groups?.map((group) => (
        <div key={group.date} style={{ marginBottom: 20 }}>
          <p className="section-title">{formatDateHeading(group.date)}</p>
          <div className="stack">
            {group.sessions.map((session, idx) => (
              <SessionCard key={session.session_id || session.id || idx} session={session} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function SessionCard({ session }) {
  const sets = session.sets || []
  const bySet = groupSetsByExercise(sets)

  return (
    <div className="card">
      <div className="row-between" style={{ marginBottom: sets.length ? 10 : 0 }}>
        <p style={{ fontWeight: 700 }}>
          {session.duration_seconds != null ? formatDuration(session.duration_seconds) : 'Workout'}
        </p>
        {session.total_calories != null && (
          <span className="pill pill--accent">{session.total_calories} kcal</span>
        )}
      </div>

      {bySet.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          {bySet.map(([name, exerciseSets]) => (
            <div key={name} className="row-between" style={{ fontSize: '0.9rem' }}>
              <span className="subtitle">{name}</span>
              <span>
                {exerciseSets
                  .map((s) => `${s.reps}${s.weight_kg ? `×${s.weight_kg}kg` : ''}`)
                  .join(', ')}
              </span>
            </div>
          ))}
        </div>
      )}

      {sets.length === 0 && <p className="subtitle">No sets recorded.</p>}
    </div>
  )
}

function groupSetsByExercise(sets) {
  const byExercise = new Map()
  for (const s of sets) {
    const name = s.exercise_name || s.exercise?.name || s.exercise_id || 'Exercise'
    if (!byExercise.has(name)) byExercise.set(name, [])
    byExercise.get(name).push(s)
  }
  return Array.from(byExercise.entries())
}
