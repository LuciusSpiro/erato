import { Breadcrumb } from './Breadcrumb.jsx'

export default {
  title: 'Components/Breadcrumb',
  component: Breadcrumb,
}

export const Default = {
  args: { items: ['Engineering', 'API', 'API-Konventionen'] },
}

export const SingleLevel = {
  args: { items: ['Start'] },
}

export const Clickable = {
  args: {
    items: [
      { label: 'Engineering', onClick: () => {} },
      { label: 'API', onClick: () => {} },
      { label: 'API-Konventionen' },
    ],
  },
}
