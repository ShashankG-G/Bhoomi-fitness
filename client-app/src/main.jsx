import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import './styles/global.css'

// HashRouter (not BrowserRouter): this app is deployed as a static bundle on
// GitHub Pages, which has no server-side rewrite rule to send deep-link
// refreshes (e.g. /history) back to index.html. Hash routing keeps all
// client-side routes after a "#", so every URL always resolves to the same
// static index.html regardless of host/subpath.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </HashRouter>
  </React.StrictMode>
)
