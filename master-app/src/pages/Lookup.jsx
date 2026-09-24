import { useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const PLAN_PRESETS = ['Monthly', 'Quarterly', 'Annual']

function memberName(m) {
  return m?.name || m?.identifier || m?.phone || m?.email || 'Member'
}

function memberIdentifier(m) {
  return m?.identifier || m?.phone || m?.email || ''
}

function memberValidUntil(m) {
  return m?.valid_until || m?.membership_valid_until || m?.membership_expires_at || null
}

function formatDate(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function defaultValidUntil() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().slice(0, 10)
}

export default function Lookup() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef(null)
  const requestIdRef = useRef(0)

  const [selected, setSelected] = useState(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      setSearched(false)
      setError('')
      return undefined
    }
    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current
      setLoading(true)
      setError('')
      try {
        const data = await api.get(`/api/staff/members?query=${encodeURIComponent(trimmed)}`)
        if (requestId !== requestIdRef.current) return
        setResults(Array.isArray(data) ? data : data?.members || [])
        setSearched(true)
      } catch (err) {
        if (requestId !== requestIdRef.current) return
        setError(err?.message || 'Search failed. Try again.')
        setResults([])
      } finally {
        if (requestId === requestIdRef.current) setLoading(false)
      }
    }, 350)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  return (
    <div className="screen lookup-screen">
      {!selected ? (
        <>
          <label className="field">
            <span className="field-label">Search members</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Phone, email, or name"
              autoCapitalize="none"
              autoCorrect="off"
            />
          </label>

          {loading && <p className="hint">Searching…</p>}
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          {!loading && searched && results.length === 0 && !error && (
            <p className="hint">No members found for "{query.trim()}".</p>
          )}

          <ul className="member-list">
            {results.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="member-row"
                  onClick={() => setSelected(m)}
                >
                  <div className="member-row-main">
                    <span className="member-row-name">{memberName(m)}</span>
                    <span className="member-row-identifier">{memberIdentifier(m)}</span>
                  </div>
                  <span
                    className={
                      'badge ' + (m.has_active_membership ? 'badge-active' : 'badge-inactive')
                    }
                  >
                    {m.has_active_membership ? 'Active' : 'Inactive'}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ActivationPanel
          member={selected}
          onBack={() => setSelected(null)}
          onActivated={(updated) => {
            setSelected(updated)
            setResults((prev) =>
              prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r))
            )
          }}
        />
      )}
    </div>
  )
}

function ActivationPanel({ member, onBack, onActivated }) {
  const [plan, setPlan] = useState(PLAN_PRESETS[0])
  const [customPlan, setCustomPlan] = useState('')
  const [useCustomPlan, setUseCustomPlan] = useState(false)
  const [validUntil, setValidUntil] = useState(defaultValidUntil())
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    const finalPlan = useCustomPlan ? customPlan.trim() : plan
    if (!finalPlan) {
      setError('Choose or enter a plan.')
      return
    }
    if (!validUntil) {
      setError('Pick a valid-until date.')
      return
    }
    setSubmitting(true)
    setError('')
    setSuccess(false)
    try {
      await api.post(`/api/staff/members/${member.id}/activate-membership`, {
        plan: finalPlan,
        valid_until: validUntil,
        payment_method: paymentMethod,
      })
      setSuccess(true)
      onActivated({
        ...member,
        has_active_membership: true,
        valid_until: validUntil,
      })
    } catch (err) {
      setError(err?.message || 'Could not activate membership. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const currentValidUntil = formatDate(memberValidUntil(member))

  return (
    <div className="activation-panel">
      <button type="button" className="btn btn-ghost btn-small back-btn" onClick={onBack}>
        ← Back to search
      </button>

      <div className="member-detail-card">
        <div className="member-detail-name">{memberName(member)}</div>
        <div className="member-detail-identifier">{memberIdentifier(member)}</div>
        <span
          className={
            'badge ' + (member.has_active_membership ? 'badge-active' : 'badge-inactive')
          }
        >
          {member.has_active_membership ? 'Active membership' : 'No active membership'}
        </span>
        {currentValidUntil && (
          <div className="member-detail-meta">Valid until {currentValidUntil}</div>
        )}
      </div>

      <h2 className="section-title">Activate / renew membership</h2>

      {success && (
        <div className="alert alert-success" role="status">
          Membership activated through {formatDate(validUntil)}.
        </div>
      )}
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      <form className="activation-form" onSubmit={handleSubmit}>
        <div className="field">
          <span className="field-label">Plan</span>
          <div className="chip-row">
            {PLAN_PRESETS.map((p) => (
              <button
                type="button"
                key={p}
                className={
                  'chip' + (!useCustomPlan && plan === p ? ' chip-active' : '')
                }
                onClick={() => {
                  setUseCustomPlan(false)
                  setPlan(p)
                }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              className={'chip' + (useCustomPlan ? ' chip-active' : '')}
              onClick={() => setUseCustomPlan(true)}
            >
              Other
            </button>
          </div>
          {useCustomPlan && (
            <input
              type="text"
              value={customPlan}
              onChange={(e) => setCustomPlan(e.target.value)}
              placeholder="e.g. 6-month student plan"
              style={{ marginTop: '0.5rem' }}
            />
          )}
        </div>

        <label className="field">
          <span className="field-label">Valid until</span>
          <input
            type="date"
            value={validUntil}
            min={todayIso()}
            onChange={(e) => setValidUntil(e.target.value)}
          />
        </label>

        <div className="field">
          <span className="field-label">Payment method</span>
          <div className="radio-row">
            <label className="radio-option">
              <input
                type="radio"
                name="payment_method"
                value="cash"
                checked={paymentMethod === 'cash'}
                onChange={() => setPaymentMethod('cash')}
              />
              Cash
            </label>
            <label className="radio-option">
              <input
                type="radio"
                name="payment_method"
                value="online"
                checked={paymentMethod === 'online'}
                onChange={() => setPaymentMethod('online')}
              />
              Online
            </label>
          </div>
        </div>

        <button type="submit" className="btn btn-primary btn-large" disabled={submitting}>
          {submitting ? 'Activating…' : 'Activate membership'}
        </button>
      </form>
    </div>
  )
}
