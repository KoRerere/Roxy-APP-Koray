import type { UserGetMemberInfoByWorkspaceListParams } from '@roxy/backend-api'
import { API } from '/@/api'

export function useTeam() {
  async function getTeamMembers(params: UserGetMemberInfoByWorkspaceListParams = {}) {
    const data = await API.team.userGetMemberInfoByWorkspaceList(params)
    data.data.rows.forEach((item) => {
      Reflect.set(item, '_userName', item.userName)
      Reflect.set(item, 'userName', item.nickname || item.userName)
    })
    return data
  }

  return {
    getTeamMembers,
  }
}
