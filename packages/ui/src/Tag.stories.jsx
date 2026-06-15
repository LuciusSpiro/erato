import { Stack } from '@mui/material'
import { Tag } from './Tag.jsx'

export default {
  title: 'Components/Tag',
  component: Tag,
}

export const Default = { args: { label: 'Entwurf', color: 'default' } }
export const Primary = { args: { label: 'Wichtig', color: 'primary' } }

export const AllVariants = {
  render: () => (
    <Stack direction="row" spacing={1}>
      <Tag label="Standard" />
      <Tag label="Primär" color="primary" />
    </Stack>
  ),
}
