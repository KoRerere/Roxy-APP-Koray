import { format } from 'date-fns'
import { $t } from '/@/locales'

const columnsConfig = {
  key: 'browser.list',
  data: [
    {
      title: $t('窗口信息'),
      key: 'profile',
      disabledToggle: true,
      style: { maxWidth: '200px' },
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
      title: $t('创建时间'),
      key: 'createTime',
      getText: (row: any) => format(new Date(row.createTime), 'yyyy/MM/dd HH:mm:ss'),
    },
    {
      title: $t('更新时间'),
      key: 'updateTime',
      getText: (row: any) => format(new Date(row.updateTime), 'yyyy/MM/dd HH:mm:ss'),

    },
    {
      title: $t('最后打开'),
      key: 'lastOpened',
      getText: (row: any) => format(new Date(row.updateTime), 'yyyy/MM/dd HH:mm:ss'),
    },
    {
      title: $t('其他'),
      key: 'actions',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
