export default function ErrorBanner({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="error-banner">
      {message}
      {onRetry && (
        <div style={{ marginTop: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={onRetry} type="button">
            Try again
          </button>
        </div>
      )}
    </div>
  )
}
