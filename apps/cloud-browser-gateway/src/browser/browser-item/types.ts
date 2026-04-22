import type { UnwrapRowType, UserAddWindowInfoV2CreatePayload, UserGetWindowInfoV2ListData } from '@roxy/backend-api'

export type WindowItemType = UnwrapRowType<UserGetWindowInfoV2ListData> & UserAddWindowInfoV2CreatePayload
