import type { UnwrapRowsType, UserAddUserByProjectInfoCreatePayload, UserGetNotifyListData } from '@roxy/backend-api'
import mitt from 'mitt'

/* eslint-disable ts/consistent-type-definitions */
type Events = {
  viewInviteDetail: UserAddUserByProjectInfoCreatePayload,
  notifyUpdateData: UserGetNotifyListData,
  maxWindowCountChange?: number
  showRoxyOperationNotice?: void
  /** 被挤号 */
  kickedOut?: {
    deviceName: string
    createTime: string
  }
}

export const emitter = mitt<Events>()
