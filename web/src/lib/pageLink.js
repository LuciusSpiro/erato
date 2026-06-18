// Interne Seiten-Links: href "#/page/<id>". Reine Helfer (testbar).
export const pageHref = (id) => `#/page/${id}`

export function parsePageHref(href) {
  const m = /^#\/page\/(.+)$/.exec(href || '')
  return m ? m[1] : null
}
