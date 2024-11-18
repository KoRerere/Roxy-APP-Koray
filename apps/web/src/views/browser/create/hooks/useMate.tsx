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
    return data.rows.map(item => ({
      name: item.name,
      label: item.name,
      value: `${item.id}`,
      render: () => (
        <div class="flex items-center flex-1 overflow-hidden">
          <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" fill={item.color} />
          </svg>
          <span class="ellipsis-1" title={item.name}>{item.name}</span>
        </div>
      ),
    }))
  }

  async function getProjects(): Promise<Operation[]> {
    const { data } = await API.limit.userGetProjectInfoByWorkspaceList({})
    return data.rows.map(item => ({ label: item.projectName, value: `${item.project_id}` }))
  }

  async function getProjectMember(projectId: number): Promise<Operation[]> {
    const { data } = await API.limit.userGetMemberInfoByProjectIdList({ projectId })
    return data.rows.map(item => ({
      value: `u_${item.userId}`,
      render: () => {
        return (
          <div class="flex items-center gap-1">
            <RxAvatar avatar={item.avatar} size={24} fontSize={12} name={item.userName?.slice(0, 2)} color={item.avatarColor} />
            <div class="ellipsis-1">{item.userName}</div>
          </div>
        )
      },
    }))
  }

  return { getTags, getProjects, getProjectMember }
}
