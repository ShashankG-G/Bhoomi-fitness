import { useState } from 'react'

// Renders an exercise's demo animation/image, falling back to a simple
// on-brand placeholder icon if the URL is missing or fails to load (the
// backend may be serving placeholder URLs that 404).
export default function ExerciseMedia({ url, alt, size = 64 }) {
  const [failed, setFailed] = useState(false)
  const isVideo = url && /\.(mp4|webm|mov)$/i.test(url)

  if (!url || failed) {
    return (
      <div
        className="exercise-media exercise-media--fallback"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" width={size * 0.5} height={size * 0.5} fill="none">
          <path
            d="M6.5 6.5 4 9v6l2.5 2.5M17.5 6.5 20 9v6l-2.5 2.5M9 9h6v6H9z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    )
  }

  if (isVideo) {
    return (
      <video
        className="exercise-media"
        style={{ width: size, height: size, objectFit: 'cover' }}
        src={url}
        muted
        loop
        playsInline
        autoPlay
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <img
      className="exercise-media"
      style={{ width: size, height: size, objectFit: 'cover' }}
      src={url}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}
