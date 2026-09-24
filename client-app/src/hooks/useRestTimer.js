import { useCallback, useEffect, useRef, useState } from 'react'

// Simple client-side rest timer between sets. No API involved.
export function useRestTimer(defaultSeconds = 60) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!running) return undefined
    intervalRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current)
          setRunning(false)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [running])

  const start = useCallback(
    (seconds = defaultSeconds) => {
      setSecondsLeft(seconds)
      setRunning(true)
    },
    [defaultSeconds]
  )

  const addTime = useCallback((seconds) => {
    setSecondsLeft((s) => s + seconds)
  }, [])

  const skip = useCallback(() => {
    setRunning(false)
    setSecondsLeft(0)
  }, [])

  return { secondsLeft, running, start, addTime, skip }
}
