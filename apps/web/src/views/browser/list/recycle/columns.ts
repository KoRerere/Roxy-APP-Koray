import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.recycl',
  data: [
    {
      title: $t('Profile Info'),
      key: 'profile',
      slot: 'profile',
    },
    {
      title: $t('Tags'),
      key: 'open',
    },
    {
      title: $t('Delete Log'),
      key: 'group',
      slot: 'log',
    },
  ],
}

export default columnsConfig
