import RxTag from '/@/components/rx-tag.vue'
import { createProxyCreateLabels } from '../proxy-create-mode'
import type { ProxyCreateLabels } from '../proxy-create-mode'

/** 批量导入表格列；电商（device）模式在密码列后追加风险评级 */
export function getColumns(labels: ProxyCreateLabels = createProxyCreateLabels('proxy')) {
  const baseColumns = [
    {
      key: 'protocol',
      title: labels.protocolColumnTitle,
      getText: (data: any) => data.protocol || '--',
    },
    {
      key: 'host',
      title: labels.host,
      getText: (data: any) => data.host || '--',
    },
    {
      key: 'port',
      title: labels.port,
      getText: (data: any) => data.port || '--',
    },
    {
      key: 'proxyUserName',
      title: labels.username,
      getText: (data: any) => data.proxyUserName || '--',
    },
    {
      key: 'proxyPassword',
      title: labels.password,
      getText: (data: any) => data.proxyPassword || '--',
    },
  ]

  const riskRatingColumn = {
    key: 'riskRating',
    title: $t('风险评级'),
    slot: 'riskRating',
  }

  // 电商模式无刷新 URL 能力，不展示该列
  const refreshUrlColumn = labels.mode === 'device'
    ? []
    : [{
        key: 'refreshUrl',
        title: labels.refreshUrl,
        width: 100,
        getText: (data: any) => data.refreshUrl || '--',
      }]

  const tailColumns = [
    ...refreshUrlColumn,
    {
      key: 'remark',
      title: $t('备注'),
      width: 100,
      getText: (data: any) => data.remark || '--',
    },
    {
      title: $t('出口 IP'),
      slot: 'outbound',
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
      title: $t('操作'),
      slot: 'actions',
      alignFrozen: 'right',
    },
  ]

  return labels.mode === 'device'
    ? [...baseColumns, riskRatingColumn, ...tailColumns]
    : [...baseColumns, ...tailColumns]
}
