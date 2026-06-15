// Lädt das Branding (Tokens + Logo) zur Laufzeit aus erato-api.
// Im P0: Akzentfarbe + App-Name + Logo. Später: vollständiger DTCG-Resolver.

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'
const APP_ID = 'erato'

export const DEFAULT_BRANDING = {
  tokens: { appName: 'Erato', primary: { light: '#3B5BDB', dark: '#748FFC' } },
  logo: { light: null, dark: null },
}

export async function fetchBranding() {
  try {
    const res = await fetch(`${API}/v1/branding?app=${APP_ID}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return {
      tokens: { ...DEFAULT_BRANDING.tokens, ...(data.tokens ?? {}) },
      logo: data.logo ?? DEFAULT_BRANDING.logo,
    }
  } catch (err) {
    console.warn('Branding konnte nicht geladen werden, nutze Defaults:', err.message)
    return DEFAULT_BRANDING
  }
}
