import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.list',
  data: [
    {
      title: $t('窗口信息'),
      key: 'profile',
      disabledToggle: true,
      style: { width: '30%' },
      slot: 'profile',
    },
    {
      title: $t('操作'),
      key: 'open',
      disabledToggle: true,
      slot: 'open',
    },
    {
      title: $t('备注'),
      slot: 'note',
    },
    {
      title: $t('标签'),
      key: 'tags',
      slot: 'tags',
    },
    {
      title: $t('项目'),
      key: 'project',
      slot: 'project',
    },
    {
      title: $t('其他'),
      key: 'actions',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
