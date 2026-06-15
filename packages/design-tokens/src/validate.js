// Validiert geordnete DTCG-Token-Layer: alle Aliase auflösbar + erwartete
// semantische Keys vorhanden. Liefert { ok: boolean, errors: string[] }.

import { resolve } from './resolve.js'

const REQUIRED_SEMANTIC = [
  'semantic.primary',
  'semantic.bg',
  'semantic.surface',
  'semantic.border',
  'semantic.text',
  'semantic.textSecondary',
  'semantic.success',
  'semantic.warning',
  'semantic.error',
]

export function validate(layers) {
  const errors = []
  let tokens = null
  try {
    tokens = resolve(layers.filter(Boolean))
  } catch (e) {
    errors.push(`Alias-Auflösung fehlgeschlagen: ${e.message}`)
    return { ok: false, errors }
  }
  for (const key of REQUIRED_SEMANTIC) {
    if (tokens[key] === undefined) errors.push(`Fehlender semantischer Key: ${key}`)
  }
  return { ok: errors.length === 0, errors }
}
