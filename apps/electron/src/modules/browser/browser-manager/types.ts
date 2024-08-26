import type { UnwrapRowType, UserAddWindowInfoCreatePayload, UserGetWindowInfoListData } from '@roxy/backend-api'

export type WindowItemType = UnwrapRowType<UserGetWindowInfoListData> & UserAddWindowInfoCreatePayload
