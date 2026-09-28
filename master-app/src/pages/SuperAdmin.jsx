import { useCallback, useEffect, useState } from 'react'
import { api } from '../api/client.js'

const ROLE_LABELS = {
  reception: 'Reception',
  trainer: 'Trainer',
  head_trainer: 'Head Trainer',
  owner: 'Owner',
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonthIso() {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function formatMoney(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatDateTime(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function SuperAdmin() {
  const [start, setStart] = useState(firstOfMonthIso())
  const [end, setEnd] = useState(todayIso())

  const [staffList, setStaffList] = useState([])
  const [summary, setSummary] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [staffRes, summaryRes, txRes] = await Promise.all([
        api.get('/api/staff/super-admin/staff'),
        api.get(`/api/staff/super-admin/financial-summary?start=${start}&end=${end}`),
        api.get(`/api/staff/super-admin/transactions?start=${start}&end=${end}`),
      ])
      setStaffList(staffRes || [])
      setSummary(summaryRes || null)
      setTransactions(txRes || [])
    } catch (err) {
      setError(err?.message || 'Could not load Super Admin data. Try again.')
    } finally {
      setLoading(false)
    }
  }, [start, end])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="screen">
      <h2 className="section-title" style={{ marginTop: 0 }}>Super Admin</h2>
      <p className="hint">All staff and every financial transaction — memberships and cafeteria.</p>

      <div className="chip-row" style={{ gap: '0.75rem' }}>
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
      {loading && <p className="hint">Loading…</p>}

      {!loading && summary && (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-value">{formatMoney(summary.total_revenue_inr)}</span>
            <span className="stat-label">Total revenue</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{formatMoney(summary.membership_revenue_inr)}</span>
            <span className="stat-label">Membership revenue ({summary.membership_transaction_count})</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{formatMoney(summary.cafeteria_revenue_inr)}</span>
            <span className="stat-label">Cafeteria revenue ({summary.cafeteria_order_count})</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.active_members} / {summary.total_members}</span>
            <span className="stat-label">Active / total members</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{summary.entries_in_range}</span>
            <span className="stat-label">Gym entries in range</span>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <h3 className="section-title">Staff roster</h3>
          <ul className="member-list">
            {staffList.map((s) => (
              <li key={s.id} className="member-row" style={{ cursor: 'default' }}>
                <div className="member-row-main">
                  <span className="member-row-name">{s.name || s.identifier || 'Unnamed'}</span>
                  <span className="member-row-identifier">{s.identifier || '—'}</span>
                </div>
                <span className={'badge ' + (s.active ? 'badge-active' : 'badge-inactive')}>
                  {ROLE_LABELS[s.role] || s.role}
                  {!s.active ? ' · disabled' : ''}
                </span>
              </li>
            ))}
            {staffList.length === 0 && <li className="hint">No staff accounts yet.</li>}
          </ul>

          <h3 className="section-title">Transactions</h3>
          <ul className="order-list">
            {transactions.map((t) => (
              <li key={t.id} className="order-card">
                <div className="order-card-header">
                  <span className="order-id">{t.description}</span>
                  <span className="order-time">{formatDateTime(t.created_at)}</span>
                </div>
                <div className="hint">
                  {t.member_name || t.member_identifier || 'Walk-in'}
                  {t.payment_method ? ` · ${t.payment_method}` : ''}
                  {t.recorded_by ? ` · recorded by ${t.recorded_by}` : ''}
                </div>
                <div className="order-total">{formatMoney(t.amount_inr)}</div>
              </li>
            ))}
            {transactions.length === 0 && <li className="hint">No transactions in this range.</li>}
          </ul>
        </>
      )}
    </div>
  )
}
