import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client.js'

const POLL_MS = 7000

const STATUS_TABS = [
  { value: 'placed', label: 'Placed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'completed', label: 'Completed' },
]

const NEXT_STATUS = {
  placed: 'preparing',
  preparing: 'ready',
  ready: 'completed',
}

const NEXT_LABEL = {
  placed: 'Start preparing',
  preparing: 'Mark ready',
  ready: 'Mark completed',
}

function itemLabel(item) {
  const name = item.name || item.menu_item_name || item.item_name || `Item #${item.menu_item_id ?? ''}`
  const qty = item.qty ?? item.quantity ?? 1
  return `${qty} × ${name}`
}

function formatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function Cafeteria() {
  const [status, setStatus] = useState('placed')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const pollRef = useRef(null)
  const statusRef = useRef(status)
  statusRef.current = status

  const load = useCallback(async (silent) => {
    if (!silent) setLoading(true)
    try {
      const data = await api.get(
        `/api/staff/cafeteria/orders?status=${encodeURIComponent(statusRef.current)}`
      )
      setOrders(Array.isArray(data) ? data : data?.orders || [])
      setError('')
    } catch (err) {
      setError(err?.message || 'Could not load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(false)
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(() => load(true), POLL_MS)
    return () => clearInterval(pollRef.current)
  }, [status, load])

  async function advance(order) {
    const next = NEXT_STATUS[order.status]
    if (!next) return
    setUpdatingId(order.id)
    try {
      await api.patch(`/api/staff/cafeteria/orders/${order.id}`, { status: next })
      // Optimistically drop it from the current tab (it now belongs elsewhere)
      // and refresh from the server to stay in sync.
      setOrders((prev) => prev.filter((o) => o.id !== order.id))
      load(true)
    } catch (err) {
      setError(err?.message || 'Could not update the order. Try again.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="screen cafeteria-screen">
      <div className="scanner-tabs">
        {STATUS_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            className={'chip' + (status === t.value ? ' chip-active' : '')}
            onClick={() => setStatus(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {loading ? (
        <p className="hint">Loading orders…</p>
      ) : orders.length === 0 ? (
        <p className="hint">No {status} orders right now.</p>
      ) : (
        <ul className="order-list">
          {orders.map((order) => (
            <li key={order.id} className="order-card">
              <div className="order-card-header">
                <span className="order-id">Order #{order.id}</span>
                {order.created_at && (
                  <span className="order-time">{formatTime(order.created_at)}</span>
                )}
              </div>

              <ul className="order-items">
                {(order.items || []).map((item, i) => (
                  <li key={i}>{itemLabel(item)}</li>
                ))}
              </ul>

              {order.notes && <div className="order-notes">Note: {order.notes}</div>}

              {typeof order.total_inr === 'number' && (
                <div className="order-total">₹{order.total_inr}</div>
              )}

              {NEXT_STATUS[order.status] && (
                <button
                  type="button"
                  className={
                    'btn btn-large ' +
                    (order.status === 'preparing' ? 'btn-ready' : 'btn-primary')
                  }
                  disabled={updatingId === order.id}
                  onClick={() => advance(order)}
                >
                  {updatingId === order.id ? 'Updating…' : NEXT_LABEL[order.status]}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
