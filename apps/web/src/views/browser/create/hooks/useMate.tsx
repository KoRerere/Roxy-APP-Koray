import RxAvatar from '/@/components/rx-avatar'
import { API } from '/@/api'
import { ProfileReqType } from '/@/enums/permission'

interface Operation {
  name?: string
  label?: string
  value: string
  projectDefault?: number
  render?: () => any
}

/** 人员标签用 u_ 前缀，与普通标签 ID 区分 */
export function isMemberLabelId(labelId: unknown) {
  return `${labelId}`.startsWith('u_')
}

/**
 * 标签 ID 后台已改为 string。
 * 禁止 Number()：大整数会丢精度，非数字 ID 会变成 NaN。
 */
export function toLabelId(id: unknown) {
  return String(id)
}

/** 菜单选中值保持 string：人员为 u_${userId}，标签为原始 string id */
export function toSubmitLabelIds(selectedIds: unknown): string[] {
  if (!Array.isArray(selectedIds)) {
    return []
  }
  return selectedIds.map(id => toLabelId(id))
}

export function useMateGroup() {
  async function getTags(): Promise<Operation[]> {
    const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999', requestType: ProfileReqType.SelectLabel })
    return data.rows.map(item => ({
      name: item.name,
      label: item.name,
      value: `${item.id}`,
      _origin: item,
      render: () => (
        <div class="flex items-center flex-1 overflow-hidden">
          <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" fill={item.color} />
          </svg>
          <span class="ellipsis-1 text-3.25" title={item.name}>{item.name}</span>
        </div>
      ),
    }))
  }

  async function getProjects(): Promise<Operation[]> {
    const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
    return data.rows.map(item => ({ label: item.projectName, value: `${item.project_id}`, projectDefault: item.projectDefault, _origin: item }))
  }

  async function getProjectMember(projectId: string | number): Promise<Operation[]> {
    // 文档仍把 projectId 标成 number。断言不改运行时值，避免 Number() 截断大整数
    const { data } = await API.limit.userGetMemberInfoByProjectIdList({ projectId: projectId as number })
    return data.rows.map(item => ({
      value: `u_${item.userId}`,
      _origin: item,
      render: () => {
        return (
          <div class="flex items-center gap-1">
            <RxAvatar avatar={item.avatar} size={24} fontSize={12} name={item.userName?.slice(0, 2)} color={item.avatarColor} />
            <div class="ellipsis-1 text-3.25">{item.userName}</div>
          </div>
        )
      },
    }))
  }

  return { getTags, getProjects, getProjectMember }
}
