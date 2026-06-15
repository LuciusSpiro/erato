import { useState } from 'react'
import { Box } from '@mui/material'
import { Toolbar, ToolbarButton } from './Toolbar.jsx'

export default {
  title: 'Components/Toolbar',
  component: Toolbar,
  subcomponents: { ToolbarButton },
}

// Token-gestylte Buchstaben-Platzhalter (lucide-react ist hier nicht installiert).
const Mark = ({ children, sx }) => (
  <Box component="span" sx={{ fontSize: 15, fontWeight: 600, lineHeight: 1, ...sx }}>{children}</Box>
)

export const Default = {
  render: () => (
    <Toolbar>
      <ToolbarButton title="Fett" icon={<Mark sx={{ fontWeight: 700 }}>B</Mark>} active />
      <ToolbarButton title="Kursiv" icon={<Mark sx={{ fontStyle: 'italic' }}>I</Mark>} />
      <ToolbarButton title="Durchgestrichen" icon={<Mark sx={{ textDecoration: 'line-through' }}>S</Mark>} />
      <ToolbarButton title="Link" icon={<Mark>↗</Mark>} />
      <ToolbarButton title="Markieren" icon={<Mark>H</Mark>} />
    </Toolbar>
  ),
}

export const Elevated = {
  render: () => (
    <Toolbar elevated>
      <ToolbarButton title="Fett" icon={<Mark sx={{ fontWeight: 700 }}>B</Mark>} />
      <ToolbarButton title="Kursiv" icon={<Mark sx={{ fontStyle: 'italic' }}>I</Mark>} />
      <ToolbarButton title="Markieren" icon={<Mark>H</Mark>} active />
    </Toolbar>
  ),
}

// Interaktiv: zeigt den active-State-Toggle.
export const Interactive = {
  render: () => {
    const [active, setActive] = useState({ b: false, i: false })
    return (
      <Toolbar>
        <ToolbarButton title="Fett" active={active.b} onClick={() => setActive((s) => ({ ...s, b: !s.b }))} icon={<Mark sx={{ fontWeight: 700 }}>B</Mark>} />
        <ToolbarButton title="Kursiv" active={active.i} onClick={() => setActive((s) => ({ ...s, i: !s.i }))} icon={<Mark sx={{ fontStyle: 'italic' }}>I</Mark>} />
      </Toolbar>
    )
  },
}
