import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="screen screen--centered" style={{ textAlign: 'center' }}>
      <h1 className="page-title" style={{ marginBottom: 10 }}>
        Page not found
      </h1>
      <p className="subtitle" style={{ marginBottom: 20 }}>
        That screen doesn&apos;t exist.
      </p>
      <Link to="/" className="btn btn-primary" style={{ display: 'inline-flex' }}>
        Back to Bhoomi Fitness
      </Link>
    </div>
  )
}
