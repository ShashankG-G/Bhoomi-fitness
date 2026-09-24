import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { api } from '../api/client.js'
import ResultFlash from '../components/ResultFlash.jsx'

const READER_ELEMENT_ID = 'qr-reader'
const RESULT_DISPLAY_MS = 2000

export default function Scanner() {
  const [mode, setMode] = useState('camera') // 'camera' | 'manual'
  const [cameraState, setCameraState] = useState('starting') // starting | running | denied | error
  const [cameraError, setCameraError] = useState('')
  const [result, setResult] = useState(null)
  const [verifying, setVerifying] = useState(false)
  const [banner, setBanner] = useState('')

  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')

  const scannerRef = useRef(null)
  const busyRef = useRef(false) // gates duplicate/rapid decodes while a result is showing
  const mountedRef = useRef(true)

  const verify = useCallback(async (body) => {
    setVerifying(true)
    setBanner('')
    try {
      const data = await api.post('/api/entry/verify', body)
      if (!mountedRef.current) return
      setResult(data)
      setTimeout(() => {
        if (!mountedRef.current) return
        setResult(null)
        busyRef.current = false
      }, RESULT_DISPLAY_MS)
    } catch (err) {
      busyRef.current = false
      if (mountedRef.current) {
        setBanner(err?.message || 'Verification failed. Try again.')
      }
    } finally {
      if (mountedRef.current) setVerifying(false)
    }
  }, [])

  const handleDecoded = useCallback(
    (decodedText) => {
      if (busyRef.current || verifying) return
      busyRef.current = true
      verify({ payload: decodedText })
    },
    [verify, verifying]
  )

  // Camera lifecycle: start when in camera mode, stop on unmount / mode switch.
  useEffect(() => {
    if (mode !== 'camera') return undefined

    let cancelled = false
    setCameraState('starting')
    setCameraError('')

    const instance = new Html5Qrcode(READER_ELEMENT_ID, { verbose: false })
    scannerRef.current = instance

    // html5-qrcode throws if .stop() is called on an instance that never
    // finished starting (e.g. permission denied, or unmounted mid-request),
    // so we only ever stop an instance that we know reached the running state.
    let startedOk = false

    instance
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1 },
        (decodedText) => handleDecoded(decodedText),
        () => {
          // per-frame "no QR found" callback - expected constantly, ignore
        }
      )
      .then(() => {
        startedOk = true
        if (cancelled) {
          // Unmounted/switched away while the permission prompt was open -
          // release the camera we just acquired instead of leaving it running.
          instance.stop().then(() => instance.clear()).catch(() => {})
          return
        }
        setCameraState('running')
      })
      .catch((err) => {
        if (cancelled) return
        setCameraState('denied')
        setCameraError(
          err?.message?.includes('Permission')
            ? 'Camera permission was denied.'
            : 'Could not access the camera on this device.'
        )
      })

    return () => {
      cancelled = true
      const inst = scannerRef.current
      scannerRef.current = null
      if (inst && startedOk) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {
            try {
              inst.clear()
            } catch {
              // ignore - element likely already unmounted
            }
          })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  useEffect(
    () => () => {
      mountedRef.current = false
    },
    []
  )

  function handleManualSubmit(e) {
    e.preventDefault()
    if (busyRef.current || verifying) return
    if (!identifier.trim() || !/^\d{5}$/.test(code.trim())) {
      setBanner('Enter the member’s phone/email and their 5-digit code.')
      return
    }
    busyRef.current = true
    verify({ identifier: identifier.trim(), code: code.trim() }).then(() => {
      setIdentifier('')
      setCode('')
    })
  }

  return (
    <div className="screen scanner-screen">
      <ResultFlash result={result} />

      <div className="scanner-tabs">
        <button
          type="button"
          className={'chip' + (mode === 'camera' ? ' chip-active' : '')}
          onClick={() => setMode('camera')}
        >
          Camera scan
        </button>
        <button
          type="button"
          className={'chip' + (mode === 'manual' ? ' chip-active' : '')}
          onClick={() => setMode('manual')}
        >
          Manual entry
        </button>
      </div>

      {banner && (
        <div className="alert alert-error" role="alert">
          {banner}
        </div>
      )}

      {mode === 'camera' ? (
        <div className="camera-panel">
          <div id={READER_ELEMENT_ID} className="qr-reader" />
          {cameraState === 'starting' && (
            <p className="hint">Requesting camera access…</p>
          )}
          {cameraState === 'running' && (
            <p className="hint">Point the camera at the member's QR code.</p>
          )}
          {cameraState === 'denied' && (
            <div className="camera-fallback">
              <p className="alert alert-error">
                {cameraError || 'Camera unavailable.'} Use manual entry below instead.
              </p>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setMode('manual')}
              >
                Switch to manual entry
              </button>
            </div>
          )}
        </div>
      ) : (
        <form className="manual-form" onSubmit={handleManualSubmit}>
          <p className="hint">Type the member's phone/email and their 5-digit code.</p>
          <label className="field">
            <span className="field-label">Phone or email</span>
            <input
              type="text"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect="off"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="98765 43210 or name@email.com"
              disabled={verifying}
            />
          </label>
          <label className="field">
            <span className="field-label">5-digit code</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={5}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
              placeholder="12345"
              disabled={verifying}
              className="code-input"
            />
          </label>
          <button type="submit" className="btn btn-primary btn-large" disabled={verifying}>
            {verifying ? 'Checking…' : 'Verify entry'}
          </button>
        </form>
      )}
    </div>
  )
}
