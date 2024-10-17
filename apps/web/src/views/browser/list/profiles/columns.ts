import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.list',
  data: [
    {
      title: $t('Profile Info'),
      key: 'profile',
      disabledToggle: true,
      slot: 'profile',
    },
    {
      title: $t('Open/View'),
      key: 'open',
      disabledToggle: true,
      slot: 'open',
    },
    {
      title: $t('Project'),
      key: 'project',
      slot: 'project',
    },
    {
      title: $t('Tags'),
      key: 'tags',
      slot: 'tags',
    },
    {
      title: $t('Actions'),
      key: 'actions',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
