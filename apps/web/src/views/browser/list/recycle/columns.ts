import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.recycl',
  data: [
    {
      title: $t('窗口信息'),
      key: 'profile',
      slot: 'profile',
    },
    {
      title: $t('标签'),
      slot: 'tags',
    },
    {
      title: $t('删除记录'),
      key: 'group',
      slot: 'log',
    },
    {
      title: $t('操作'),
      slot: 'actions',
    },
  ],
}

export default columnsConfig
