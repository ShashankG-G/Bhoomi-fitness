import { useEffect, useRef, useState } from 'react'
import { api, ApiError } from '../api/client.js'

function memberName(m) {
  return m?.name || m?.identifier || 'Member'
}

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
    year: 'numeric',
  })
}

export default function PersonalTrainer() {
  const [ptMembers, setPtMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef(null)

  async function loadPtMembers() {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/api/staff/personal-training/members')
      setPtMembers(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load personal training members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPtMembers()
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setSearchResults([])
      return undefined
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await api.get(`/api/staff/members?query=${encodeURIComponent(trimmed)}`)
        setSearchResults(Array.isArray(data) ? data : [])
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function addToPt(member) {
    setError('')
    try {
      const updated = await api.patch(`/api/staff/members/${member.id}/personal-training`, {
        is_personal_training: true,
      })
      setQuery('')
      setSearchResults([])
      await loadPtMembers()
      setSelected(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add member to Personal Training.')
    }
  }

  if (selected) {
    return (
      <PlanEditor
        member={selected}
        onBack={() => {
          setSelected(null)
          loadPtMembers()
        }}
        onRemoved={() => {
          setSelected(null)
          loadPtMembers()
        }}
      />
    )
  }

  const addableResults = searchResults.filter((m) => !m.is_personal_training)

  return (
    <div className="screen">
      <h2 className="section-title" style={{ marginTop: 0 }}>
        Personal Trainer
      </h2>
      <p className="hint">
        Members on a personal-training plan — tap one to set their workouts for the next month, day by day.
      </p>

      <label className="field">
        <span className="field-label">Add a member to Personal Training</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by phone, email, or name"
          autoCapitalize="none"
          autoCorrect="off"
        />
      </label>
      {searching && <p className="hint">Searching…</p>}
      {addableResults.length > 0 && (
        <ul className="member-list">
          {addableResults.map((m) => (
            <li key={m.id}>
              <button type="button" className="member-row" onClick={() => addToPt(m)}>
                <div className="member-row-main">
                  <span className="member-row-name">{memberName(m)}</span>
                  <span className="member-row-identifier">{m.identifier}</span>
                </div>
                <span className="chip">+ Add</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <h3 className="section-title">On personal training ({ptMembers.length})</h3>
      {loading && <p className="hint">Loading…</p>}
      {!loading && ptMembers.length === 0 && (
        <p className="hint">No members on personal training yet. Add one above.</p>
      )}
      <ul className="member-list">
        {ptMembers.map((m) => (
          <li key={m.id}>
            <button type="button" className="member-row" onClick={() => setSelected(m)}>
              <div className="member-row-main">
                <span className="member-row-name">{memberName(m)}</span>
                <span className="member-row-identifier">{m.identifier}</span>
              </div>
              <span className={'badge ' + (m.days_planned_next_30 > 0 ? 'badge-active' : 'badge-inactive')}>
                {m.days_planned_next_30 > 0 ? `${m.days_planned_next_30} days planned` : 'No plan yet'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function PlanEditor({ member, onBack, onRemoved }) {
  const [days, setDays] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingDate, setEditingDate] = useState(null)
  const [removing, setRemoving] = useState(false)
  const today = todayIso()

  async function loadPlan() {
    setLoading(true)
    setError('')
    try {
      const data = await api.get(`/api/staff/personal-training/members/${member.id}/plan`)
      setDays(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load the plan.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPlan()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member.id])

  async function handleRemove() {
    setRemoving(true)
    setError('')
    try {
      await api.patch(`/api/staff/members/${member.id}/personal-training`, { is_personal_training: false })
      onRemoved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not remove this member.')
      setRemoving(false)
    }
  }

  if (editingDate) {
    const day = days.find((d) => d.date === editingDate) || { date: editingDate, is_rest_day: false, exercises: [] }
    return (
      <DayEditor
        member={member}
        day={day}
        onBack={() => setEditingDate(null)}
        onSaved={(updatedDay) => {
          setDays((prev) => prev.map((d) => (d.date === updatedDay.date ? updatedDay : d)))
          setEditingDate(null)
        }}
      />
    )
  }

  return (
    <div className="activation-panel">
      <button type="button" className="btn btn-ghost btn-small back-btn" onClick={onBack}>
        ← Back to Personal Trainer
      </button>

      <div className="member-detail-card">
        <div className="member-detail-name">{memberName(member)}</div>
        <div className="member-detail-identifier">{member.identifier}</div>
        {member.membership_plan && (
          <div className="member-detail-meta">
            {member.membership_plan}
            {member.membership_valid_until ? ` — valid until ${member.membership_valid_until}` : ''}
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <h3 className="section-title" style={{ marginTop: 0 }}>
        Next 30 days
      </h3>
      {loading && <p className="hint">Loading plan…</p>}

      <ul className="pt-day-list">
        {days.map((d) => (
          <li key={d.date}>
            <button
              type="button"
              className={'pt-day-row' + (d.date === today ? ' pt-day-row--today' : '')}
              onClick={() => setEditingDate(d.date)}
            >
              <div className="pt-day-date">
                <span className="pt-day-weekday">{formatWeekday(d.date)}</span>
                <span className="pt-day-daynum">{formatDayNum(d.date)}</span>
              </div>
              <div className="pt-day-main">
                {d.is_rest_day ? (
                  <span className="pt-day-title pt-day-title--rest">Rest day</span>
                ) : d.title || d.exercises.length > 0 ? (
                  <>
                    <span className="pt-day-title">{d.title || 'Workout'}</span>
                    <span className="pt-day-sub">
                      {d.exercises.length} exercise{d.exercises.length === 1 ? '' : 's'}
                    </span>
                  </>
                ) : (
                  <span className="pt-day-title pt-day-title--empty">Not planned</span>
                )}
              </div>
              <span className="pt-day-chevron" aria-hidden="true">
                ›
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button type="button" className="btn btn-danger" onClick={handleRemove} disabled={removing}>
        {removing ? 'Removing…' : 'Remove from Personal Training'}
      </button>
    </div>
  )
}

function emptyExerciseRow() {
  return { exercise_name: '', sets: '', reps: '', notes: '' }
}

function DayEditor({ member, day, onBack, onSaved }) {
  const [isRestDay, setIsRestDay] = useState(day.is_rest_day)
  const [title, setTitle] = useState(day.title || '')
  const [notes, setNotes] = useState(day.notes || '')
  const [exercises, setExercises] = useState(
    day.exercises && day.exercises.length > 0
      ? day.exercises.map((e) => ({
          exercise_name: e.exercise_name,
          sets: e.sets ?? '',
          reps: e.reps || '',
          notes: e.notes || '',
        }))
      : [emptyExerciseRow()]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateExercise(idx, field, value) {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)))
  }

  function addExercise() {
    setExercises((prev) => [...prev, emptyExerciseRow()])
  }

  function removeExercise(idx) {
    setExercises((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setError('')
    const cleanExercises = exercises
      .map((ex) => ({ ...ex, exercise_name: ex.exercise_name.trim() }))
      .filter((ex) => ex.exercise_name)

    if (!isRestDay && cleanExercises.length === 0) {
      setError('Add at least one exercise, or mark this a rest day.')
      return
    }

    setSaving(true)
    try {
      const body = {
        is_rest_day: isRestDay,
        title: title.trim() || null,
        notes: notes.trim() || null,
        exercises: isRestDay
          ? []
          : cleanExercises.map((ex) => ({
              exercise_name: ex.exercise_name,
              sets: ex.sets === '' ? null : Number(ex.sets),
              reps: ex.reps.trim() || null,
              notes: ex.notes.trim() || null,
            })),
      }
      const saved = await api.put(`/api/staff/personal-training/members/${member.id}/days/${day.date}`, body)
      onSaved(saved)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save this day. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="activation-panel">
      <button type="button" className="btn btn-ghost btn-small back-btn" onClick={onBack}>
        ← Back to plan
      </button>

      <div className="member-detail-card">
        <div className="member-detail-name">{formatFullDate(day.date)}</div>
        <div className="member-detail-meta">{memberName(member)}</div>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <div className="chip-row">
        <button
          type="button"
          className={'chip' + (!isRestDay ? ' chip-active' : '')}
          onClick={() => setIsRestDay(false)}
        >
          Workout day
        </button>
        <button
          type="button"
          className={'chip' + (isRestDay ? ' chip-active' : '')}
          onClick={() => setIsRestDay(true)}
        >
          Rest day
        </button>
      </div>

      {!isRestDay && (
        <>
          <label className="field">
            <span className="field-label">Workout title (optional)</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Push Day, Legs & Core"
            />
          </label>

          <div className="pt-exercise-list">
            {exercises.map((ex, idx) => (
              <div className="pt-exercise-row" key={idx}>
                <div className="pt-exercise-row-top">
                  <input
                    type="text"
                    value={ex.exercise_name}
                    onChange={(e) => updateExercise(idx, 'exercise_name', e.target.value)}
                    placeholder="Exercise name"
                  />
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => removeExercise(idx)}
                    aria-label="Remove exercise"
                  >
                    ✕
                  </button>
                </div>
                <div className="pt-exercise-row-meta">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={ex.sets}
                    onChange={(e) => updateExercise(idx, 'sets', e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="Sets"
                  />
                  <input
                    type="text"
                    value={ex.reps}
                    onChange={(e) => updateExercise(idx, 'reps', e.target.value)}
                    placeholder="Reps (e.g. 8-10)"
                  />
                </div>
                <input
                  type="text"
                  value={ex.notes}
                  onChange={(e) => updateExercise(idx, 'notes', e.target.value)}
                  placeholder="Notes for this exercise (optional)"
                />
              </div>
            ))}
          </div>

          <button type="button" className="btn btn-secondary" onClick={addExercise}>
            + Add exercise
          </button>
        </>
      )}

      <label className="field">
        <span className="field-label">Notes for this day (optional)</span>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Client has a knee niggle, avoid lunges"
        />
      </label>

      <button type="button" className="btn btn-primary btn-large" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save day'}
      </button>
    </div>
  )
}
