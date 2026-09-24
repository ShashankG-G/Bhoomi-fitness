import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import MembershipGate from './MembershipGate.jsx'
import Dashboard from './Dashboard.jsx'

export default function Home() {
  const { member, refreshMe } = useAuth()
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      setChecking(true)
      setError(null)
      try {
        await refreshMe()
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (checking && !member) return <LoadingScreen label="Loading your account…" />

  if (error && !member) {
    return (
      <div className="screen screen--centered">
        <ErrorBanner
          message={error}
          onRetry={() => {
            setChecking(true)
            refreshMe()
              .catch((err) => setError(err.message))
              .finally(() => setChecking(false))
          }}
        />
      </div>
    )
  }

  if (!member) return <LoadingScreen />

  return member.has_active_membership ? <Dashboard /> : <MembershipGate member={member} />
}
