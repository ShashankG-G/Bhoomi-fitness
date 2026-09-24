export default function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="centered-loader">
      <div className="stack" style={{ alignItems: 'center' }}>
        <div className="spinner spinner--lg" />
        <p className="subtitle">{label}</p>
      </div>
    </div>
  )
}
