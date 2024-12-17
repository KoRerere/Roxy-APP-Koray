import type { UnwrapRowsType, UserAddUserByProjectInfoCreatePayload, UserGetAnntListListData } from '@roxy/backend-api'
import mitt from 'mitt'

/* eslint-disable ts/consistent-type-definitions */
type Events = {
  viewInviteDetail: UserAddUserByProjectInfoCreatePayload,
  anntListUpdateData: UnwrapRowsType<UserGetAnntListListData>,
}

export const emitter = mitt<Events>()
