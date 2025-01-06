import type { UnwrapRowsType, UserAddUserByProjectInfoCreatePayload, UserGetNotifyListData } from '@roxy/backend-api'
import mitt from 'mitt'

/* eslint-disable ts/consistent-type-definitions */
type Events = {
  viewInviteDetail: UserAddUserByProjectInfoCreatePayload,
  notifyUpdateData: UserGetNotifyListData,
  maxWindowCountChange?: number
}

export const emitter = mitt<Events>()
