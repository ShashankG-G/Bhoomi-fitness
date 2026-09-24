import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ExerciseMedia from '../components/ExerciseMedia.jsx'
import { formatDuration } from '../utils/format.js'
import { useRestTimer } from '../hooks/useRestTimer.js'

const DEFAULT_REST_SECONDS = 60

export default function WorkoutSession() {
  const { sessionId } = useParams()
  const navigate = useNavigate()

  const [library, setLibrary] = useState(null)
  const [libraryError, setLibraryError] = useState(null)
  const [openGroup, setOpenGroup] = useState(null)
  const [openExercise, setOpenExercise] = useState(null)

  // exercise_id -> array of logged sets {set_number, reps, weight_kg, calories_est}
  const [loggedByExercise, setLoggedByExercise] = useState({})
  const [setDraft, setSetDraft] = useState({ reps: '', weight_kg: '', calories_est: '' })
  const [logging, setLogging] = useState(false)
  const [logError, setLogError] = useState(null)

  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState(null)
  const [finished, setFinished] = useState(null)

  const startedAtRef = useRef(Date.now())
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const rest = useRestTimer(DEFAULT_REST_SECONDS)

  useEffect(() => {
    const t = setInterval(() => {
      setElapsedSeconds(Math.round((Date.now() - startedAtRef.current) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLibraryError(null)
      try {
        const data = await api.workoutLibrary()
        if (!cancelled) setLibrary(data)
      } catch (err) {
        if (!cancelled)
          setLibraryError(err instanceof ApiError ? err.message : 'Could not load exercises.')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const groups = useMemo(() => {
    if (!library) return []
    const byGroup = new Map()
    for (const ex of library) {
      const key = ex.muscle_group || 'Other'
      if (!byGroup.has(key)) byGroup.set(key, [])
      byGroup.get(key).push(ex)
    }
    return Array.from(byGroup.entries())
  }, [library])

  const totalCalories = useMemo(() => {
    return Object.values(loggedByExercise)
      .flat()
      .reduce((sum, s) => sum + (Number(s.calories_est) || 0), 0)
  }, [loggedByExercise])

  const totalSets = useMemo(
    () => Object.values(loggedByExercise).flat().length,
    [loggedByExercise]
  )

  function openExerciseForLogging(exercise) {
    setLogError(null)
    setOpenExercise(exercise)
    setSetDraft({
      reps: exercise.default_reps ? String(exercise.default_reps) : '',
      weight_kg: '',
      calories_est: '',
    })
  }

  async function handleLogSet(e) {
    e.preventDefault()
    if (!openExercise) return
    setLogError(null)

    const reps = Number(setDraft.reps)
    if (!reps || reps <= 0) {
      setLogError('Enter how many reps you did.')
      return
    }
    const weight_kg = setDraft.weight_kg === '' ? 0 : Number(setDraft.weight_kg)
    const calories_est = setDraft.calories_est === '' ? 0 : Number(setDraft.calories_est)

    const existing = loggedByExercise[openExercise.id] || []
    const setNumber = existing.length + 1

    setLogging(true)
    try {
      await api.logSet(sessionId, {
        exercise_id: openExercise.id,
        set_number: setNumber,
        reps,
        weight_kg,
        calories_est,
      })
      setLoggedByExercise((prev) => ({
        ...prev,
        [openExercise.id]: [...existing, { set_number: setNumber, reps, weight_kg, calories_est }],
      }))
      setSetDraft({ reps: setDraft.reps, weight_kg: setDraft.weight_kg, calories_est: '' })
      rest.start(DEFAULT_REST_SECONDS)
    } catch (err) {
      setLogError(err instanceof ApiError ? err.message : 'Could not save that set. Try again.')
    } finally {
      setLogging(false)
    }
  }

  async function handleFinish() {
    setFinishError(null)
    setFinishing(true)
    try {
      const summary = {
        duration_seconds: elapsedSeconds,
        total_calories: Math.round(totalCalories),
      }
      await api.finishSession(sessionId, summary)
      setFinished(summary)
    } catch (err) {
      setFinishError(err instanceof ApiError ? err.message : 'Could not finish the workout. Try again.')
    } finally {
      setFinishing(false)
    }
  }

  if (finished) {
    return (
      <div className="screen screen--centered" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2.4rem', marginBottom: 8 }}>💪</div>
        <h1 className="page-title" style={{ marginBottom: 8 }}>
          Workout complete
        </h1>
        <p className="subtitle" style={{ marginBottom: 20 }}>
          {formatDuration(finished.duration_seconds)} · {finished.total_calories} kcal ·{' '}
          {totalSets} sets logged
        </p>
        <div className="stack">
          <button className="btn btn-primary" type="button" onClick={() => navigate('/history')}>
            View History
          </button>
          <button className="btn btn-secondary" type="button" onClick={() => navigate('/')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="content-scroll">
        <div className="screen" style={{ paddingBottom: 140 }}>
          <div className="page-header">
            <button className="btn btn-ghost" type="button" onClick={() => navigate('/')}>
              ← Dashboard
            </button>
          </div>

          <div className="card row-between" style={{ marginBottom: 4 }}>
            <div>
              <p className="section-title" style={{ margin: 0 }}>
                Duration
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{formatDuration(elapsedSeconds)}</p>
            </div>
            <div>
              <p className="section-title" style={{ margin: 0 }}>
                Calories
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{Math.round(totalCalories)} kcal</p>
            </div>
            <div>
              <p className="section-title" style={{ margin: 0 }}>
                Sets
              </p>
              <p style={{ fontSize: '1.2rem', fontWeight: 700 }}>{totalSets}</p>
            </div>
          </div>

          {rest.running && (
            <div className="card" style={{ borderColor: 'var(--accent-dim)', marginTop: 12 }}>
              <div className="row-between">
                <div>
                  <p className="section-title" style={{ margin: 0 }}>
                    Rest
                  </p>
                  <p style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--accent)' }}>
                    {rest.secondsLeft}s
                  </p>
                </div>
                <div className="row">
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => rest.addTime(30)}>
                    +30s
                  </button>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={rest.skip}>
                    Skip
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="section-title">Pick an exercise</p>
          <ErrorBanner message={libraryError} onRetry={() => window.location.reload()} />
          {!library && !libraryError && <LoadingScreen label="Loading exercises…" />}

          {groups.map(([groupName, exercises]) => (
            <div key={groupName} className="card" style={{ marginBottom: 10, padding: 0, overflow: 'hidden' }}>
              <button
                type="button"
                className="row-between"
                style={{
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  padding: '16px 18px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '1rem',
                }}
                onClick={() => setOpenGroup(openGroup === groupName ? null : groupName)}
              >
                <span>{groupName}</span>
                <span style={{ color: 'var(--text-faint)' }}>{openGroup === groupName ? '−' : '+'}</span>
              </button>

              {openGroup === groupName && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {exercises.map((ex) => {
                    const sets = loggedByExercise[ex.id] || []
                    return (
                      <div key={ex.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <button
                          type="button"
                          className="row"
                          style={{
                            width: '100%',
                            background: 'none',
                            border: 'none',
                            color: 'inherit',
                            padding: '14px 18px',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onClick={() =>
                            openExercise?.id === ex.id
                              ? setOpenExercise(null)
                              : openExerciseForLogging(ex)
                          }
                        >
                          <ExerciseMedia url={ex.animation_url} alt={ex.name} size={48} />
                          <div style={{ flex: 1 }}>
                            <p style={{ fontWeight: 600 }}>{ex.name}</p>
                            <p className="subtitle" style={{ fontSize: '0.8rem' }}>
                              {ex.default_sets ? `${ex.default_sets} × ${ex.default_reps} suggested` : ''}
                              {sets.length > 0 ? ` · ${sets.length} logged` : ''}
                            </p>
                          </div>
                        </button>

                        {openExercise?.id === ex.id && (
                          <div style={{ padding: '0 18px 18px' }}>
                            {ex.instructions && (
                              <p className="subtitle" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                                {ex.instructions}
                              </p>
                            )}

                            {sets.length > 0 && (
                              <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
                                {sets.map((s) => (
                                  <span key={s.set_number} className="pill pill--success">
                                    Set {s.set_number}: {s.reps} × {s.weight_kg}kg
                                  </span>
                                ))}
                              </div>
                            )}

                            <ErrorBanner message={logError} />

                            <form onSubmit={handleLogSet}>
                              <div className="row" style={{ gap: 8 }}>
                                <div className="field" style={{ flex: 1, marginBottom: 10 }}>
                                  <label>Reps</label>
                                  <input
                                    className="input"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={setDraft.reps}
                                    onChange={(e) => setSetDraft((d) => ({ ...d, reps: e.target.value }))}
                                  />
                                </div>
                                <div className="field" style={{ flex: 1, marginBottom: 10 }}>
                                  <label>Weight (kg)</label>
                                  <input
                                    className="input"
                                    type="number"
                                    inputMode="decimal"
                                    min="0"
                                    step="0.5"
                                    value={setDraft.weight_kg}
                                    onChange={(e) => setSetDraft((d) => ({ ...d, weight_kg: e.target.value }))}
                                  />
                                </div>
                                <div className="field" style={{ flex: 1, marginBottom: 10 }}>
                                  <label>Calories</label>
                                  <input
                                    className="input"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    value={setDraft.calories_est}
                                    onChange={(e) =>
                                      setSetDraft((d) => ({ ...d, calories_est: e.target.value }))
                                    }
                                  />
                                </div>
                              </div>
                              <button className="btn btn-primary btn-sm" type="submit" disabled={logging}>
                                {logging ? <span className="spinner" /> : `Log set ${sets.length + 1}`}
                              </button>
                            </form>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 20px calc(14px + var(--safe-bottom))',
          background: 'rgba(11,11,13,0.94)',
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid var(--border)',
        }}
      >
        <ErrorBanner message={finishError} />
        <button className="btn btn-primary" type="button" onClick={handleFinish} disabled={finishing}>
          {finishing ? <span className="spinner" /> : 'Finish Workout'}
        </button>
      </div>
    </div>
  )
}
