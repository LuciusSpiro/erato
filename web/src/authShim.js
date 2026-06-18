// Auth-Abstraktion: im Web-Modus echtes Keycloak/OIDC (react-oidc-context),
// im local mode (Electron/Einzelplatz) ein fester lokaler Admin ohne Login.
// VITE_LOCAL_MODE wird beim Build der Desktop-Variante gesetzt.
import { useAuth as useOidcAuth } from 'react-oidc-context'

export const LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE === '1'

// Stabiles Stub-Objekt (gleiche Form wie react-oidc-context useAuth()).
const localAuth = {
  isAuthenticated: true,
  isLoading: false,
  user: { access_token: null, profile: { preferred_username: 'lokal' } },
  signinRedirect: () => {},
  signoutRedirect: () => {},
}

// LOCAL_MODE ist eine Build-Konstante → der Zweig ist über alle Renders stabil,
// daher kein Verstoß gegen die Hook-Regeln.
export function useAuth() {
  if (LOCAL_MODE) return localAuth
  return useOidcAuth()
}
