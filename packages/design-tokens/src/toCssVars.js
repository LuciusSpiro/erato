// Wandelt eine aufgelöste, flache Token-Map (dotpath -> Wert, siehe resolve.js)
// in einen CSS-Variablen-String: ":root{ --erato-semantic-primary: #...; ... }".
// Nur primitive String/Number-Werte werden ausgegeben; Composites (z.B. typography)
// werden feldweise flach gemacht (type.body.fontSize -> --erato-type-body-fontFamily ...).

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v)

// dotpath/Feldname -> CSS-Var-Segment: Punkte und camelCase-Grenzen -> Bindestriche, lowercase.
const toVarName = (prefix, path) =>
  `${prefix}-${path.replace(/\./g, '-').replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}`

export function toCssVars(tokens, { prefix = '--erato' } = {}) {
  const lines = []
  const emit = (path, value) => {
    if (value == null) return
    if (typeof value === 'string' || typeof value === 'number') {
      lines.push(`  ${toVarName(prefix, path)}: ${value};`)
    } else if (isObject(value)) {
      // Composite-Token feldweise flach machen.
      for (const [k, v] of Object.entries(value)) emit(`${path}.${k}`, v)
    }
    // Arrays / sonstiges überspringen.
  }
  for (const [path, value] of Object.entries(tokens)) emit(path, value)
  return `:root{\n${lines.join('\n')}\n}`
}
