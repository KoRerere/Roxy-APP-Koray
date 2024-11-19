import type { UserAddUserByProjectInfoCreatePayload } from '@roxy/backend-api'
import mitt from 'mitt'

/* eslint-disable ts/consistent-type-definitions */
type Events = {
  viewInviteDetail: UserAddUserByProjectInfoCreatePayload
}

export const emitter = mitt<Events>()
