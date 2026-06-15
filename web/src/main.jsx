import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from 'react-oidc-context'
import { WebStorageStateStore } from 'oidc-client-ts'
import App from './App.jsx'
import { oidcConfig } from './auth'

// onSigninCallback entfernt die OIDC-Query-Parameter aus der URL nach dem Login.
const onSigninCallback = () => {
  window.history.replaceState({}, document.title, window.location.pathname)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider
      {...oidcConfig}
      userStore={new WebStorageStateStore({ store: window.localStorage })}
      onSigninCallback={onSigninCallback}
    >
      <App />
    </AuthProvider>
  </React.StrictMode>,
)
