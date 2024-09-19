import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

const columnsConfig = {
  key: 'account.list',
  data: [
    {
      title: 'Platform & Password',
      key: 'status',
      slot: 'platform',
    },
    {
      title: 'Alias',
      key: 'link',
      getText: (data: Data) => data.platformName || '--',
    },
    {
      title: 'Related Profiles',
      slot: 'related',
    },
  ],
}

export default columnsConfig
