import RelatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RyTag from '/@/components/ry-tag'
import { $t } from '/@/locales'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'

const columnsConfig = {
  key: 'agent.list',
  data: [
    {
      title: $t('Proxy Info'),
      key: 'proxy',
      slot: 'proxy',
    },
    {
      title: $t('Outbound IP'),
      key: 'outbound',
      render: ({ data }: any) => {
        return (
          <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} time={data.checkTime} />
        )
      },
    },
    {
      title: $t('IP Checker'),
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
      title: $t('Related Profiles'),
      key: 'relatedProfiles',
      render: ({ data }: any) => {
        return (
          <RelatedInfo list={data.bindList}></RelatedInfo>
        )
      },
    },
    {
      title: $t('Actions'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
