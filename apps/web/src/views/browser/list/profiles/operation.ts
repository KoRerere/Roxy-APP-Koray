import { format } from 'date-fns'
import { API } from '/@/api'
import { Role } from '/@/enums'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { setInputValueByFormData } from '/@/utils'

const workspaceStore = useWorkspaceStore()

export function tableFilters(_params: any = {}) {
  return [
    {
      type: 'multiple',
      name: 'operateModule',
      value: ['Profiles'],
      placeholder: $t('全部操作'),
      disabled: true,
      options: [
        { label: $t('匹配所有'), value: 'Profiles' },
      ],
    },
  ]
}

export async function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  const inputs = [
    {
      type: 'text',
      label: $t('窗口名称'),
      placeholder: $t('请输入窗口名称'),
      name: 'windowName',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'number',
      label: $t('序号'),
      placeholder: $t('请输入序号'),
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: $t('操作系统'),
      name: 'osList',
      icon: 'base/rx_ic_laptop',
      getOptions: () => {
        return ($dict_map.os || []).map((item: any) => ({
          parentName: 'osList',
          value: item.value,
          label: item.label,
        }))
      },
    },
    {
      type: 'Checkbox',
      name: 'platformUrlIds',
      label: $t('业务平台'),
      icon: 'base/rx_ic_keys',
      getOptions: async () => {
        const { data } = await API.platform.userGetPlatformInfoV2List({ page_index: 1, page_size: 999 })
        return data.rows.map((item: any) => ({
          parentName: 'platformUrlIds',
          value: `${item.id}`,
          label: new URL(item.platformUrl).hostname.replace(/.*\.(.*?)\..*/, '$1'),
        }))
      },
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      name: 'projectIds',
      label: $t('项目'),
      icon: 'base/rx_ic_stack',
      getOptions: async () => {
        const { data } = await API.limit.userGetProjectInfoByWorkspaceList({ default: 2 })
        return data.rows.map((item: any) => ({
          parentName: 'projectIds',
          value: `${item.project_id}`,
          label: item.projectName,
        }))
      },
    },
    {
      type: 'Checkbox',
      name: 'labelIds',
      label: $t('标签'),
      icon: 'base/rx_ic_tag',
      getOptions: async () => {
        const [{ data: labelList }, { data: memberList }] = await Promise.all([
          await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' }),
          await API.team.userGetMemberInfoByWorkspaceList({}),
        ])

        const menbers = memberList.rows.map((item: any) => ({
          parentName: 'labelIds',
          value: `u_${item.user_id}`,
          label: item.userName,
          avatar: item.avatar,
          avatarColor: item.avatarColor,
        }))
        console.log('🚀 ~ menbers ~ menbers:', menbers)

        const labels = labelList.rows.map((item: any) => ({
          parentName: 'labelIds',
          value: `${item.id}`,
          label: item.name,
        }))

        return menbers.concat(labels as any)
      },
    },
    {
      separator: true,
    },
    {
      type: 'textarea',
      label: $t('备注'),
      placeholder: $t('请输入备注'),
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      separator: true,
    },
    {
      type: 'date',
      name: 'createTime',
      label: $t('创建时间'),
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: $t('开始时间'),
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: $t('结束时间'),
          name: 'endDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
    {
      type: 'date',
      name: '#createTime',
      label: $t('修改时间'),
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: $t('开始时间'),
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: $t('结束时间'),
          name: 'endDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ]

  setInputValueByFormData(inputs, {
    ...params,
    createTime: params.startDate && params.endDate ? [params.startDate, params.endDate].join('~') : undefined,
  })

  return inputs
}

export function getSorts(params: any = {}) {
  return [
    {
      label: $t('排序标准'),
      placeholder: $t('please select sorting rules'),
      name: 'orderName',
      value: params.orderName ?? 'createTime',
      options: [
        { label: $t('创建时间'), value: 'createTime' },
        { label: $t('修改时间'), value: 'updateTime' },
        { label: $t('最后打开时间'), value: 'openTime' },
        { label: $t('最后关闭时间'), value: 'closeTime' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
    {
      label: $t('排序方式'),
      placeholder: $t('please select sort type'),
      name: 'orderType',
      value: params.orderType ?? 'desc',
      options: [
        { label: $t('倒序'), value: 'desc' },
        { label: $t('正序'), value: 'asc' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
  ]
}

export function getOperation(_params: any = {}) {
  const isViewer = (workspaceStore.currentWorkspace?.role ?? -1) <= Role.VIEWER

  return [
    {
      name: 'edit',
      label: $t('编辑窗口'),
      icon: 'base/rx_ic_edit',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'view',
      label: $t('查看窗口'),
      icon: 'base/rx_ic_browser',
    },
    {
      name: 'restart',
      label: $t('重启窗口'),
      icon: 'base/rx_ic_refresh',
      multiple: true,
      groupName: 'first',
    },
    {
      name: 'close',
      label: $t('关闭窗口'),
      icon: 'base/rx_ic_shut_down',
      multiple: true,
      groupName: 'first',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'addNotes',
      label: $t('添加备注'),
      icon: 'base/rx_ic_doc_add',
      multiple: true,
    },
    {
      power: !isViewer,
      separator: true,
      multiple: true,
    },
    {
      name: 'editCookies',
      label: $t('编辑 Cookies'),
      icon: 'base/rx_ic_cookies',
      power: !isViewer,
    },
    {
      name: 'copyId',
      label: $t('复制窗口 ID'),
      icon: 'base/rx_ic_copy',
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'delete',
      label: $t('删除窗口'),
      icon: 'base/rx_ic_bin_1',
      power: !isViewer,
      multiple: true,
    },
  ]
}

export default {
  tableFilters,
  getCustomFilters,
  getSorts,
  getOperation,
}
