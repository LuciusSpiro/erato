import { Box, Button } from '@mui/material'
import { EmptyState } from './EmptyState.jsx'

export default {
  title: 'Components/EmptyState',
  component: EmptyState,
}

// Token-gestylter Icon-Platzhalter (lucide-react ist hier nicht installiert).
const Placeholder = () => (
  <Box sx={{ width: 22, height: 22, borderRadius: 1, border: '1.5px solid', borderColor: 'currentColor' }} />
)

export const Default = {
  args: {
    icon: <Placeholder />,
    title: 'Noch keine Seiten',
    description: 'Lege deine erste Seite an, um loszulegen.',
  },
}

export const WithAction = {
  render: () => (
    <EmptyState
      icon={<Placeholder />}
      title="Keine Treffer"
      description="Für deine Suche wurde nichts gefunden. Versuche einen anderen Begriff."
      action={<Button size="small" variant="outlined" sx={{ borderColor: 'divider', color: 'text.primary' }}>Filter zurücksetzen</Button>}
    />
  ),
}

export const TextOnly = {
  args: {
    title: 'Leeres Notizbuch',
    description: 'Hier erscheinen deine Seiten, sobald du welche erstellst.',
  },
}
