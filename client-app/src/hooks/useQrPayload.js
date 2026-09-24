import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'

const POLL_MS = 25000

// Polls GET /api/auth/qr-payload every ~25s and exposes a live countdown
// (seconds remaining until the code is expected to rotate) so the UI can
// show progress instead of looking frozen.
export function useQrPayload() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [secondsLeft, setSecondsLeft] = useState(null)
  const pollRef = useRef(null)
  const tickRef = useRef(null)
  const abortRef = useRef(null)

  const fetchPayload = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    try {
      const res = await api.qrPayload(controller.signal)
      setData(res)
      setSecondsLeft(res?.expires_in ?? 30)
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPayload()
    pollRef.current = setInterval(fetchPayload, POLL_MS)
    tickRef.current = setInterval(() => {
      setSecondsLeft((s) => (s === null ? null : Math.max(0, s - 1)))
    }, 1000)
    return () => {
      clearInterval(pollRef.current)
      clearInterval(tickRef.current)
      abortRef.current?.abort()
    }
  }, [fetchPayload])

  return { data, error, loading, secondsLeft, refetch: fetchPayload }
}
