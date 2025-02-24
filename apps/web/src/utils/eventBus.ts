import type { UnwrapRowsType, UserAddUserByProjectInfoCreatePayload, UserGetNotifyListData } from '@roxy/backend-api'
import mitt from 'mitt'

export type MittEvents = {
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

export const emitter = mitt<MittEvents>()
