// OIDC-Konfiguration für Keycloak (react-oidc-context / oidc-client-ts).
export const oidcConfig = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8085/realms/erato',
  client_id: import.meta.env.VITE_OIDC_CLIENT ?? 'erato-web',
  redirect_uri: window.location.origin + '/',
  post_logout_redirect_uri: window.location.origin + '/',
  scope: 'openid profile email',
  // Tokens im localStorage halten, damit ein Reload eingeloggt bleibt.
  // (Für Produktion ggf. auf strengere Speicherung umstellen.)
}

// Realm-Rollen aus dem Access-Token lesen.
export function rolesFromUser(user) {
  try {
    const token = user?.access_token
    if (!token) return []
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload?.realm_access?.roles ?? []
  } catch {
    return []
  }
}
