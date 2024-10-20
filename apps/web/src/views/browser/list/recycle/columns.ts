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
      slot: 'tags',
    },
    {
      title: $t('Delete Log'),
      key: 'group',
      slot: 'log',
    },
    {
      title: $t('Actions'),
      slot: 'actions',
    },
  ],
}

export default columnsConfig
