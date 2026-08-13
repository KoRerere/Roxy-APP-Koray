import RxTag from '/@/components/rx-tag.vue'
import BasicInfo from '/@/views/agent/shop/components/basic-info.vue'
import ExpireDate from '/@/views/agent/shop/components/expire-date.vue'
import BandwidthCell from '/@/views/agent/shop/components/bandwidth-cell.vue'
import { useColumns as _useColumns, setColumns } from '/@/hooks/useColumns'
import { usePermission } from '/@/hooks/usePermission'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'
import { format } from 'date-fns'
import { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums/proxy'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'

export function getRelatedProfileLabels(data: Record<string, any>) {
  const workspaceName = getWorkspaceNamePrefix(useWorkspaceStore().currentWorkspace?.workspaceName)
  return (data.bindList ?? []).map((id: string | number) => `${workspaceName}-${id}`)
}

export function getRawColumns(options?: any) {
  const { check } = usePermission()

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
      slot: 'expireDate',
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
      title: $t('带宽'),
      key: 'bandwidth',
      sortable: true,
      slot: 'bandwidth',
      render: ({ data }: any) => <BandwidthCell data={data}></BandwidthCell>,
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
      slot: 'bindList',
      style: {
        minWidth: '120px',
      },
    },
    {
      title: $t('IP 用途'),
      key: 'businessUse',
    },
    {
      title: $t('IP 查询渠道'),
      key: 'ipChecker',
      render: ({ data }: any) => <RxTag tooltip={$t('为保障测试结果统一，暂时仅支持官方指定的查询渠道。')} icon="base/rx_ic_network" label={data.checkChannelValue} disabled={true}></RxTag>,
    },
    {
      title: $t('来源'),
      key: 'proxyType',
      sortable: true,
      getText: (data: any) => data.proxyType === ProxyType.buy ? $t('购买') : $t('添加'),
    },
    {
      title: $t('状态'),
      key: 'proxyExpireStatus',
      _visible: false,
      render: ({ data }: any) => {
        const ExpireStatusMap = {
          [ProxyExpireStatus.expired]: { text: $t('已过期'), color: 'var(--colors-text-text-inactive)' },
          [ProxyExpireStatus.using]: { text: $t('使用中'), color: 'var(--colors-text-text-success)' },
          [ProxyExpireStatus.soon]: { text: $t('即将过期'), color: 'var(--colors-text-text-warning)' },
        } as const

        const OrderStatusMap = {
          [ProxyOrderStatus.pending]: { text: $t('配置中, 预计 {time} 分钟内完成', { time: 2 }), color: 'var(--colors-text-text-primary)' },
          [ProxyOrderStatus.refunding]: { text: $t('退款中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
          [ProxyOrderStatus.changing]: { text: $t('更换中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
          [ProxyOrderStatus.refunded]: { text: $t('已退款'), color: 'var(--colors-text-text-inactive)' },
        }

        const status = OrderStatusMap[data.orderStatus as keyof typeof OrderStatusMap] || ExpireStatusMap[data.proxyExpireStatus as keyof typeof ExpireStatusMap] || { text: '', color: '' }
        return <div class="text-3 font-500 leading-4" style={{ color: status.color }}>{status.text}</div>
      },
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
    key: 'proxy_display_v1',
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
