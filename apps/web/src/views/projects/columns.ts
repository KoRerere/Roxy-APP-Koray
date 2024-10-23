import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'
import { $t } from '/@/locales'

const columnsConfig = {
  key: 'project.list',
  data: [
    {
      title: $t('Profile Info'),
      key: 'projectName',
    },
    {
      title: $t('Open'),
      key: 'open',
      slot: 'open',
    },
    {
      title: $t('Members'),
      slot: 'members',
    },
    {
      title: $t('Actions'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
