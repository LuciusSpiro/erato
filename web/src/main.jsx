import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { WebStorageStateStore } from 'oidc-client-ts'
import App from './App.jsx'
import { oidcConfig } from './auth'
import { LOCAL_MODE } from './authShim'

// onSigninCallback entfernt die OIDC-Query-Parameter aus der URL nach dem Login.
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}

const root = ReactDOM.createRoot(document.getElementById('root'))

// Im local mode (Electron) gibt es kein Keycloak → AuthProvider weglassen.
root.render(
  <React.StrictMode>
    {LOCAL_MODE ? (
      <App />
    ) : (
      <AuthProvider
        {...oidcConfig}
        userStore={new WebStorageStateStore({ store: window.localStorage })}
        onSigninCallback={onSigninCallback}
      >
        <App />
      </AuthProvider>
    )}
  </React.StrictMode>,
)
