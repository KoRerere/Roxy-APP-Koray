import RelatedInfo from '/@/components/related-info.vue'
import RxTag from '/@/components/rx-tag.vue'
import { $t } from '/@/locales'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'

const columnsConfig = {
  key: 'agent.list',
  data: [
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
          <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} lastIp={data.lastIp} time={data.checkTime} />
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
        console.log('🚀 ~ data.bindList:', data.bindList)

        return (
          <RelatedInfo list={data.bindList}></RelatedInfo>
        )
      },
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
