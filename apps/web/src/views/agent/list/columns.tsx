import RelatedInfo from '/@/components/related-info.vue'
import RxTag from '/@/components/rx-tag.vue'
import { setColumns, useColumns } from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'

export function getRawColumns(options?: any) {
  const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3)
  return setColumns([
    {
      title: $t('代理信息'),
      key: 'proxy',
      slot: 'proxy',
    },
    {
      title: $t('出口 IP'),
      key: 'outbound',
      render: ({ data }: any) => {
        return (
          <OutboundIp country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />
        )
      },
    },
    {
      title: $t('备注'),
      key: 'remark',
      slot: 'remark',
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

export function getColumns(options?: any) {
  const rawColumns = getRawColumns(options)
  const [columns] = useColumns({
    key: 'agent.list',
    data: rawColumns,
  })
  return columns
}
