import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.list',
  data: [
    {
      title: $t('窗口信息'),
      key: 'profile',
      disabledToggle: true,
      slot: 'profile',
    },
    {
      title: $t('操作'),
      key: 'open',
      disabledToggle: true,
      slot: 'open',
    },
    {
      title: $t('项目'),
      key: 'project',
      slot: 'project',
    },
    {
      title: $t('标签'),
      key: 'tags',
      slot: 'tags',
    },
    {
      title: $t('其他'),
      key: 'actions',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
