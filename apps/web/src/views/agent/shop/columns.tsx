import RelatedInfo from '/@/components/related-info.vue'
import RxTag from '/@/components/rx-tag.vue'
import BasicInfo from '/@/views/agent/shop/components/basic-info.vue'
import ExpireDate from '/@/views/agent/shop/components/expire-date.vue'
import { useColumns as _useColumns, setColumns } from '/@/hooks/useColumns'
import { usePermission } from '/@/hooks/usePermission'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'
import { format } from 'date-fns'
import { ProxyType } from '/@/enums/proxy'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

export function getRawColumns(options?: any) {
  const { check } = usePermission()
  const { currentWorkspace } = storeToRefs(useWorkspaceStore())
  const workspaceName = getWorkspaceNamePrefix(currentWorkspace.value?.workspaceName)

  const columns = [
    {
      title: $t('出口 IP'),
      key: 'lastCountry',
      sortable: true,
      slot: 'outbound',
    },
    {
      title: $t('代理 IP 信息'),
      key: 'proxy',
      render: ({ data }: any) => <BasicInfo data={data}></BasicInfo>,
    },
    {
      title: $t('到期时间'),
      key: 'expireDate',
      sortable: true,
      render: ({ data }: any) => <ExpireDate data={data}></ExpireDate>,
    },
    {
      title: $t('价格'),
      key: 'proxyProviderPrice',
      slot: 'price',
    },
    {
      title: $t('自动续费'),
      key: 'autoRenew',
      slot: 'renew',
      power: check('Cost_Center_all'),
    },
    {
      title: $t('备注'),
      key: 'proxyRemark',
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
      key: 'bindList',
      render: ({ data }: any) => {
        const list = data.bindList.map((id: number) => `${workspaceName}-${id}`)
        return <RelatedInfo list={list}></RelatedInfo>
      },
    },
    {
      title: $t('IP 查询渠道'),
      key: 'ipChecker',
      render: ({ data }: any) => {
        return (
          <RxTag tooltip={$t('为保障测试结果统一，暂时仅支持官方指定的查询渠道。')} icon="base/rx_ic_network" label={data.checkChannelValue} disabled={true}></RxTag>
        )
      },
    },
    {
      title: $t('来源'),
      key: 'proxyType',
      sortable: true,
      getText: (data: any) => data.proxyType === ProxyType.buy ? $t('购买') : $t('添加'),
    },
    {
      title: $t('代理 IP 类型'),
      key: 'providerType',
      slot: 'providerType',
      _visible: false,
    },
    {
      title: $t('订单号'),
      key: 'orderNo',
      _visible: false,
      getText: (data: any) => data.orderNo || '--',
    },
    {
      title: $t('创建时间'),
      key: 'createTime',
      _visible: false,
      sortable: true,
      getText: (data: any) => data.createTime ? format(data.createTime, 'yyyy-MM-dd') : '--',
    },
    {
      title: $t('续费时间'),
      key: 'renewalTime',
      _visible: false,
      sortable: true,
      getText: (data: any) => data.renewalTime ? format(data.renewalTime, 'yyyy-MM-dd') : '--',
    },

    {
      title: $t('服务商'),
      key: 'proxyProviderName',
      getText: (data: any) => data.proxyType === ProxyType.buy ? (data.proxyProviderName || $t('官方赠送')) : '--',
      _visible: false,
      sortable: true,
    },

  ].filter(column => column.power !== false)

  return setColumns(columns, options)
}

export function useColumns(options?: any) {
  const { userConfig } = storeToRefs(useUserStore())

  const { columns, updateColumns, updateRemarkDisplayStatus } = _useColumns({
    key: 'proxy.shop',
    data: getRawColumns(options),
  })

  onBeforeMount(() => {
    updateColumns((columns) => {
      const column = columns.find(column => column.key === 'proxyRemark')
      if (column?._cache) {
        Reflect.set(column._cache, 'extend', userConfig.value.remarkDisplayStatus!)
      }
    })
  })

  return { columns, updateRemarkDisplayStatus }
}
