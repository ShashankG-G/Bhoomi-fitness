import { useAuth } from '../context/AuthContext.jsx'

export default function MembershipGate({ member }) {
  const { logout } = useAuth()

  return (
    <div className="screen screen--centered" style={{ textAlign: 'center' }}>
      <div className="brand-mark">
        <span className="brand-mark__ring">B</span>
      </div>
      <div style={{ margin: '12px 0 20px' }}>
        <div
          style={{
            width: 64,
            height: 64,
            margin: '0 auto 20px',
            borderRadius: '50%',
            border: '2px solid var(--accent-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.8rem',
          }}
        >
          🔑
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: 10 }}>
          Almost there, {member?.name || 'friend'}.
        </h1>
        <p className="subtitle">
          Your membership isn&apos;t active yet. Swing by the front desk at Bhoomi Fitness,
          Kengeri to get set up — cash or online, whatever&apos;s easiest — and your workouts,
          entry QR and cafeteria ordering will unlock right away.
        </p>
      </div>

      <div className="card" style={{ textAlign: 'left', marginBottom: 20 }}>
        <p style={{ fontWeight: 600, marginBottom: 6 }}>Bhoomi Fitness</p>
        <p className="subtitle">Kengeri, Bengaluru, Karnataka</p>
      </div>

      <button className="btn btn-secondary" type="button" onClick={logout}>
        Log out
      </button>
    </div>
  )
}
