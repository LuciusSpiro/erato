// Minimaler DTCG-Resolver: deep-merge geordneter Token-Layer, Alias-Auflösung
// ({pfad.zum.token}), dann Flatten zu einer Map dotpath -> aufgelöster Wert.
// Composite-Tokens (typography) werden feldweise aufgelöst und als Objekt geliefert.

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v)
const isAlias = (v) => typeof v === 'string' && /^\{[^{}]+\}$/.test(v)

export function deepMerge(...layers) {
  const out = {}
  const merge = (target, src) => {
    for (const [k, v] of Object.entries(src)) {
      if (isObject(v) && isObject(target[k])) merge(target[k], v)
      else target[k] = isObject(v) ? structuredClone(v) : v
    }
  }
  for (const layer of layers) if (layer) merge(out, layer)
  return out
}

// Navigiert im Baum zu einem Token-Knoten und liefert dessen aufgelösten $value.
function aliasValue(tree, path, seen) {
  if (seen.has(path)) throw new Error(`Token-Alias-Zyklus bei ${path}`)
  seen.add(path)
  let node = tree
  for (const seg of path.split('.')) node = node?.[seg]
  if (!node || node.$value === undefined) throw new Error(`Unbekannter Token-Alias: {${path}}`)
  return resolveValue(tree, node.$value, seen)
}

function resolveValue(tree, value, seen = new Set()) {
  if (isAlias(value)) return aliasValue(tree, value.slice(1, -1), new Set(seen))
  if (isObject(value)) {
    const out = {}
    for (const [k, v] of Object.entries(value)) out[k] = resolveValue(tree, v, seen)
    return out
  }
  return value
}

// Flacht den aufgelösten Baum zu { 'semantic.primary': '#3B5BDB', 'type.body': {…} }.
// root = vollständiger Baum (für Alias-Auflösung), node = aktuell gewanderter Teilbaum.
function flatten(node, prefix, acc, root) {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue
    const path = prefix ? `${prefix}.${k}` : k
    if (isObject(v) && v.$value !== undefined) {
      acc[path] = resolveValue(root, v.$value)
    } else if (isObject(v)) {
      flatten(v, path, acc, root)
    }
  }
  return acc
}

// resolve(layers) → flache, aufgelöste Token-Map. Layer-Reihenfolge = Override-Reihenfolge.
export function resolve(layers) {
  const merged = deepMerge(...layers)
  return flatten(merged, '', {}, merged)
}
