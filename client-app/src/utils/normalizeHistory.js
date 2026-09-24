// The exact shape of GET /api/workouts/history isn't pinned down further
// than "sessions grouped by date with sets logged in each" in the spec, so
// this normalizes a few reasonable shapes the backend might send into:
//   [{ date: 'YYYY-MM-DD', sessions: [{ session_id, duration_seconds,
//      total_calories, started_at, sets: [{ exercise_id, exercise_name,
//      set_number, reps, weight_kg, calories_est }] }] }]
export function normalizeHistory(data) {
  if (!data) return []

  // Already grouped by date: [{ date, sessions: [...] }]
  if (Array.isArray(data) && data.length && data[0] && 'date' in data[0] && 'sessions' in data[0]) {
    return data
  }

  // Wrapped: { history: [...] } or { groups: [...] } or { sessions: [...] }
  if (!Array.isArray(data) && typeof data === 'object') {
    if (Array.isArray(data.history)) return normalizeHistory(data.history)
    if (Array.isArray(data.groups)) return normalizeHistory(data.groups)
    if (Array.isArray(data.sessions)) return normalizeHistory(data.sessions)
  }

  // Flat list of sessions — group by date client-side.
  if (Array.isArray(data)) {
    const byDate = new Map()
    for (const session of data) {
      const raw =
        session.date || session.started_at || session.created_at || session.finished_at || null
      const dateKey = raw ? String(raw).slice(0, 10) : 'Unknown date'
      if (!byDate.has(dateKey)) byDate.set(dateKey, [])
      byDate.get(dateKey).push(session)
    }
    return Array.from(byDate.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, sessions]) => ({ date, sessions }))
  }

  return []
}
