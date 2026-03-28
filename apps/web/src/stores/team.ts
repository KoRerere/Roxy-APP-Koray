import type { UnwrapRowsType, UserGetMemberInfoByWorkspaceListData, UserGetMemberInfoByWorkspaceListParams } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { API } from '/@/api'

export const useTeamStore = defineStore('team', () => {
  const members = ref<UnwrapRowsType<UserGetMemberInfoByWorkspaceListData>>([])
  let getTeamMembersPromise: Promise<UserGetMemberInfoByWorkspaceListData> | null = null

  async function getTeamMembers(params: UserGetMemberInfoByWorkspaceListParams = {}) {
    getTeamMembersPromise ??= API.team.userGetMemberInfoByWorkspaceList(params)
    const data = await getTeamMembersPromise.finally(() => {
      getTeamMembersPromise = null
    })

    data.data.rows.forEach((item) => {
      Reflect.set(item, '_userName', item.userName)
      Reflect.set(item, 'userName', item.nickname || item.userName)
    })

    members.value = data.data.rows

    return data
  }

  return { members, getTeamMembers }
})
