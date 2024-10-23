import RelatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RyTag from '/@/components/ry-tag'
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
          <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} time={data.checkTime} />
        )
      },
    },
    {
      title: $t('IP 查询渠道'),
      key: 'ipChecker',
      render: ({ data }: any) => {
        return (
          <RyTag severity="info">
            <RxSvgIcon name="base/rx_ic_network" />
            <span class="text-3">{data.checkChannelValue}</span>
          </RyTag>
        )
      },
    },
    {
      title: $t('已关联窗口'),
      key: 'relatedProfiles',
      render: ({ data }: any) => {
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
