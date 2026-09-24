import { useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../api/client'
import ErrorBanner from '../components/ErrorBanner.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import { formatInr } from '../utils/format.js'

const POLL_MS = 5000

const STATUS_LABEL = {
  placed: 'Placed',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  completed: 'Completed',
}

export default function Cafeteria() {
  const [tab, setTab] = useState('menu')
  const [menu, setMenu] = useState(null)
  const [menuError, setMenuError] = useState(null)

  const [cart, setCart] = useState({}) // menu_item_id -> qty
  const [notes, setNotes] = useState('')
  const [cartOpen, setCartOpen] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState(null)

  const [orders, setOrders] = useState([])
  const [ordersError, setOrdersError] = useState(null)
  const [ordersLoading, setOrdersLoading] = useState(true)

  const [readyAlert, setReadyAlert] = useState(null)
  const notifiedRef = useRef(new Set())
  const notifAskedRef = useRef(false)

  async function loadMenu() {
    setMenuError(null)
    try {
      const data = await api.cafeteriaMenu()
      setMenu(data)
    } catch (err) {
      setMenuError(err instanceof ApiError ? err.message : 'Could not load the menu.')
    }
  }

  async function loadOrders() {
    setOrdersError(null)
    setOrdersLoading(true)
    try {
      const data = await api.myOrders()
      setOrders(Array.isArray(data) ? data : data?.orders || [])
    } catch (err) {
      setOrdersError(err instanceof ApiError ? err.message : 'Could not load your orders.')
    } finally {
      setOrdersLoading(false)
    }
  }

  useEffect(() => {
    loadMenu()
    loadOrders()
  }, [])

  function fireNotification(orderId) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        // eslint-disable-next-line no-new
        new Notification('Your order is ready! 🍽️', {
          body: `Order #${orderId} is ready for pickup at the counter.`,
        })
      }
    } catch {
      // Notifications unsupported/blocked in this browser — the on-screen
      // alert below still covers it. This app only supports foreground,
      // polling-based alerts, not real push notifications.
    }
  }

  // Poll every open order's status every ~5s until it's completed.
  useEffect(() => {
    const openIds = orders
      .filter((o) => o.status && o.status !== 'completed')
      .map((o) => o.order_id ?? o.id)
      .filter((id) => id !== undefined && id !== null)

    if (openIds.length === 0) return undefined

    const interval = setInterval(async () => {
      for (const id of openIds) {
        try {
          const res = await api.orderStatus(id)
          setOrders((prev) =>
            prev.map((o) => ((o.order_id ?? o.id) === id ? { ...o, status: res.status } : o))
          )
          if (res.status === 'ready' && !notifiedRef.current.has(id)) {
            notifiedRef.current.add(id)
            setReadyAlert({ id })
            fireNotification(id)
          }
        } catch {
          // Transient poll failure — try again on the next tick.
        }
      }
    }, POLL_MS)

    return () => clearInterval(interval)
  }, [orders])

  function requestNotifPermissionOnce() {
    if (notifAskedRef.current) return
    notifAskedRef.current = true
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission()
      }
    } catch {
      // Ignore — the on-screen "ready" alert works regardless of permission.
    }
  }

  const categories = useMemo(() => {
    if (!menu) return []
    const byCat = new Map()
    for (const item of menu) {
      const key = item.category || 'Other'
      if (!byCat.has(key)) byCat.set(key, [])
      byCat.get(key).push(item)
    }
    return Array.from(byCat.entries())
  }, [menu])

  const cartItems = useMemo(() => {
    if (!menu) return []
    return Object.entries(cart)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menu.find((m) => String(m.id) === String(id))
        return item ? { ...item, qty } : null
      })
      .filter(Boolean)
  }, [cart, menu])

  const cartTotal = cartItems.reduce((sum, i) => sum + i.price_inr * i.qty, 0)
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0)

  function setQty(item, qty) {
    setCart((prev) => ({ ...prev, [item.id]: Math.max(0, qty) }))
  }

  async function handlePlaceOrder() {
    // Ask while we still have the click's user-gesture context.
    requestNotifPermissionOnce()
    setPlaceError(null)
    setPlacing(true)
    try {
      const items = cartItems.map((i) => ({ menu_item_id: i.id, qty: i.qty }))
      const res = await api.placeOrder(items, notes.trim() || undefined)
      setCart({})
      setNotes('')
      setCartOpen(false)
      setTab('orders')
      setOrders((prev) => [
        { order_id: res.order_id, status: res.status || 'placed', total_inr: res.total_inr },
        ...prev,
      ])
    } catch (err) {
      setPlaceError(err instanceof ApiError ? err.message : 'Could not place your order. Try again.')
    } finally {
      setPlacing(false)
    }
  }

  return (
    <div className="screen" style={{ paddingBottom: cartCount > 0 && tab === 'menu' ? 110 : 20 }}>
      <div className="page-header">
        <h1 className="page-title">Cafeteria</h1>
      </div>

      {readyAlert && (
        <div className="success-banner row-between">
          <span>Order #{readyAlert.id} is ready for pickup!</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setReadyAlert(null)}>
            Dismiss
          </button>
        </div>
      )}

      <div className="row" style={{ marginBottom: 16 }}>
        <button
          className={tab === 'menu' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          type="button"
          style={{ width: 'auto', flex: 1 }}
          onClick={() => setTab('menu')}
        >
          Menu
        </button>
        <button
          className={tab === 'orders' ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'}
          type="button"
          style={{ width: 'auto', flex: 1 }}
          onClick={() => setTab('orders')}
        >
          My Orders
        </button>
      </div>

      {tab === 'menu' && (
        <>
          <ErrorBanner message={menuError} onRetry={loadMenu} />
          {!menu && !menuError && <LoadingScreen label="Loading menu…" />}
          {categories.map(([cat, items]) => (
            <div key={cat} style={{ marginBottom: 20 }}>
              <p className="section-title">{cat}</p>
              <div className="stack">
                {items.map((item) => (
                  <div key={item.id} className="card row-between">
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 600 }}>{item.name}</p>
                      {item.description && (
                        <p className="subtitle" style={{ fontSize: '0.85rem' }}>
                          {item.description}
                        </p>
                      )}
                      <p style={{ marginTop: 6, fontWeight: 700, color: 'var(--accent)' }}>
                        {formatInr(item.price_inr)}
                      </p>
                      {item.available === false && (
                        <span className="pill" style={{ marginTop: 6 }}>
                          Unavailable
                        </span>
                      )}
                    </div>
                    {item.available !== false && (
                      <QtyStepper qty={cart[item.id] || 0} onChange={(q) => setQty(item, q)} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'orders' && (
        <>
          <ErrorBanner message={ordersError} onRetry={loadOrders} />
          {ordersLoading && orders.length === 0 && <LoadingScreen label="Loading orders…" />}
          {!ordersLoading && orders.length === 0 && !ordersError && (
            <div className="empty-state">No orders yet. Place one from the menu.</div>
          )}
          <div className="stack">
            {orders.map((o) => (
              <div key={o.order_id ?? o.id} className="card row-between">
                <div>
                  <p style={{ fontWeight: 700 }}>Order #{o.order_id ?? o.id}</p>
                  {o.total_inr != null && <p className="subtitle">{formatInr(o.total_inr)}</p>}
                </div>
                <StatusPill status={o.status} />
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'menu' && cartCount > 0 && (
        <div className="cafeteria-cart-bar">
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            {!cartOpen ? (
              <button className="btn btn-primary" type="button" onClick={() => setCartOpen(true)}>
                View cart · {cartCount} item{cartCount > 1 ? 's' : ''} · {formatInr(cartTotal)}
              </button>
            ) : (
              <div className="card" style={{ background: 'var(--bg-elevated-2)' }}>
                <div className="stack" style={{ marginBottom: 12 }}>
                  {cartItems.map((item) => (
                    <div key={item.id} className="row-between">
                      <span>{item.name}</span>
                      <QtyStepper qty={item.qty} onChange={(q) => setQty(item, q)} />
                    </div>
                  ))}
                </div>
                <input
                  className="input"
                  placeholder="Notes for the kitchen (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ marginBottom: 12 }}
                />
                <ErrorBanner message={placeError} />
                <div className="row">
                  <button className="btn btn-secondary" type="button" onClick={() => setCartOpen(false)}>
                    Close
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={handlePlaceOrder}
                    disabled={placing}
                  >
                    {placing ? <span className="spinner" /> : `Place Order · ${formatInr(cartTotal)}`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function QtyStepper({ qty, onChange }) {
  return (
    <div className="row" style={{ gap: 8 }}>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        style={{ width: 40, padding: 0 }}
        onClick={() => onChange(qty - 1)}
        disabled={qty <= 0}
      >
        −
      </button>
      <span style={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{qty}</span>
      <button
        className="btn btn-secondary btn-sm"
        type="button"
        style={{ width: 40, padding: 0 }}
        onClick={() => onChange(qty + 1)}
      >
        +
      </button>
    </div>
  )
}

function StatusPill({ status }) {
  const variant = status === 'ready' ? 'pill--success' : status === 'completed' ? '' : 'pill--warning'
  return <span className={`pill ${variant}`}>{STATUS_LABEL[status] || status || 'Unknown'}</span>
}
