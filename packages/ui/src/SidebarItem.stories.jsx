import { Box, IconButton } from '@mui/material'
import { SidebarItem } from './SidebarItem.jsx'

export default {
  title: 'Components/SidebarItem',
  component: SidebarItem,
}

// Einfacher token-gestylter Icon-Platzhalter (lucide-react ist hier nicht installiert).
const Dot = () => (
  <Box sx={{ width: 14, height: 14, borderRadius: 0.5, border: '1.5px solid', borderColor: 'currentColor' }} />
)

export const Default = { args: { label: 'API-Konventionen', icon: <Dot /> } }

export const Active = { args: { label: 'API-Konventionen', icon: <Dot />, active: true } }

export const Tree = {
  render: () => (
    <Box sx={{ width: 260, bgcolor: 'background.paper', p: 1, borderRadius: 1.5 }}>
      <SidebarItem label="Engineering" icon={<Dot />} depth={0} />
      <SidebarItem label="API-Konventionen" icon={<Dot />} depth={1} active />
      <SidebarItem label="Fehlerformate" depth={2} />
      <SidebarItem label="Pagination" depth={2} />
      <SidebarItem label="Deployment" icon={<Dot />} depth={1} />
    </Box>
  ),
}

export const WithHoverActions = {
  render: () => (
    <Box sx={{ width: 260, bgcolor: 'background.paper', p: 1, borderRadius: 1.5 }}>
      <SidebarItem
        label="Mit Hover-Aktionen (hover mich)"
        icon={<Dot />}
        actions={
          <>
            <IconButton size="small" sx={{ width: 22, height: 22, color: 'text.secondary' }}>+</IconButton>
            <IconButton size="small" sx={{ width: 22, height: 22, color: 'text.secondary' }}>…</IconButton>
          </>
        }
      />
    </Box>
  ),
}
