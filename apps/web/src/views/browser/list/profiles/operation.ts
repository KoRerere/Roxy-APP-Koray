import { format } from 'date-fns'
import { API } from '/@/api'
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'

const workspaceStore = useWorkspaceStore()

export function tableFilters(_params: any = {}) {
  return [
    // {
    //   type: 'select',
    //   label: ' ',
    //   name: 'match',
    //   value: params.match ?? 'every',
    //   options: [
    //     { label: 'Match Every', value: 'every' },
    //     { label: 'Match Any', value: 'any' },
    //   ],
    // },
  ]
}

export async function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  const [{ data: platformList }, { data: labelList }, { data: projectList }] = await Promise.all([
    API.platform.userGetPlatformInfoV2List({ page_index: 1, page_size: 999 }),
    API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' }),
    API.limit.userGetProjectInfoByWorkspaceList({ role: workspaceStore.currentWorkspace?.role }),
  ])

  const inputs = [
    {
      type: 'text',
      name: 'windowName',
      label: '窗口名称',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'number',
      label: '窗口序号',
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: '操作系统',
      name: 'osList',
      icon: 'base/rx_ic_laptop',
      options: ($dict_map.os || []).map((item: any) => ({
        parentName: 'osList',
        value: item.value,
        label: item.label,
      })),
    },
    {
      type: 'Checkbox',
      name: 'platformUrlIds',
      label: '账号平台',
      icon: 'base/rx_ic_keys',
      options: platformList.rows.map((item: any) => ({
        parentName: 'platformUrlIds',
        value: `${item.id}`,
        label: new URL(item.platformUrl).hostname,
      })),
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      name: 'openStatus',
      label: '窗口状态',
      options: [
        {
          icon: 'base/rx_ic_browsers_line',
          label: '窗口打开',
          value: true,
        },
        {
          icon: 'base/rx_ic_browsers_line',
          label: '窗口关闭',
          value: false,
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      name: 'projectIds',
      label: '项目',
      icon: 'base/rx_ic_stack',
      options: projectList.rows.map((item: any) => ({
        parentName: 'projectIds',
        value: `${item.project_id}`,
        label: item.projectName,
      })),
    },
    {
      type: 'Checkbox',
      name: 'labelIds',
      label: '窗口标签',
      icon: 'base/rx_ic_tag',
      options: labelList.rows.map((item: any) => ({
        parentName: 'labelIds',
        value: `${item.id}`,
        label: item.name,
      })),
    },
    {
      separator: true,
    },
    {
      type: 'switch',
      name: 'isOften',
      label: '窗口收藏',
      icon: 'base/rx_ic_bookmark',
    },
    {
      type: 'textarea',
      label: '窗口备注',
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      separator: true,
    },
    {
      type: 'text',
      label: '关联代理ID',
      name: 'proxyIds',
      placeholder: '多个代理ID逗号分隔',
      icon: 'base/rx_ic_internet',
    },
    {
      type: 'Checkbox',
      name: 'proxyProtocoList',
      label: '代理协议',
      icon: 'base/rx_ic_internet_pin',
      options: ($dict_map.protocol || []).map((item: any) => ({
        parentName: 'proxyProtocoList',
        value: item.value,
        label: item.label,
      })),
    },
    {
      type: 'radio',
      name: 'proxyTestStatus',
      label: '检测状态',
      options: [
        {
          icon: 'base/rx_ic_internet_check',
          label: '检测成功的代理',
          value: '1',
        },
        {
          icon: 'base/rx_ic_internet_error',
          label: '检测失败的代理',
          value: '2',
        },
      ],
    },
    {
      separator: true,
    },
    {
      type: 'date',
      name: 'createTime',
      label: '窗口创建时间',
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: '请选择开始时间',
          name: 'startDate',
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: '请选择结束时间',
          name: 'endDate',
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
      ],
    },
  ].map((input: any) => {
    if (input.type === 'date') {
      input.value = params.startDate && params.endDate ? [params.startDate, params.endDate].join('~') : undefined
      input.items.forEach((it: any) => it.value = params[it.name])
    }
    else {
      input.value = params[input.name]
    }
    return input
  })

  return inputs
}

export function getSorts(params: any = {}) {
  return [
    {
      label: '排序规则',
      placeholder: '请选择排序规则',
      name: 'orderName',
      value: params.orderName ?? 'createTime',
      options: [
        { label: '创建时间', value: 'createTime' },
        { label: '修改时间', value: 'updateTime' },
        { label: '最后打开时间', value: 'openTime' },
        { label: '最后关闭时间', value: 'closeTime' },
        { label: '代理检测时间', value: 'checkTime' },
        { label: '窗口序号', value: 'windowSortNum' },
        { label: '窗口名称', value: 'name' },
        { label: '国家', value: 'lastCountry' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
    {
      label: '排序类型',
      placeholder: '请选择排序类型',
      name: 'orderType',
      value: params.orderType ?? 'desc',
      options: [
        { label: '降序', value: 'desc' },
        { label: '升序', value: 'asc' },
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
      label: '编辑',
      icon: 'base/rx_ic_edit',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'view',
      label: 'view',
      icon: 'base/rx_ic_eye',
    },
    {
      name: 'restart',
      label: '重启',
      icon: 'base/rx_ic_refresh',
      multiple: true,
      groupName: 'first',
    },
    {
      name: 'close',
      label: '关闭',
      icon: 'base/rx_ic_shut_down',
      multiple: true,
      groupName: 'first',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'fav',
      label: '收藏',
      icon: 'base/rx_ic_bookmark',
      multiple: true,
    },
    {
      name: 'addNotes',
      label: '新增笔记',
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
      label: '编辑cookies',
      icon: 'base/rx_ic_edit',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'delete',
      label: '删除',
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
