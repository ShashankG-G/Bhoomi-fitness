import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import ErrorBanner from '../components/ErrorBanner.jsx'
import LoadingScreen from '../components/LoadingScreen.jsx'

const STEP = { IDENTIFIER: 'identifier', CODE: 'code', NAME: 'name' }

export default function Login() {
  const { isAuthenticated, initializing, member, login, updateName, authError, clearAuthError } =
    useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [step, setStep] = useState(STEP.IDENTIFIER)
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const codeInputRef = useRef(null)

  useEffect(() => {
    if (step === STEP.CODE) {
      // Give the browser a beat to mount the field before focusing.
      const t = setTimeout(() => codeInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [step])

  if (initializing) return <LoadingScreen label="Checking your session…" />

  // Already fully logged in with a name set — bounce away from /login.
  if (isAuthenticated && member?.name) {
    const from = location.state?.from?.pathname || '/'
    return <Navigate to={from} replace />
  }

  async function handleRequestCode(e) {
    e.preventDefault()
    setError(null)
    clearAuthError()
    const trimmed = identifier.trim()
    if (!trimmed) {
      setError('Enter your email or phone number.')
      return
    }
    setLoading(true)
    try {
      const res = await api.requestCode(trimmed)
      setDevCode(res?.dev_code || null)
      setStep(STEP.CODE)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a code. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    setError(null)
    const trimmedCode = code.trim()
    if (trimmedCode.length !== 5) {
      setError('Enter the 5-digit code.')
      return
    }
    setLoading(true)
    try {
      const res = await api.verifyCode(identifier.trim(), trimmedCode)
      login(res.access_token, res.member)
      if (!res.member?.name) {
        setStep(STEP.NAME)
      } else {
        const from = location.state?.from?.pathname || '/'
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code did not work. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveName(e) {
    e.preventDefault()
    setError(null)
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Enter a name so staff can recognize you.')
      return
    }
    setLoading(true)
    try {
      await updateName(trimmed)
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your name. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="screen screen--centered">
      <div className="brand-mark">
        <span className="brand-mark__ring">B</span>
        <span className="brand-mark__text">BHOOMI FITNESS</span>
      </div>

      <ErrorBanner message={authError} />
      <ErrorBanner message={error} />

      {step === STEP.IDENTIFIER && (
        <form onSubmit={handleRequestCode} className="stack" style={{ marginTop: 12 }}>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
            Enter your email or phone number to sign in or create your account.
          </p>
          <div className="field">
            <label htmlFor="identifier">Email or phone</label>
            <input
              id="identifier"
              className="input"
              type="text"
              inputMode="email"
              autoComplete="username"
              placeholder="you@example.com or 98765 43210"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Send code'}
          </button>
        </form>
      )}

      {step === STEP.CODE && (
        <form onSubmit={handleVerifyCode} className="stack" style={{ marginTop: 12 }}>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
            We sent a 5-digit code to <strong style={{ color: 'var(--text)' }}>{identifier}</strong>.
          </p>
          {devCode && (
            <div className="pill pill--accent" style={{ alignSelf: 'center' }}>
              Dev code: {devCode}
            </div>
          )}
          <div className="field">
            <label htmlFor="code">5-digit code</label>
            <input
              id="code"
              ref={codeInputRef}
              className="input code-input"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              autoComplete="one-time-code"
              placeholder="•••••"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Verify & continue'}
          </button>
          <button
            className="btn btn-ghost"
            type="button"
            style={{ alignSelf: 'center' }}
            onClick={() => {
              setStep(STEP.IDENTIFIER)
              setCode('')
              setError(null)
            }}
            disabled={loading}
          >
            Use a different email or phone
          </button>
        </form>
      )}

      {step === STEP.NAME && (
        <form onSubmit={handleSaveName} className="stack" style={{ marginTop: 12 }}>
          <p className="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
            Welcome! What should we call you?
          </p>
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              className="input"
              type="text"
              autoComplete="name"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Continue'}
          </button>
        </form>
      )}
    </div>
  )
}
