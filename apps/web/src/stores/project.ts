import type { UnwrapRowsType, UserGetTopProjectInfoListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { API } from '/@/api'

export const useProjectStore = defineStore('project', () => {
  const projects = ref<UnwrapRowsType<UserGetTopProjectInfoListData>>([])
  let getProjectPromise: Promise<UserGetTopProjectInfoListData> | null = null

  const getProjects = async () => {
    getProjectPromise ??= API.limit.userGetTopProjectInfoList()
    const result = await getProjectPromise.finally(() => {
      getProjectPromise = null
    })
    projects.value = result.data.rows
    return result
  }

  return { projects, getProjects }
})
