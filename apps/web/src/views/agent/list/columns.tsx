import RelatedInfo from '/@/components/related-info.vue'
import RxTag from '/@/components/rx-tag.vue'
import { setColumns, useColumns as _useColumns } from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'

export function getRawColumns(options?: any) {
  const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
  return setColumns([
    {
      title: $t('代理信息'),
      key: 'proxy',
      slot: 'proxy',
    },
    {
      title: $t('出口 IP'),
      key: 'outbound',
      slot: 'outbound'
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
      title: $t('IP 查询渠道'),
      key: 'ipChecker',
      render: ({ data }: any) => {
        return (
          <RxTag icon="base/rx_ic_network" label={data.checkChannelValue} disabled={true}></RxTag>
        )
      },
    },
    {
      title: $t('已关联窗口'),
      key: 'relatedProfiles',
      render: ({ data }: any) => {
        const list = data.bindList.map((id: number) => `${workspaceName}-${id}`)

        return <RelatedInfo list={list}></RelatedInfo>
      },
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ], options)
}

export function useColumns(options?: any) {
  const { userConfig } = storeToRefs(useUserStore())

  const { columns, updateColumns, updateRemarkDisplayStatus } = _useColumns({
    key: 'agent.list',
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
