import RelatedInfo from '/@/components/related-info.vue'
import { setColumns, useColumns as _useColumns } from '/@/hooks/useColumns'

import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'

export function getRawColumns(options?: any) {
  const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
  return setColumns([
    {
      title: $t('账号信息'),
      key: 'status',
      disabledToggle: true,
      slot: 'platform',
    },
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
      }
    },
    {
      title: $t('已关联窗口'),
      key: 'related',
      render: ({ data }: any) => {
        const list = data.window_info.map((id: number) => `${workspaceName}-${id}`)
        return <RelatedInfo list={list}></RelatedInfo>
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
    key: 'account.list',
    data: getRawColumns(options),
  })

  onBeforeMount(() => {
    updateColumns((columns) => {
      const column = columns.find(column => column.key === 'remark')
      if (column?._cache) {
        Reflect.set(column._cache, 'extend', userConfig.value.remarkDisplayStatus!)
      }
    })
  })

  return { columns, updateRemarkDisplayStatus }
}
