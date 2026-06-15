import { Box, Chip } from '@mui/material'
import { SearchField } from './SearchField.jsx'

export default {
  title: 'Components/SearchField',
  component: SearchField,
}

// Token-gestylter Icon-Platzhalter (lucide-react ist hier nicht installiert).
const Glass = () => (
  <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: '1.5px solid', borderColor: 'currentColor' }} />
)

export const Default = {
  args: { icon: <Glass />, placeholder: 'Suchen oder Seite öffnen…' },
}

export const FullWidth = {
  render: () => (
    <Box sx={{ width: 420 }}>
      <SearchField fullWidth icon={<Glass />} placeholder="Volltextsuche…" />
    </Box>
  ),
}

export const WithEndAdornment = {
  args: {
    icon: <Glass />,
    placeholder: 'Suchen…',
    endAdornment: (
      <Chip label="esc" size="small" variant="outlined" sx={{ height: 20, fontSize: 11, color: 'text.secondary' }} />
    ),
  },
}
