import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'

const columnsConfig = {
  key: 'project.list',
  data: [
    {
      title: 'Profile Info',
      key: 'projectName',
    },
    {
      title: 'Open',
      key: 'open',
      slot: 'open',
    },
    {
      title: 'Members',
      slot: 'members',
    },
  ],
}

export default columnsConfig
