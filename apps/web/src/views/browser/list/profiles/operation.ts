import { format } from 'date-fns'
import { API } from '/@/api'
import { Role } from '/@/enums'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { setInputValueByFormData } from '/@/utils'

const workspaceStore = useWorkspaceStore()

export function tableFilters(_params: any = {}) {
  return []
}

export async function getCustomFilters(params: any = {}) {
  const $dict_map = JSON.parse(localStorage.getItem('$dict_map') ?? '{}')

  const inputs = [
    {
      type: 'text',
      name: 'windowName',
      label: $t('Name'),
      icon: 'base/rx_ic_browser',
    },
    {
      type: 'number',
      label: $t('Nums'),
      name: 'sortNums',
      icon: 'base/rx_ic_id',
    },
    {
      separator: true,
    },
    {
      type: 'Checkbox',
      label: $t('System'),
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
      label: $t('Account'),
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
      type: 'switchGroup',
      name: 'openStatus',
      label: $t('Status'),
      options: [
        {
          icon: 'base/rx_ic_browsers_line',
          label: $t('Status Open'),
          value: true,
        },
        {
          icon: 'base/rx_ic_browsers_line',
          label: $t('Status Close'),
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
      label: $t('Project'),
      icon: 'base/rx_ic_stack',
      getOptions: async () => {
        const { data } = await API.limit.userGetProjectInfoByWorkspaceList()
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
      label: $t('Tag'),
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
      type: 'switch',
      name: 'isOften',
      label: $t('Fav'),
      icon: 'base/rx_ic_bookmark',
    },
    {
      type: 'textarea',
      label: $t('Notes'),
      name: 'windowRemark',
      icon: 'base/rx_ic_doc_article',
    },
    {
      separator: true,
    },
    {
      type: 'text',
      label: $t('Proxy ID'),
      name: 'proxyIds',
      placeholder: $t('multiple proxy id comma separation'),
      icon: 'base/rx_ic_internet',
    },
    {
      type: 'Checkbox',
      name: 'proxyProtocoList',
      label: $t('Proxy Protocol'),
      icon: 'base/rx_ic_internet_pin',
      getOptions: () => {
        return ($dict_map.protocol || []).map((item: any) => ({
          parentName: 'proxyProtocoList',
          value: item.value,
          label: item.label,
        }))
      },
    },
    {
      type: 'switchGroup',
      name: 'proxyTestStatus',
      label: $t('Check Status'),
      options: [
        {
          icon: 'base/rx_ic_internet_check',
          label: $t('Test Success'),
          value: '1',
        },
        {
          icon: 'base/rx_ic_internet_error',
          label: $t('Test Failed'),
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
      label: $t('Cteate Time'),
      icon: 'base/rx_ic_calendar',
      items: [
        {
          placeholder: $t('start date'),
          name: 'startDate',
          maxDate: new Date(),
          formatValue: (self: any) => {
            return self.value && format(self.value, 'yyyy-MM-dd')
          },
        },
        {
          placeholder: $t('end date'),
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
      label: $t('Sort by'),
      placeholder: $t('please select sorting rules'),
      name: 'orderName',
      value: params.orderName ?? 'createTime',
      options: [
        { label: $t('creation time'), value: 'createTime' },
        { label: $t('modify time'), value: 'updateTime' },
        { label: $t('last opening time'), value: 'openTime' },
        { label: $t('last closure time'), value: 'closeTime' },
        { label: $t('agent detection time'), value: 'checkTime' },
        { label: $t('window serial number'), value: 'windowSortNum' },
        { label: $t('window name'), value: 'name' },
        { label: $t('nation'), value: 'lastCountry' },
      ],
      icon: 'base/rx_ic_sort_ascending',
    },
    {
      label: $t('Order'),
      placeholder: $t('please select sort type'),
      name: 'orderType',
      value: params.orderType ?? 'desc',
      options: [
        { label: $t('desc'), value: 'desc' },
        { label: $t('asc'), value: 'asc' },
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
      label: $t('Edit'),
      icon: 'base/rx_ic_edit',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'copyId',
      label: $t('Copy profile ID'),
      icon: 'base/rx_ic_copy',
    },
    {
      separator: true,
    },
    {
      name: 'view',
      label: $t('View'),
      icon: 'base/rx_ic_browser',
    },
    {
      name: 'restart',
      label: $t('Restart'),
      icon: 'base/rx_ic_refresh',
      multiple: true,
      groupName: 'first',
    },
    {
      name: 'close',
      label: $t('Close'),
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
      label: $t('Add Tag'),
      icon: 'base/rx_ic_tag',
      power: !isViewer,
    },
    {
      separator: true,
    },
    {
      name: 'fav',
      label: $t('Fav'),
      icon: 'base/rx_ic_bookmark',
    },
    {
      name: 'addNotes',
      label: $t('Add Notes'),
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
      label: $t('Edit cookies'),
      icon: 'base/rx_ic_cookies',
      power: !isViewer,
    },
    {
      power: !isViewer,
      separator: true,
    },
    {
      name: 'delete',
      label: $t('Delete'),
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
