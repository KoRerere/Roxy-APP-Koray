
import RxTag from '/@/components/rx-tag.vue'

export const getColumns = () => {
  return [
    {
      key: 'protocol',
      title: $t('代理 IP 类型'),
      getText: (data: any) => data.protocol || '--',
    },
    {
      key: 'host',
      title: $t('主机'),
      getText: (data: any) => data.host || '--',
    },
    {
      key: 'port',
      title: $t('端口'),
      getText: (data: any) => data.port || '--',
    },
    {
      key: 'proxyUserName',
      title: $t('用户名'),
      getText: (data: any) => data.proxyUserName || '--',
    },
    {
      key: 'proxyPassword',
      title: $t('密码'),
      getText: (data: any) => data.proxyPassword || '--',
    },
    {
      key: 'refreshUrl',
      title: $t('刷新 URL'),
      width: 100,
      getText: (data: any) => data.refreshUrl || '--',
    },
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
}
