import { format } from 'date-fns'
import { API } from '/@/api'
import { Role } from '/@/enums'
import { useWorkspaceStore } from '/@/stores/workspace'
import { setInputValueByFormData } from '/@/utils'

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
    API.limit.userGetProjectInfoByWorkspaceList(),
  ])

  const inputs = [
    {
      type: 'text',
      name: 'windowName',
      label: 'Name',
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'number',
      label: 'Nums',
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: 'System',
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
      label: 'Account',
      icon: 'base/rx_ic_keys',
      options: platformList.rows.map((item: any) => ({
        parentName: 'platformUrlIds',
        value: `${item.id}`,
        label: new URL(item.platformUrl).hostname.replace(/.*\.(.*?)\..*/, '$1'),
      })),
    },
    {
      separator: true,
    },
    {
      type: 'radio',
      name: 'openStatus',
      label: 'Status',
      options: [
        {
          icon: 'base/rx_ic_browsers_line',
          label: 'Status Open',
          value: true,
        },
        {
          icon: 'base/rx_ic_browsers_line',
          label: 'Status Close',
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
      label: 'Project',
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
      label: 'Tag',
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
      label: 'Fav',
      icon: 'base/rx_ic_bookmark',
    },
    {
      type: 'textarea',
      label: 'Notes',
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      separator: true,
    },
    {
      type: 'text',
      label: 'Proxy ID',
      name: 'proxyIds',
      placeholder: 'multiple proxy id comma separation',
      icon: 'base/rx_ic_internet',
    },
    {
      type: 'Checkbox',
      name: 'proxyProtocoList',
      label: 'Proxy Protocol',
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
      label: 'Check Status',
      options: [
        {
          icon: 'base/rx_ic_internet_check',
          label: 'Test Success',
          value: '1',
        },
        {
          icon: 'base/rx_ic_internet_error',
          label: 'Test Failed',
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
      label: 'Cteate Time',
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: 'start date',
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: 'end date',
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
      label: 'Edit',
      icon: 'base/rx_ic_edit',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'copyId',
      label: 'Copy profile ID',
      icon: 'base/rx_ic_copy',
    },
    {
      separator: true,
    },
    {
      name: 'view',
      label: 'View',
      icon: 'base/rx_ic_browser',
    },
    {
      name: 'restart',
      label: 'Restart',
      icon: 'base/rx_ic_refresh',
      multiple: true,
      groupName: 'first',
    },
    {
      name: 'close',
      label: 'Close',
      icon: 'base/rx_ic_shut_down',
      multiple: true,
      groupName: 'first',
    },
    {
      separator: true,
      multiple: true,
    },
    {
      name: 'addTag',
      label: 'Add Tag',
      icon: 'base/rx_ic_tag',
    },
    {
      separator: true,
    },
    {
      name: 'fav',
      label: 'Fav',
      icon: 'base/rx_ic_bookmark',
    },
    {
      name: 'addNotes',
      label: 'Add Notes',
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
      label: 'Edit cookies',
      icon: 'base/rx_ic_cookies',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'delete',
      label: 'Delete',
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
