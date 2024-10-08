import type { UnwrapRowsType, UserGetProjectInfoByWorkspaceListData } from '@roxy/backend-api'
import { defineStore } from 'pinia'
import { useToast } from 'primevue/usetoast'
import { ref } from 'vue'
import { API } from '/@/api'
import { $t } from '/@/locales'

type InviteInfo = Record<'workspaceName' | 'workspacePicture' | 'endTime' | 'data', string>

export const useProjectStore = defineStore('project', () => {
  const inviteInfo = ref<InviteInfo>()
  const projects = ref<UnwrapRowsType<UserGetProjectInfoByWorkspaceListData>>([])
  let getProjectPromise: Promise<UserGetProjectInfoByWorkspaceListData> | null = null

  const toast = useToast()

  window.electronAPI.on('invite:to-project', async (searchStr) => {
    console.log('invite:to-project', searchStr)
    // 替换加号为 %2B，然后使用 URLSearchParams
    const queryString = searchStr.replace(/\+/g, '%2B')
    const params = new URLSearchParams(queryString)
    inviteInfo.value = Object.fromEntries(params) as InviteInfo

    console.log('inviteInfo: ', inviteInfo.value)

    if (inviteInfo.value.data) {
      console.log('invite:to-project code', inviteInfo.value.data)
    }
    else {
      console.error('invite:to-project code is null')
    }
  })

  /** 接受邀请 */
  async function acceptInvitation() {
    if (!inviteInfo.value?.data) {
      toast.add({ severity: 'error', summary: 'Error', detail: 'Invite code is null', life: 3000 })
      return
    }
    const { code, msg } = await API.limit.userAddUserByProjectInfoCreate(inviteInfo.value.data)
    if (code === 0) {
      toast.add({ severity: 'success', summary: 'Success', detail: $t(''), life: 3000 })
    }
    else {
      toast.add({ severity: 'error', summary: 'Error', detail: msg, life: 3000 })
    }
  }

  const getProjects = async () => {
    getProjectPromise ??= API.limit.userGetProjectInfoByWorkspaceList()
    const result = await getProjectPromise.finally(() => {
      getProjectPromise = null
    })
    projects.value = result.data.rows
    return result
  }

  return { projects, getProjects, acceptInvitation }
})
