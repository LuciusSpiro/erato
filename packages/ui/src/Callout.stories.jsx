import { Stack } from '@mui/material'
import { Callout } from './Callout.jsx'

export default {
  title: 'Components/Callout',
  component: Callout,
}

export const Info = { args: { tone: 'info', title: 'Hinweis', children: 'Alle Endpunkte folgen dem REST-Muster.' } }

export const AllTones = {
  render: () => (
    <Stack spacing={1.5} sx={{ width: 360 }}>
      <Callout tone="info" title="Info">Standardhinweis im Akzentton.</Callout>
      <Callout tone="success" title="Erfolg">Seite wurde gespeichert.</Callout>
      <Callout tone="warning" title="Achtung">Diese Aktion ist nicht umkehrbar.</Callout>
      <Callout tone="error" title="Fehler">Speichern fehlgeschlagen.</Callout>
    </Stack>
  ),
}
