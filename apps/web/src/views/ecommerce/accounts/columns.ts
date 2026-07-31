import AccountName from '/@/views/ecommerce/accounts/components/account-name.vue'
import { format } from 'date-fns'

const skeleton = {
  width: '120px',
  height: '24px',
  borderRadius: '4px',
}

export function getAccountColumns() {
  return {
    key: 'ecommerce.account.list',
    data: [
      {
        title: $t('账号名称'),
        key: 'account',
        skeleton,
        render: ({ data }: any) => h(AccountName, { data }),
      },
      {
        title: $t('账号详情'),
        key: 'account1',
        skeleton,
        getText: (row: any) => !row.windowPlatformList[0] ? '--' : row.windowPlatformList[0].displayPlatform,
      },
      {
        title: $t('绑定设备'),
        key: 'bindDevice',
        slot: 'bindDevice',
        skeleton,
        style: {
          width: '18%',
          minWidth: '160px',
        },
      },
      {
        title: $t('标签'),
        key: 'tags',
        slot: 'tags',
        style: {
          width: '10%',
          minWidth: '95px',
        },
      },
      {
        title: $t('分组'),
        key: 'project',
        slot: 'project',
        style: {
          width: '10%',
          minWidth: '95px',
        },
      },
      {
        title: $t('最后打开'),
        key: 'openTime',
        skeleton,
        sortable: true,
        getText: (row: any) => row.openTime ? format(new Date(row.openTime), 'yyyy/MM/dd HH:mm:ss') : '--',
        style: {
          width: '13%',
          minWidth: '140px',
        },
      },
      {
        title: $t('操作'),
        key: 'operation',
        disabledToggle: true,
        alignFrozen: 'right',
        slot: 'operation',
        style: {
          width: '0%',
          minWidth: '160px',
        },
      },
    ],
  }
}
