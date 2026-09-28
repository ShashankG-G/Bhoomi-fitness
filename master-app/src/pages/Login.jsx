import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const STEP = { IDENTIFIER: 'identifier', CODE: 'code' }

export default function Login() {
  const { requestCode, verifyCode } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(STEP.IDENTIFIER)
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const codeInputRef = useRef(null)

  useEffect(() => {
    if (step === STEP.CODE) {
      const t = setTimeout(() => codeInputRef.current?.focus(), 50)
      return () => clearTimeout(t)
    }
  }, [step])

  async function handleRequestCode(e) {
    e.preventDefault()
    const trimmed = identifier.trim()
    if (!trimmed) {
      setError('Enter your registered phone number or email.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await requestCode(trimmed)
      setDevCode(res?.dev_code || null)
      setStep(STEP.CODE)
    } catch (err) {
      if (err?.status === 404) {
        setError('No staff account found for this number. Ask the gym owner to add you from the admin panel.')
      } else {
        setError(err?.message || 'Could not send a code. Try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyCode(e) {
    e.preventDefault()
    const trimmedCode = code.trim()
    if (trimmedCode.length !== 5) {
      setError('Enter the 5-digit code.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await verifyCode(identifier.trim(), trimmedCode)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err?.message || 'That code did not work. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-mark" aria-hidden="true">B</div>
        <h1 className="login-title">Bhoomi Fitness</h1>
        <p className="login-subtitle">Staff sign in</p>

        {step === STEP.IDENTIFIER && (
          <form onSubmit={handleRequestCode} className="login-form" noValidate>
            <p className="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
              Enter the phone number the gym owner registered you with.
            </p>
            <label className="field">
              <span className="field-label">Phone or email</span>
              <input
                type="text"
                inputMode="tel"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                placeholder="98765 43210"
                autoFocus
              />
            </label>

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
              {loading ? 'Sending…' : 'Send code'}
            </button>
          </form>
        )}

        {step === STEP.CODE && (
          <form onSubmit={handleVerifyCode} className="login-form" noValidate>
            <p className="subtitle" style={{ textAlign: 'center', marginBottom: 8 }}>
              We sent a 5-digit code to <strong>{identifier}</strong>.
            </p>
            {devCode && (
              <div className="pill pill--accent" style={{ alignSelf: 'center' }}>
                Dev code: {devCode}
              </div>
            )}
            <label className="field">
              <span className="field-label">5-digit code</span>
              <input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                disabled={loading}
                placeholder="•••••"
              />
            </label>

            {error && (
              <div className="alert alert-error" role="alert">
                {error}
              </div>
            )}

            <button type="submit" className="btn btn-primary btn-large" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify & sign in'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep(STEP.IDENTIFIER)
                setCode('')
                setError('')
              }}
              disabled={loading}
            >
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
