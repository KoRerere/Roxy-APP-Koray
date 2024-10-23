import type { UnwrapRowType, UserGetPlatformInfoV2ListData } from '@roxy/backend-api'
import { $t } from '/@/locales'

const columnsConfig = {
  key: 'project.list',
  data: [
    {
      title: $t('项目信息'),
      key: 'projectName',
      slot: 'projectName',
    },
    {
      title: $t('成员'),
      slot: 'members',
    },
    {
      title: $t('其他'),
      style: 'width: 9rem',
      slot: 'actions',
    },
  ],
}

export default columnsConfig
