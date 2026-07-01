import { useColumns as _useColumns, setColumns } from '/@/hooks/useColumns'

import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { parseWindowInfo } from './utils'

export function getRawColumns(options?: any) {
  return setColumns([
    {
      title: $t('平台'),
      key: 'status',
      disabledToggle: true,
      slot: 'platformInfo',
      style: {
        minWidth: '220px',
      },
    },
    {
      title: $t('账号'),
      key: 'platformUserName',
      slot: 'userName',
      style: {
        minWidth: '130px',
      },
    },
    {
      title: $t('密码'),
      key: 'platformPassword',
      slot: 'password',
      style: {
        minWidth: '130px',
      },
      _cache: {
        visible: {},
      },
    },
    // {
    //   title: $t('关联邮箱'),
    //   key: 'platformEmail',
    //   slot: 'email',
    //   style: {
    //     minWidth: '130px',
    //   },
    // },
    {
      title: $t('备注'),
      key: 'remark',
      headerSlot: 'remarkHeader',
      slot: 'remark',
      style: {
        minWidth: '75px',
      },
      _cache: {
        extend: false,
      },
    },
    {
      title: $t('已关联窗口'),
      key: 'related',
      slot: 'related',
      style: {
        minWidth: '120px',
      },
    },
    {
      title: $t('操作'),
      key: 'actions',
      style: 'width: 9rem',
      slot: 'actions',
    },
  ], options)
}

export function useColumns(options?: any) {
  const { userConfig } = storeToRefs(useUserStore())

  const { columns, updateColumns, updateRemarkDisplayStatus } = _useColumns({
    key: 'platform.list',
    data: getRawColumns(options),
  })

  onBeforeMount(() => {
    updateColumns((columns) => {
      const remarkColumn = columns.find(column => column.key === 'remark')
      if (remarkColumn?._cache) {
        Reflect.set(remarkColumn._cache, 'extend', userConfig.value.remarkDisplayStatus!)
      }
    })
  })

  return { columns, updateRemarkDisplayStatus }
}

export function getRelatedProfileLabels(data: Record<string, any>) {
  const workspaceName = getWorkspaceNamePrefix(useWorkspaceStore().currentWorkspace?.workspaceName)
  return parseWindowInfo(data.window_info).map(id => `${workspaceName}-${id}`)
}
