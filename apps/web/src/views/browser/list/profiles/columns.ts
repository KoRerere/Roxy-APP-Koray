import { format, min } from 'date-fns'
import { $t } from '/@/locales'

const skeleton = {
  width: '120px',
  height: '24px',
  borderRadius: '4px',
}

export function getColumns() {
  return {
    key: 'browser.list',
    data: [
      {
        title: $t('窗口信息'),
        key: 'profile',
        disabledToggle: true,
        slot: 'profile',
        style: {
          width: '30%',
          minWidth: '375px',
        }
      },
      {
        title: $t('操作'),
        key: 'open',
        disabledToggle: true,
        slot: 'open',
        style: {
          width: '12%',
          minWidth: '120px',
        }
      },
      {
        title: $t('备注'),
        key: 'note',
        headerSlot: 'noteHeader',
        slot: 'note',
        style: {
          minWidth: '75px',
        },
        _cache: {
          extend: false,
        }
      },
      {
        title: $t('标签'),
        key: 'tags',
        slot: 'tags',
        style: {
          width: '10%',
          minWidth: '95px',
        }
      },
      {
        title: $t('项目'),
        key: 'project',
        slot: 'project',
        style: {
          width: '10%',
          minWidth: '95px',
        }
      },
      {
        title: $t('创建时间'),
        key: 'createTime',
        _visible: false,
        skeleton,
        getText: (row: any) => row.createTime ? format(new Date(row.createTime), 'yyyy/MM/dd HH:mm:ss') : '--',
        style: {
          width: '13%',
          minWidth: '140px',
        }
      },
      {
        title: $t('更新时间'),
        key: 'updateTime',
        _visible: false,
        skeleton,
        getText: (row: any) => row.updateTime ? format(new Date(row.updateTime), 'yyyy/MM/dd HH:mm:ss') : '--',
        style: {
          width: '13%',
          minWidth: '140px',
        }
      },
      {
        title: $t('最后打开'),
        key: 'openTime',
        skeleton,
        getText: (row: any) => row.openTime ? format(new Date(row.openTime), 'yyyy/MM/dd HH:mm:ss') : '--',
        style: {
          width: '13%',
          minWidth: '140px',
        }
      },
      {
        title: $t('其他'),
        key: 'actions',
        alignFrozen: 'right',
        slot: 'actions',
        style: {
          width: '0rem',
          minWidth: '120px',
        }
      },
    ],
  }
}

