import { API } from '/@/api'
import RxAvatar from '/@/components/rx-avatar'

interface Operation {
  name?: string
  label?: string
  value: string
  render?: () => any
}

export function useMateGroup() {
  async function getTags(): Promise<Operation[]> {
    const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
    return data.rows.map(item => ({ name: item.name, label: item.name, value: `${item.id}` }))
  }

  async function getProjects(): Promise<Operation[]> {
    const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
    return data.rows.map(item => ({ label: item.projectName, value: `${item.project_id}` }))
  }

  async function getProjectMember(projectId: number): Promise<Operation[]> {
    const { data } = await API.limit.userGetMemberInfoByProjectIdList({ projectId })
    return data.rows.map(item => ({
      value: `u_${item.userId}`,
      render: () => {
        return (<RxAvatar avatar={item.avatar} size={24} fontSize={12} name={item.userName?.slice(0, 2)} color={item.avatarColor} />)
      },
    }))
  }

  return { getTags, getProjects, getProjectMember }
}
