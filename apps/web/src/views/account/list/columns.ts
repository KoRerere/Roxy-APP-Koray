import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'
import { $t } from '/@/locales'

type Data = UnwrapRowType<UserGetPlatformInfoV2ListData>

const columnsConfig = {
  key: 'account.list',
  data: [
    {
      title: $t('账号信息'),
      key: 'status',
      disabledToggle: true,
      slot: 'platform',
    },
    {
      title: $t('备注'),
      key: 'link',
      getText: (data: Data) => data.platformName || '--',
    },
    {
      title: $t('已关联窗口'),
      slot: 'related',
    },
    {
      title: $t('操作'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
