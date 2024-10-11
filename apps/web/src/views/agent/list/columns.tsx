import RelatedInfo from '/@/components/related-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RyTag from '/@/components/ry-tag'
import OutboundIp from '/@/views/agent/list/components/outbound-ip.vue'

const columnsConfig = {
  key: 'agent.list',
  data: [
    {
      title: 'Proxy Info',
      key: 'proxy',
      slot: 'proxy',
    },
    {
      title: 'Outbound IP',
      key: 'outbound',
      render: ({ data }: any) => {
        return (
          <OutboundIp image={data.region} country={data.lastCountry} city={data.lastCity} time={data.checkTime} />
        )
      },
    },
    {
      title: 'IP Checker',
      key: 'ipChecker',
      render: ({ data }: any) => {
        return (
          <RyTag severity="info">
            <RxSvgIcon name="base/rx_ic_earth" />
            <span>{data.checkChannel}</span>
          </RyTag>
        )
      },
    },
    {
      title: 'Related Profiles',
      key: 'relatedProfiles',
      render: ({ data }: any) => {
        return (
          <RelatedInfo list={data.bindList}></RelatedInfo>
        )
      },
    },
  ],
}

export default columnsConfig
