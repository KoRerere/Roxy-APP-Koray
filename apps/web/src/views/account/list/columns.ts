import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'
import { $t } from '/@/locales'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

const columnsConfig = {
  key: 'account.list',
  data: [
    {
      title: $t('Platform & Password'),
      key: 'status',
      disabledToggle: true,
      slot: 'platform',
    },
    {
      title: $t('Alias'),
      key: 'link',
      getText: (data: Data) => data.platformName || '--',
    },
    {
      title: $t('Related Profiles'),
      slot: 'related',
    },
    {
      title: $t('Actions'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
