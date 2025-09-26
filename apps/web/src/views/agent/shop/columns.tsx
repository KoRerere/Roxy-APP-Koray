import RelatedInfo from '/@/components/related-info.vue'
import BasicInfo from '/@/views/agent/list/components/basic-info.vue'
import RxTag from '/@/components/rx-tag.vue'
import ExpireDate from '/@/views/agent/shop/components/expire-date.vue'
import currency from 'currency.js';
import { setColumns, useColumns as _useColumns } from '/@/hooks/useColumns'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useUserStore } from '/@/stores/user'
import { format } from 'date-fns'

export function getRawColumns(options?: any) {
  const workspaceName = useWorkspaceStore().currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()
  return setColumns([
    {
      title: $t('代理信息'),
      key: 'proxy',
      _visible: false,
      render: ({ data }: any) => <div class="text-3 font-[JetBrains_Mono]">{data.host ? `${data.host}:${data.port}:${data.proxyUserName}:${data.proxyPassword}` : '--'}</div>,
    },
    {
      title: $t('出口 IP'),
      key: 'lastCountry',
      sortable: true,
      slot: 'outbound'
    },
    {
      title: $t('到期时间'),
      key: 'expireDate',
      sortable: true,
      render: ({ data }: any) => <ExpireDate data={data}></ExpireDate>,
    },
    {
      title: $t('订单号'),
      key: 'orderNo',
      _visible: false,
    },
    {
      title: $t('创建时间'),
      key: 'createTime',
      _visible: false,
      getText: (data: any) => data.createTime ? format(data.createTime, 'yyyy-MM-dd') : '--',
    },
    {
      title: $t('续费时间'),
      key: 'renewalTime',
      _visible: false,
      getText: (data: any) => data.renewalTime ? format(data.renewalTime, 'yyyy-MM-dd') : '--',
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
      }
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
      title: $t('已关联窗口'),
      key: 'bindList',
      render: ({ data }: any) => {
        const list = data.bindList.map((id: number) => `${workspaceName}-${id}`)
        return <RelatedInfo list={list}></RelatedInfo>
      },
    },
    {
      title: $t('服务商'),
      key: 'proxyProviderName',
      getText: (data: any) => data.proxyProviderName || $t('官方赠送'),
      sortable: true,
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
      alignFrozen: 'right',
    },
  ], options)
}

export function useColumns(options?: any) {
  const { userConfig } = storeToRefs(useUserStore())

  const { columns, updateColumns, updateRemarkDisplayStatus } = _useColumns({
    key: 'agent.shop',
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
