// Reine Logik für den Editor-Autosave — bewusst ohne React/TipTap, damit testbar.
//
// Datenverlust-Schutz: niemals nicht-leeren Inhalt durch Leer ersetzen (z.B. wenn der
// Editor beim Laden kurzzeitig leeren Markdown meldet).
//
// Rückgabe:
//   apply: soll der lokale Editor-State auf `incoming` gesetzt werden?
//   save:  soll gespeichert werden (echte Änderung ggü. geladenem Inhalt)?
export function evaluateContentChange(loaded, incoming) {
  const inc = incoming ?? ''
  const ld = loaded ?? ''
  if (inc.trim() === '' && ld.trim() !== '') return { apply: false, save: false }
  return { apply: true, save: inc !== ld }
}
