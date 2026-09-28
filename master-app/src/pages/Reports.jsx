import { useState } from 'react'
import { downloadReport, ApiError } from '../api/client.js'
import { useAuth } from '../auth/AuthContext.jsx'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

export default function Reports() {
  const { isSuperAdmin } = useAuth()

  return (
    <div className="screen">
      <h2 className="section-title" style={{ marginTop: 0 }}>Reports</h2>
      <AttendanceReport />
      {isSuperAdmin && <FinancialReport />}
    </div>
  )
}

function AttendanceReport() {
  const [date, setDate] = useState(todayIso())
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    setDownloading(true)
    setError('')
    try {
      await downloadReport(`/api/staff/reports/attendance?date=${date}`, `attendance-${date}.csv`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the report. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="member-detail-card">
      <div className="member-detail-name">Attendance report</div>
      <div className="member-detail-meta">
        Everyone who checked in on the chosen day — name, phone/email, and time of entry.
      </div>

      <label className="field" style={{ marginTop: '0.5rem' }}>
        <span className="field-label">Date</span>
        <input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} />
      </label>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Preparing…' : 'Download CSV'}
      </button>
    </div>
  )
}

function FinancialReport() {
  const [start, setStart] = useState(firstOfMonthIso())
  const [end, setEnd] = useState(todayIso())
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState('')

  async function handleDownload() {
    if (start > end) {
      setError('Start date must be before the end date.')
      return
    }
    setDownloading(true)
    setError('')
    try {
      await downloadReport(
        `/api/staff/reports/financial?start=${start}&end=${end}`,
        `financial-report-${start}_${end}.csv`
      )
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the report. Try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="member-detail-card">
      <div className="member-detail-name">Financial &amp; overall report</div>
      <div className="member-detail-meta">
        Every membership and cafeteria transaction in the range, plus a revenue and membership summary.
        Owner / Head Trainer only.
      </div>

      <div className="chip-row" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field-label">From</span>
          <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span className="field-label">To</span>
          <input type="date" value={end} max={todayIso()} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <button type="button" className="btn btn-primary" onClick={handleDownload} disabled={downloading}>
        {downloading ? 'Preparing…' : 'Download CSV'}
      </button>
    </div>
  )
}
