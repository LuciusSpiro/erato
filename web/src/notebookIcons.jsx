// Notizbuch-Icons: unterstützt sowohl benannte lucide-Icons (z.B. "Code2")
// als auch Emoji-Strings (z.B. "🛠️"). Fallback: Standard-Notizbuch-Icon.
import {
  NotebookText, Code2, Lightbulb, Users, Star, FileText, BookOpen, Rocket, Folder,
} from 'lucide-react'

export const NB_ICON_MAP = {
  NotebookText, Code2, Lightbulb, Users, Star, FileText, BookOpen, Rocket, Folder,
}

// Auswahl für den „Notizbuch anlegen"-Dialog.
export const NB_ICON_NAMES = Object.keys(NB_ICON_MAP)

// Rendert das passende Icon: benannt → lucide-Komponente, sonst Emoji-String,
// sonst Standard-Notizbuch-Icon.
export function NotebookIcon({ icon, size = 16 }) {
  const Comp = NB_ICON_MAP[icon]
  if (Comp) return <Comp size={size} />
  if (icon && typeof icon === 'string') {
    return <span style={{ fontSize: size, lineHeight: 1 }}>{icon}</span>
  }
  return <NotebookText size={size} />
}
