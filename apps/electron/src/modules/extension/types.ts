import type { UnwrapRowType, UserGetPluginListListData } from '@roxy/backend-api'

export type CheckLocalExtensionUpdatePayload = { extID: string, newVersion: string }[]

export type UploadExtensionToOSSResult = Pick<UnwrapRowType<UserGetPluginListListData>, 'pluginIcon' | 'pluginRoute' | 'pluginDir'>
