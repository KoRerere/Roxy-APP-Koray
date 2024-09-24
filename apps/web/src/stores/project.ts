import type { UnwrapRowsType, UserGetProjectInfoByWorkspaceListData, UserGetProjectInfoByWorkspaceListParams } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<UnwrapRowsType<UserGetProjectInfoByWorkspaceListData>>([])
  let getProjectPromise: Promise<UserGetProjectInfoByWorkspaceListData> | null = null

  const getProjects = async (query: UserGetProjectInfoByWorkspaceListParams) => {
    getProjectPromise ??= API.limit.userGetProjectInfoByWorkspaceList(query)
    const result = await getProjectPromise.finally(() => {
      getProjectPromise = null
    })
    projects.value = result.data.rows
    return result
  }

  return { projects, getProjects }
})
