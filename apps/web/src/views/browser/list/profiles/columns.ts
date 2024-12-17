import { format } from 'date-fns'
import { $t } from '/@/locales'

export function getColumns() {
  return {
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
        key: 'note',
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
        _visible: false,
        getText: (row: any) => row.createTime ? format(new Date(row.createTime), 'yyyy/MM/dd HH:mm:ss') : '--',
      },
      {
        title: $t('更新时间'),
        key: 'updateTime',
        _visible: false,
        getText: (row: any) => row.updateTime ? format(new Date(row.updateTime), 'yyyy/MM/dd HH:mm:ss') : '--',
      },
      {
        title: $t('最后打开'),
        key: 'openTime',
        getText: (row: any) => row.openTime ? format(new Date(row.openTime), 'yyyy/MM/dd HH:mm:ss') : '--',
      },
      {
        title: $t('其他'),
        key: 'actions',
        alignFrozen: 'right',
        slot: 'actions',
      },
    ],
  }
}

