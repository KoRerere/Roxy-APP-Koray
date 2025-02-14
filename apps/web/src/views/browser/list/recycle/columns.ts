import { $t } from '/@/locales'

export const getColumnsConfig = () => ({
  key: 'browser.recycl',
  data: [
    {
      title: $t('窗口信息'),
      key: 'profile',
      slot: 'profile',
      style: {
        width: '40%'
      }
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
})

