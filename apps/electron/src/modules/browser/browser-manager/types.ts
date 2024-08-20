import type { UserAddWindowInfoCreatePayload, UserGetWindowInfoListData } from '@roxy/backend-api'

export type WindowItemType = UserGetWindowInfoListData['data']['rows'][number] & UserAddWindowInfoCreatePayload
